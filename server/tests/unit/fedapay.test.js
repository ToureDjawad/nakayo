import { describe, expect, it } from 'vitest'
import {
  creerClientFedapay,
  creerMomoFedapay,
  nomFedapay,
  numeroFedapay,
  signerWebhookFedapay,
  statutPaiement,
  statutVersement,
  webhookFedapayValide,
} from '../../src/services/fedapay.js'

// Faux fetch : rejoue des réponses dans l'ordre et garde les requêtes envoyées.
function fauxFetch(...reponses) {
  const requetes = []
  const fetch = async (url, options) => {
    requetes.push({ url, methode: options.method, entetes: options.headers, corps: options.body ? JSON.parse(options.body) : undefined })
    const r = reponses.shift()
    return new Response(JSON.stringify(r.corps ?? {}), { status: r.statut ?? 200 })
  }
  return { fetch, requetes }
}

describe('client FedaPay', () => {
  it('crée la transaction puis son lien de paiement, avec le client prérempli', async () => {
    const { fetch, requetes } = fauxFetch(
      { statut: 201, corps: { 'v1/transaction': { klass: 'v1/transaction', id: 4521, status: 'pending' } } },
      { corps: { token: 'tok_1', url: 'https://sandbox-process.fedapay.com/tok_1' } },
    )
    const fedapay = creerClientFedapay({ cleSecrete: 'sk_sandbox_x', fetch })
    const lien = await fedapay.creerTransaction({
      reference: 'PAY-0123456789ABCDEF',
      montant: 17400,
      devise: 'XOF',
      description: 'Nakayo · Standard · Marché Facile',
      urlRetour: 'http://localhost:5173/mon-compte/paiements/PAY-0123456789ABCDEF',
      client: { nom: 'Awa Houngbédji', email: 'awa@studio.bj', numero: '+229 01 97 00 00 00' },
    })
    expect(lien).toEqual({ id: '4521', statut: 'pending', url: 'https://sandbox-process.fedapay.com/tok_1', token: 'tok_1' })
    expect(requetes[0]).toMatchObject({
      url: 'https://sandbox-api.fedapay.com/v1/transactions',
      methode: 'POST',
      entetes: { Authorization: 'Bearer sk_sandbox_x' },
      corps: {
        amount: 17400,
        currency: { iso: 'XOF' },
        merchant_reference: 'PAY-0123456789ABCDEF',
        custom_metadata: { reference: 'PAY-0123456789ABCDEF' },
        customer: { firstname: 'Awa', lastname: 'Houngbédji', email: 'awa@studio.bj', phone_number: { number: '0197000000', country: 'bj' } },
      },
    })
    expect(requetes[1]).toMatchObject({ url: 'https://sandbox-api.fedapay.com/v1/transactions/4521/token', methode: 'POST' })
  })

  it('verse à un testeur : crée le payout avec le bon opérateur puis le lance', async () => {
    const { fetch, requetes } = fauxFetch(
      { statut: 201, corps: { 'v1/payout': { id: 77, status: 'pending' } } },
      { corps: { 'v1/payouts': [{ id: 77, status: 'started', last_error_code: 'NO_ERROR' }] } },
    )
    const momo = creerMomoFedapay(creerClientFedapay({ cleSecrete: 'sk_live_x', environnement: 'live', fetch }))
    const r = await momo.verser({ reference: 'VER-0A1B2C3D4E5F6071', numero: '+229 01 66 00 00 01', operateur: 'moov', montant: 500, devise: 'XOF', nom: 'Koffi' })
    expect(r).toEqual({ statut: 'en_cours', referenceFournisseur: '77', motif: null })
    expect(requetes[0]).toMatchObject({
      url: 'https://api.fedapay.com/v1/payouts',
      corps: { amount: 500, mode: 'moov', merchant_reference: 'VER-0A1B2C3D4E5F6071', customer: { firstname: 'Koffi', lastname: 'Koffi', phone_number: { number: '0166000001', country: 'bj' } } },
    })
    expect(requetes[1]).toMatchObject({ url: 'https://api.fedapay.com/v1/payouts/start', methode: 'PUT', corps: { payouts: [{ id: 77 }] } })
  })

  it('un refus de FedaPay devient une erreur, un compte non pris en charge un échec sans appel', async () => {
    const { fetch } = fauxFetch({ statut: 422, corps: { message: 'Solde insuffisant', error_code: 'insufficient_balance' } })
    const fedapay = creerClientFedapay({ cleSecrete: 'sk', fetch })
    await expect(fedapay.lireTransaction('1')).rejects.toMatchObject({ name: 'ErreurFedapay', statut: 422, code: 'insufficient_balance' })

    const appels = fauxFetch()
    const momo = creerMomoFedapay(creerClientFedapay({ cleSecrete: 'sk', fetch: appels.fetch }))
    expect(await momo.verser({ reference: 'VER-1', numero: '+33 6 12 34 56 78', operateur: 'mtn', montant: 500, devise: 'XOF' })).toEqual({
      statut: 'echoue',
      motif: 'compte_non_pris_en_charge',
    })
    expect(appels.requetes).toHaveLength(0)
  })
})

describe('outils FedaPay', () => {
  it('découpe les numéros et les noms', () => {
    expect(numeroFedapay('+228 90 11 22 33')).toEqual({ number: '90112233', country: 'tg' })
    expect(numeroFedapay('+33 6 12 34 56 78')).toBeNull()
    expect(nomFedapay('Studio Awa Mobile')).toEqual({ firstname: 'Studio', lastname: 'Awa Mobile' })
  })

  it('traduit les statuts', () => {
    expect(statutPaiement('approved')).toBe('reussi')
    expect(statutPaiement('canceled')).toBe('echoue')
    expect(statutPaiement('pending')).toBeNull()
    expect(statutVersement('sent')).toBe('verse')
    expect(statutVersement('failed')).toBe('echoue')
    expect(statutVersement('started')).toBe('en_cours')
  })

  it('vérifie la signature des webhooks, horodatage compris', () => {
    const maintenant = new Date('2026-11-13T10:00:00Z')
    const t = Math.floor(maintenant.getTime() / 1000)
    const corps = '{"name":"transaction.approved"}'
    const entete = signerWebhookFedapay(corps, 'wh_secret', t)
    expect(webhookFedapayValide(corps, entete, 'wh_secret', maintenant)).toBe(true)
    expect(webhookFedapayValide(`${corps} `, entete, 'wh_secret', maintenant)).toBe(false)
    expect(webhookFedapayValide(corps, entete, 'autre', maintenant)).toBe(false)
    expect(webhookFedapayValide(corps, entete, 'wh_secret', new Date(maintenant.getTime() + 301_000))).toBe(false)
    expect(webhookFedapayValide(corps, 'n_importe_quoi', 'wh_secret', maintenant)).toBe(false)
  })
})
