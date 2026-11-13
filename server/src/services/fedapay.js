import { createHmac, timingSafeEqual } from 'node:crypto'

// Agrégateur FedaPay (docs/fedapay.md) : encaissement des développeurs et versements aux
// testeurs. Client HTTP sans dépendance ; `fetch` est injectable pour les tests.
// API : https://docs.fedapay.com ; les réponses sont enveloppées (« v1/transaction », « v1/payout »).

export const URLS_FEDAPAY = {
  sandbox: 'https://sandbox-api.fedapay.com/v1',
  live: 'https://api.fedapay.com/v1',
}

// Codes FedaPay des opérateurs béninois (collectes et dépôts) ; Celtiis est « sbin ».
export const MODES_OPERATEURS = { mtn: 'mtn_open', moov: 'moov', celtiis: 'sbin' }

// Indicatifs des pays couverts, pour préremplir le numéro Mobile Money du client.
const PAYS_INDICATIFS = { 229: 'bj', 228: 'tg', 225: 'ci', 221: 'sn', 226: 'bf', 223: 'ml', 227: 'ne', 224: 'gn' }

// Tolérance sur l'horodatage des webhooks, comme le SDK officiel (5 minutes).
export const TOLERANCE_WEBHOOK_S = 300

export class ErreurFedapay extends Error {
  constructor(message, { statut, code } = {}) {
    super(message)
    this.name = 'ErreurFedapay'
    this.statut = statut
    this.code = code
  }
}

// « +229 01 97 00 00 00 » -> { number: '0197000000', country: 'bj' } ; null pour un pays non couvert.
export function numeroFedapay(numero) {
  const chiffres = String(numero ?? '').replace(/\D/g, '')
  const indicatif = Object.keys(PAYS_INDICATIFS).find((i) => chiffres.startsWith(i))
  if (!indicatif || chiffres.length <= indicatif.length) return null
  return { number: chiffres.slice(indicatif.length), country: PAYS_INDICATIFS[indicatif] }
}

// « Awa Houngbédji Koffi » -> { firstname: 'Awa', lastname: 'Houngbédji Koffi' } (FedaPay exige les deux).
export function nomFedapay(nom) {
  const morceaux = String(nom ?? '').trim().split(/\s+/).filter(Boolean)
  if (!morceaux.length) return { firstname: 'Client', lastname: 'Nakayo' }
  if (morceaux.length === 1) return { firstname: morceaux[0], lastname: morceaux[0] }
  return { firstname: morceaux[0], lastname: morceaux.slice(1).join(' ') }
}

// Signature d'un webhook : en-tête « t=<horodatage>,s=<hmac> », HMAC SHA-256 de « <t>.<corps brut> ».
export function signerWebhookFedapay(corpsBrut, secret, horodatage) {
  const signature = createHmac('sha256', secret).update(`${horodatage}.${corpsBrut}`, 'utf8').digest('hex')
  return `t=${horodatage},s=${signature}`
}

export function webhookFedapayValide(corpsBrut, entete, secret, maintenant = new Date()) {
  if (!secret || typeof entete !== 'string' || !corpsBrut) return false
  const morceaux = Object.fromEntries(entete.split(',').map((m) => m.trim().split('=')))
  const horodatage = Number.parseInt(morceaux.t, 10)
  if (!Number.isFinite(horodatage) || !morceaux.s) return false
  if (Math.abs(Math.floor(maintenant.getTime() / 1000) - horodatage) > TOLERANCE_WEBHOOK_S) return false
  const attendue = signerWebhookFedapay(String(corpsBrut), secret, horodatage).split(',s=')[1]
  if (morceaux.s.length !== attendue.length) return false
  return timingSafeEqual(Buffer.from(morceaux.s), Buffer.from(attendue))
}

// Statut d'une transaction FedaPay -> statut d'un paiement Nakayo (null : encore en attente).
export function statutPaiement(statutFedapay) {
  if (['approved', 'transferred'].includes(statutFedapay)) return 'reussi'
  if (['declined', 'canceled', 'refunded', 'expired'].includes(statutFedapay)) return 'echoue'
  return null
}

// Statut d'un payout FedaPay -> issue d'un versement Nakayo.
export function statutVersement(statutFedapay) {
  if (statutFedapay === 'sent') return 'verse'
  if (['failed', 'canceled', 'declined'].includes(statutFedapay)) return 'echoue'
  return 'en_cours'
}

export function creerClientFedapay({ cleSecrete, environnement = 'sandbox', fetch: fetchFn = globalThis.fetch, delaiMs = 15_000 }) {
  if (!cleSecrete) throw new Error('Clé secrète FedaPay manquante.')
  const base = URLS_FEDAPAY[environnement] ?? URLS_FEDAPAY.sandbox

  async function requete(methode, chemin, corps) {
    const reponse = await fetchFn(`${base}${chemin}`, {
      method: methode,
      headers: { Authorization: `Bearer ${cleSecrete}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: corps === undefined ? undefined : JSON.stringify(corps),
      signal: AbortSignal.timeout(delaiMs),
    })
    const donnees = await reponse.json().catch(() => ({}))
    if (!reponse.ok) {
      throw new ErreurFedapay(donnees.message ?? `FedaPay a répondu ${reponse.status}`, { statut: reponse.status, code: donnees.error_code ?? null })
    }
    return donnees
  }

  // Les réponses sont enveloppées : { "v1/transaction": {...} } ou { "v1/payouts": [...] }.
  const deballer = (donnees, cle) => donnees[`v1/${cle}`] ?? donnees[cle] ?? donnees

  return {
    environnement,

    // Crée la transaction puis son lien de paiement (page FedaPay : Mobile Money ou carte).
    async creerTransaction({ reference, montant, devise, description, urlRetour, client }) {
      const telephone = client.numero ? numeroFedapay(client.numero) : null
      const transaction = deballer(
        await requete('POST', '/transactions', {
          description,
          amount: montant,
          currency: { iso: devise },
          callback_url: urlRetour,
          merchant_reference: reference,
          custom_metadata: { reference },
          customer: {
            ...nomFedapay(client.nom),
            email: client.email,
            ...(telephone && { phone_number: telephone }),
          },
        }),
        'transaction',
      )
      const { url, token } = await requete('POST', `/transactions/${transaction.id}/token`)
      return { id: String(transaction.id), statut: transaction.status, url, token }
    },

    async lireTransaction(id) {
      const t = deballer(await requete('GET', `/transactions/${encodeURIComponent(id)}`), 'transaction')
      return { id: String(t.id), statut: t.status }
    },

    // Crée le payout puis le lance tout de suite.
    async verser({ reference, numero, operateur, montant, devise, nom }) {
      const mode = MODES_OPERATEURS[operateur]
      const telephone = numeroFedapay(numero)
      if (!mode || !telephone) throw new ErreurFedapay('Compte Mobile Money non pris en charge.', { code: 'compte_non_pris_en_charge' })
      const payout = deballer(
        await requete('POST', '/payouts', {
          amount: montant,
          currency: { iso: devise },
          mode,
          merchant_reference: reference,
          custom_metadata: { reference },
          customer: { ...nomFedapay(nom), phone_number: telephone },
        }),
        'payout',
      )
      const lances = deballer(await requete('PUT', '/payouts/start', { payouts: [{ id: payout.id }] }), 'payouts')
      const lance = Array.isArray(lances) ? (lances.find((p) => p.id === payout.id) ?? lances[0]) : lances
      return { id: String(payout.id), statut: lance?.status ?? payout.status, motif: lance?.last_error_code ?? null }
    },
  }
}

// Fournisseur de versements (contrat de services/momo.js) adossé à FedaPay.
export function creerMomoFedapay(fedapay) {
  return {
    nom: 'fedapay',
    async verser(demande) {
      try {
        const r = await fedapay.verser(demande)
        const statut = statutVersement(r.statut)
        const motif = r.motif && r.motif !== 'NO_ERROR' ? r.motif.toLowerCase() : null
        return { statut, referenceFournisseur: r.id, motif }
      } catch (erreur) {
        if (erreur instanceof ErreurFedapay && erreur.code === 'compte_non_pris_en_charge') {
          return { statut: 'echoue', motif: 'compte_non_pris_en_charge' }
        }
        throw erreur
      }
    },
  }
}
