import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { APP, cookieSession, creerUtilisateur } from '../fabriques.js'
import { creerAppTest, pool, viderBase } from '../outils.js'
import { envoyerRappelsAbonnements, moisSuivant } from '../../src/services/abonnements.js'

// US-45 : abonnement mensuel (docs/abonnement.md).
const JOUR = 24 * 60 * 60 * 1000
let test
let admin
let dev

const etat = async () => (await request(test.app).get('/api/abonnement').set('Cookie', dev)).body
const souscrire = (corps = { moyen: 'carte', telephoneRappels: '+2290161000000' }) => request(test.app).post('/api/abonnement/paiements').set('Cookie', dev).send(corps)
async function payer(corps) {
  const r = await souscrire(corps)
  expect(r.status).toBe(201)
  await request(test.app).post(`/api/paiements/${r.body.paiement.reference}/simulation`).set('Cookie', dev).send({ resultat: 'reussi' })
  return r.body.paiement
}
const creerApp = async (i) =>
  (await request(test.app).post('/api/apps').set('Cookie', dev).send({ ...APP, package: `bj.studio.app${i}`, lienTestFerme: `https://play.google.com/apps/testing/bj.studio.app${i}` })).body.app.id
const utiliser = (id) => request(test.app).post(`/api/apps/${id}/abonnement`).set('Cookie', dev)
const rappels = () => envoyerRappelsAbonnements(test.app.locals.deps, { maintenant: test.app.locals.deps.maintenant() })

beforeEach(async () => {
  await viderBase()
  test = creerAppTest({ maintenant: '2026-11-12T09:00:00Z' })
  await creerUtilisateur({ email: 'awa@studio.bj', statut: 'valide' })
  await creerUtilisateur({ email: 'admin@nakayo.bj', role: 'admin', statut: 'valide' })
  const connexion = (email) => request(test.app).post('/api/auth/connexion').send({ email, motDePasse: 'motdepasse-valide' })
  dev = cookieSession(await connexion('awa@studio.bj'))
  admin = cookieSession(await connexion('admin@nakayo.bj'))
})

describe('abonnement mensuel (US-45)', () => {
  it('mois calendaire, fin de mois comprise', () => {
    expect(moisSuivant(new Date('2026-11-12T09:00:00Z')).toISOString()).toBe('2026-12-12T09:00:00.000Z')
    expect(moisSuivant(new Date('2027-01-31T09:00:00Z')).toISOString()).toBe('2027-02-28T09:00:00.000Z')
  })

  it('souscription : facture, reçu, 3 campagnes Standard sans paiement, refus rendu', async () => {
    expect(await etat()).toMatchObject({ abonnement: null, offre: { campagnes: 3, prix: { carte: { montant: 6900, devise: 'USD' }, mobile_money: { montant: 41400 } } } })
    expect((await souscrire({ moyen: 'cheque' })).body.erreur.champs).toEqual({ moyen: 'valeur_inconnue' })

    const paiement = await payer()
    expect(paiement).toMatchObject({ nature: 'abonnement', appId: null, montant: 6900, devise: 'USD' })
    expect((await etat()).abonnement).toMatchObject({
      statut: 'actif',
      periodeDebut: '2026-11-12T09:00:00.000Z',
      echeance: '2026-12-12T09:00:00.000Z',
      finGrace: '2026-12-15T09:00:00.000Z',
      campagnesRestantes: 3,
      renouvelable: false,
      telephoneRappels: '+2290161000000',
    })
    expect(test.emails.dernierPour('awa@studio.bj').texte).toContain('un mois d’Abonnement Agence')
    const { rows: factures } = await pool.query('SELECT libelle FROM factures')
    expect(factures[0].libelle).toBe('Abonnement Agence : 3 campagnes Standard, du 12/11/2026 au 12/12/2026')
    expect((await request(test.app).get('/api/paiements').set('Cookie', dev)).body.paiements[0]).toMatchObject({ nature: 'abonnement', appNom: null })
    expect((await souscrire()).body.erreur.code).toBe('renouvellement_trop_tot')

    const ids = []
    for (let i = 0; i < 4; i++) ids.push(await creerApp(i))
    for (const id of ids.slice(0, 3)) expect((await utiliser(id)).body.app).toMatchObject({ statut: 'en_verification', offre: 'standard' })
    expect((await utiliser(ids[3])).body.erreur.code).toBe('quota_atteint')
    expect((await utiliser(ids[0])).body.erreur.code).toBe('statut_incompatible')

    await request(test.app).post(`/api/admin/apps/${ids[0]}/refus`).set('Cookie', admin).send({ motif: 'Le lien du test fermé ne fonctionne pas.' })
    expect((await etat()).abonnement.campagnesRestantes).toBe(1)
    expect((await utiliser(ids[3])).status).toBe(200)
  })

  it('rappels J-3 et jour J, grâce de 3 jours, suspension, puis renouvellement', async () => {
    await payer({ moyen: 'mobile_money', numeroMomo: '+2290162000000' })
    const app = await creerApp(1)

    test.avancer(27 * JOUR) // 9 décembre : J-3
    expect(await rappels()).toBe(1)
    expect(await rappels()).toBe(0)
    expect(test.emails.dernierPour('awa@studio.bj').sujet).toBe('Votre abonnement Nakayo arrive à échéance dans 3 jours')
    expect(test.sms.dernierPour('+2290162000000').texte).toContain('arrive à échéance le 12 décembre 2026')
    expect((await etat()).abonnement.renouvelable).toBe(true)

    test.avancer(3 * JOUR) // 12 décembre : échéance, délai de grâce
    expect(await rappels()).toBe(1)
    expect((await etat()).abonnement.statut).toBe('en_grace')

    test.avancer(3 * JOUR) // 15 décembre : suspendu
    expect(await rappels()).toBe(1)
    expect(test.emails.dernierPour('awa@studio.bj').sujet).toBe('Votre abonnement Nakayo est suspendu')
    expect((await etat()).abonnement).toMatchObject({ statut: 'suspendu', campagnesRestantes: 0 })
    expect((await utiliser(app)).body.erreur.code).toBe('abonnement_suspendu')

    // Renouvelé après la suspension : un nouveau mois commence maintenant.
    await payer({ moyen: 'mobile_money', numeroMomo: '+2290162000000' })
    expect((await etat()).abonnement).toMatchObject({ statut: 'actif', periodeDebut: '2026-12-15T09:00:00.000Z', echeance: '2027-01-15T09:00:00.000Z', campagnesRestantes: 3 })
    expect((await utiliser(app)).status).toBe(200)
  })

  it('renouvelé avant l’échéance : le mois suivant s’enchaîne', async () => {
    await payer()
    test.avancer(25 * JOUR)
    await payer()
    expect((await etat()).abonnement).toMatchObject({ statut: 'actif', periodeDebut: '2026-11-12T09:00:00.000Z', echeance: '2027-01-12T09:00:00.000Z' })
  })

  it('compte non validé : pas d’abonnement', async () => {
    await creerUtilisateur({ email: 'nouveau@studio.bj', statut: 'en_attente' })
    const nouveau = cookieSession(await request(test.app).post('/api/auth/connexion').send({ email: 'nouveau@studio.bj', motDePasse: 'motdepasse-valide' }))
    expect((await request(test.app).post('/api/abonnement/paiements').set('Cookie', nouveau).send({ moyen: 'carte' })).status).toBe(403)
  })
})
