import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { ErreurFedapay, signerWebhookFedapay } from '../../src/services/fedapay.js'
import { APP, cookieSession, creerUtilisateur } from '../fabriques.js'
import { creerAppTest, pool, viderBase } from '../outils.js'

// docs/fedapay.md : encaissement par FedaPay, avec un faux client à la place de l'API.
const SECRET = 'wh_test'
let test
let dev
let appId
let fedapay

function creerFedapayTest() {
  return {
    transactions: [],
    statutDistant: 'pending',
    echec: null,
    async creerTransaction(demande) {
      if (this.echec) throw this.echec
      this.transactions.push(demande)
      const id = String(9000 + this.transactions.length)
      return { id, statut: 'pending', url: `https://sandbox-process.fedapay.com/${id}`, token: `tok_${id}` }
    },
    async lireTransaction(id) {
      return { id, statut: this.statutDistant }
    },
  }
}

beforeEach(async () => {
  await viderBase()
  fedapay = creerFedapayTest()
  test = creerAppTest({
    maintenant: '2026-11-13T09:00:00Z',
    config: { paiementMode: 'fedapay', fedapay: { secretWebhook: SECRET } },
    fedapay,
  })
  await creerUtilisateur({ email: 'awa@studio.bj', nom: 'Studio Awa', statut: 'valide' })
  dev = cookieSession(await request(test.app).post('/api/auth/connexion').send({ email: 'awa@studio.bj', motDePasse: 'motdepasse-valide' }))
  appId = (await request(test.app).post('/api/apps').set('Cookie', dev).send(APP)).body.app.id
})

const payer = (corps = { moyen: 'carte' }) => request(test.app).post(`/api/apps/${appId}/paiements`).set('Cookie', dev).send(corps)
const appActuelle = async () => (await request(test.app).get(`/api/apps/${appId}`).set('Cookie', dev)).body.app
function webhook(evenement, { secret = SECRET, decalage = 0 } = {}) {
  const brut = JSON.stringify(evenement)
  const t = Math.floor(test.app.locals.deps.maintenant().getTime() / 1000) + decalage
  return request(test.app)
    .post('/api/fedapay/webhook')
    .set('Content-Type', 'application/json')
    .set('X-FEDAPAY-SIGNATURE', signerWebhookFedapay(brut, secret, t))
    .send(brut)
}

describe('paiement par FedaPay (docs/fedapay.md §1)', () => {
  it('envoie le développeur sur la page FedaPay, en FCFA même pour la carte', async () => {
    const r = await payer()
    expect(r.status).toBe(201)
    expect(r.body.paiement).toMatchObject({ moyen: 'carte', montant: 17400, devise: 'XOF', statut: 'en_attente' })
    expect(r.body.redirection).toBe('https://sandbox-process.fedapay.com/9001')
    expect(fedapay.transactions[0]).toEqual({
      reference: r.body.paiement.reference,
      montant: 17400,
      devise: 'XOF',
      description: 'Nakayo · Offre Standard · Marché Facile',
      urlRetour: `http://localhost:5173/mon-compte/paiements/${r.body.paiement.reference}`,
      client: { nom: 'Studio Awa', email: 'awa@studio.bj', numero: null },
    })
    const { rows } = await pool.query('SELECT fournisseur, reference_fournisseur FROM paiements')
    expect(rows[0]).toEqual({ fournisseur: 'fedapay', reference_fournisseur: '9001' })
  })

  it('l’offre publique indique le débit de la carte en FCFA', async () => {
    const r = await request(test.app).get('/api/offres')
    expect(r.body.offres[0].debitCarte).toEqual({ montant: 17400, devise: 'XOF' })
  })

  it('Mobile Money : le numéro qui paie est prérempli chez FedaPay', async () => {
    await payer({ moyen: 'mobile_money', numeroMomo: '+229 01 97 00 00 00' })
    expect(fedapay.transactions[0].client.numero).toBe('+2290197000000')
  })

  it('FedaPay injoignable : 502, le paiement est clos et l’app reste en brouillon', async () => {
    fedapay.echec = new ErreurFedapay('timeout', { statut: 504 })
    const r = await payer()
    expect(r.status).toBe(502)
    expect(r.body.erreur.code).toBe('fournisseur_indisponible')
    const { rows } = await pool.query('SELECT statut FROM paiements')
    expect(rows[0].statut).toBe('echoue')
    expect((await appActuelle()).statut).toBe('brouillon')
  })

  it('sans client FedaPay configuré, le paiement reste fermé', async () => {
    const sansCle = creerAppTest({ config: { paiementMode: 'fedapay' }, fedapay: null })
    const cookie = cookieSession(await request(sansCle.app).post('/api/auth/connexion').send({ email: 'awa@studio.bj', motDePasse: 'motdepasse-valide' }))
    const r = await request(sansCle.app).post(`/api/apps/${appId}/paiements`).set('Cookie', cookie).send({ moyen: 'carte' })
    expect(r.status).toBe(503)
  })
})

describe('confirmation (docs/fedapay.md §2 et §3)', () => {
  it('le webhook transaction.approved valide le paiement, une seule facture même si FedaPay le renvoie', async () => {
    const { reference } = (await payer()).body.paiement
    const evenement = { name: 'transaction.approved', entity: { id: 9001, status: 'approved', merchant_reference: reference } }
    const r = await webhook(evenement)
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ recu: true, statut: 'reussi' })
    expect((await appActuelle()).statut).toBe('en_verification')
    expect(test.emails.dernierPour('awa@studio.bj').sujet).toBe('Reçu de paiement Nakayo NKY-2026-00001')

    await webhook(evenement)
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM factures')
    expect(rows[0].n).toBe(1)
  })

  it('sans référence Nakayo, la transaction est retrouvée par son identifiant FedaPay ; un refus clôt le paiement', async () => {
    await payer()
    const r = await webhook({ name: 'transaction.declined', entity: { id: 9001, status: 'declined' } })
    expect(r.body.statut).toBe('echoue')
    expect((await appActuelle()).statut).toBe('brouillon')
  })

  it('refuse une signature fausse ou trop ancienne, ignore les évènements sans issue', async () => {
    await payer()
    expect((await webhook({ name: 'transaction.approved', entity: { id: 9001, status: 'approved' } }, { secret: 'autre' })).status).toBe(401)
    expect((await webhook({ name: 'transaction.approved', entity: { id: 9001, status: 'approved' } }, { decalage: -600 })).status).toBe(401)
    const r = await webhook({ name: 'transaction.created', entity: { id: 9001, status: 'pending' } })
    expect(r.body).toEqual({ recu: true })
    expect((await appActuelle()).statut).toBe('brouillon')
  })

  it('au retour du développeur, le statut est relu chez FedaPay si le webhook n’est pas encore arrivé', async () => {
    const { reference } = (await payer()).body.paiement
    const lire = () => request(test.app).get(`/api/paiements/${reference}`).set('Cookie', dev)
    expect((await lire()).body.paiement.statut).toBe('en_attente')
    fedapay.statutDistant = 'approved'
    expect((await lire()).body.paiement).toMatchObject({ statut: 'reussi', facture: 'NKY-2026-00001' })
  })
})
