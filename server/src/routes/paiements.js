import { Router } from 'express'
import { ErreurHttp } from '../lib/erreurs.js'
import { MOYENS_PAIEMENT, OFFRES, offrePublique, prixMonteeEnGamme } from '../lib/offres.js'
import { corps } from '../lib/validation.js'
import { exigerRole } from '../middlewares/authentification.js'
import { transaction } from './auth.js'
import {
  confirmerPaiement,
  enregistrerReferenceFournisseur,
  lirePaiementDeveloppeur,
  marquerPaiementEchoue,
  listerPaiementsDeveloppeur,
  messageRecu,
  signatureValide,
  versPaiementApi,
} from '../services/paiements.js'
import { facturePdf, lireFacture } from '../services/factures.js'
import { statutPaiement } from '../services/fedapay.js'

const STATUTS_CONFIRMATION = ['reussi', 'echoue']

// Fournisseur actif : FedaPay, la simulation, ou rien (503). `fcfa` : FedaPay n'encaisse qu'en FCFA.
export function fournisseurPaiement({ config, fedapay }) {
  const actif = config.paiementMode === 'fedapay' ? fedapay : null
  if (config.paiementMode !== 'simulation' && !actif) {
    throw new ErreurHttp(503, 'paiement_indisponible', { message: 'Le paiement en ligne n’est pas encore ouvert.' })
  }
  return { fedapay: actif, fcfa: Boolean(actif) }
}

// Envoie le développeur payer : page FedaPay (docs/fedapay.md §1) ou page de simulation.
// Le développeur revient ensuite sur « Mes paiements ».
export async function redirectionPaiement({ pool, config, journal, maintenant }, { fedapay, paiement, description, client }) {
  if (!fedapay) return { paiement: versPaiementApi(paiement), redirection: `/paiement/simulation/${paiement.reference}` }
  let lien
  try {
    lien = await fedapay.creerTransaction({
      reference: paiement.reference,
      montant: paiement.montant,
      devise: paiement.devise,
      description,
      urlRetour: `${config.clientUrl}/mon-compte/paiements/${paiement.reference}`,
      client,
    })
  } catch (erreur) {
    journal.error(erreur)
    await marquerPaiementEchoue(pool, { reference: paiement.reference, maintenant: maintenant() })
    throw new ErreurHttp(502, 'fournisseur_indisponible', { message: 'Le service de paiement ne répond pas. Réessayez dans quelques minutes.' })
  }
  await enregistrerReferenceFournisseur(pool, { reference: paiement.reference, referenceFournisseur: lien.id })
  return { paiement: versPaiementApi(paiement), redirection: lien.url }
}

// Confirmation commune au webhook et à la simulation ; envoie le reçu après validation.
export function creerConfirmation({ pool, emails, maintenant, config, journal }) {
  return async ({ reference, statut, referenceFournisseur }) => {
    const resultat = await transaction(pool, (client) =>
      confirmerPaiement(client, { reference, statut, referenceFournisseur, maintenant: maintenant() }),
    )
    if (resultat.nouveau) {
      try {
        await emails.envoyer(messageRecu(resultat.paiement, { email: resultat.email, clientUrl: config.clientUrl }))
      } catch (erreur) {
        // Le paiement est enregistré ; le reçu raté reste lisible dans « Mes paiements ».
        journal.error(erreur)
      }
    }
    return resultat.paiement
  }
}

// docs/api-sprint2.md §2 : offre publique, paiements du développeur, simulation et webhook.
export function routesPaiements(deps) {
  const { pool, config } = deps
  const confirmer = creerConfirmation(deps)
  const routeur = Router()

  // §2.4 Webhook d'un fournisseur : corps signé, aucune session.
  routeur.post('/webhook/:fournisseur', async (req, res) => {
    if (!signatureValide(req.corpsBrut, req.get('X-Nakayo-Signature'), config.paiementWebhookSecret)) {
      throw new ErreurHttp(401, 'signature_invalide', { message: 'Signature du webhook invalide.' })
    }
    const { reference, statut, referenceFournisseur } = corps(req)
    if (typeof reference !== 'string' || !STATUTS_CONFIRMATION.includes(statut)) {
      throw new ErreurHttp(400, 'corps_invalide', { message: 'Corps du webhook invalide.' })
    }
    const paiement = await confirmer({ reference, statut, referenceFournisseur: typeof referenceFournisseur === 'string' ? referenceFournisseur : null })
    res.json({ recu: true, statut: paiement.statut })
  })

  routeur.use(exigerRole('developpeur'))
  const developpeurId = (req) => req.session.utilisateur.id

  routeur.get('/', async (req, res) => {
    res.json({ paiements: await listerPaiementsDeveloppeur(pool, developpeurId(req)) })
  })

  routeur.get('/:reference', async (req, res) => {
    const paiement = await lirePaiementDeveloppeur(pool, { reference: req.params.reference, developpeurId: developpeurId(req) })
    res.json({ paiement: versPaiementApi(await synchroniser(paiement)) })
  })

  // docs/fedapay.md §2 Au retour de la page FedaPay, le webhook peut arriver après le développeur : on relit
  // alors le statut chez FedaPay. Une erreur du fournisseur laisse le paiement en attente.
  async function synchroniser(paiement) {
    if (paiement.statut !== 'en_attente' || paiement.fournisseur !== 'fedapay' || !paiement.reference_fournisseur || !deps.fedapay) return paiement
    try {
      const { statut } = await deps.fedapay.lireTransaction(paiement.reference_fournisseur)
      const issue = statutPaiement(statut)
      if (!issue) return paiement
      return await confirmer({ reference: paiement.reference, statut: issue, referenceFournisseur: paiement.reference_fournisseur })
    } catch (erreur) {
      deps.journal.error(erreur)
      return paiement
    }
  }

  // §2.3 Simulation (développement et tests seulement) : le développeur choisit l'issue.
  routeur.post('/:reference/simulation', async (req, res) => {
    if (config.paiementMode !== 'simulation') throw new ErreurHttp(404, 'introuvable', { message: 'Route introuvable' })
    const { resultat } = corps(req)
    if (!STATUTS_CONFIRMATION.includes(resultat)) {
      throw new ErreurHttp(422, 'validation', { message: 'Certains champs sont invalides.', champs: { resultat: 'valeur_inconnue' } })
    }
    const paiement = await lirePaiementDeveloppeur(pool, { reference: req.params.reference, developpeurId: developpeurId(req) })
    res.json({ paiement: versPaiementApi(await confirmer({ reference: paiement.reference, statut: resultat, referenceFournisseur: `SIM-${paiement.reference}` })) })
  })

  return routeur
}

export function routesOffres({ config }) {
  const routeur = Router()
  routeur.get('/', (_req, res) => {
    res.set('Cache-Control', 'public, max-age=300')
    // docs/api-offres.md §1 : les offres ouvertes, sans les règles internes (paie des testeurs).
    // docs/fedapay.md §1 FedaPay encaisse en FCFA : la carte est alors débitée du prix Mobile Money.
    // Pro porte aussi le prix de la montée en gamme depuis Standard (§2), la différence de prix.
    // L’Offre Plus est sur devis (§4) : son prix est un prix de départ.
    const fedapay = config.paiementMode === 'fedapay'
    const offres = Object.values(OFFRES).map((complete) => {
      const o = offrePublique(complete)
      const publique = fedapay ? { ...o, debitCarte: o.prix.mobile_money } : { ...o }
      if (o.code === 'pro') {
        const prix = Object.fromEntries(MOYENS_PAIEMENT.map((m) => [m, prixMonteeEnGamme(m, o.code)]))
        publique.monteeEnGamme = { prix, ...(fedapay && { debitCarte: prix.mobile_money }) }
      }
      return publique
    })
    res.json({ offres })
  })
  return routeur
}

// §3 Facture PDF : le développeur qui a payé, ou un admin.
export function routesFactures({ pool }) {
  const routeur = Router()
  routeur.use(exigerRole('developpeur', 'admin'))
  routeur.get('/:numero', async (req, res) => {
    const { utilisateur } = req.session
    const facture = await lireFacture(pool, {
      numero: req.params.numero,
      developpeurId: utilisateur.role === 'admin' ? null : utilisateur.id,
    })
    res.set('Content-Type', 'application/pdf')
    res.set('Content-Disposition', `attachment; filename="facture-${facture.numero}.pdf"`)
    res.set('Cache-Control', 'private, no-store')
    res.send(facturePdf(facture))
  })
  return routeur
}
