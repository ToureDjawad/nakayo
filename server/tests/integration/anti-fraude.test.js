import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { APP, APPAREIL, cookieSession, creerTesteur, creerTesteursValides, creerUtilisateur } from '../fabriques.js'
import { creerAppTest, pool, viderBase } from '../outils.js'
import { detecterFraudes, normaliserRapport } from '../../src/services/fraude.js'

// US-28 : comportements suspects (docs/anti-fraude.md).
const TOUT = ['testeurs_ajoutes', 'fiche_complete', 'version_publiee', 'pays_coches', 'pas_de_test_interne', 'mises_a_jour_prevues']
let test
let admin
let dev
let testeurs

const alertes = (statut = 'ouverte') => request(test.app).get(`/api/admin/alertes?statut=${statut}`).set('Cookie', admin)
const detecter = (jour) => detecterFraudes(pool, { jour, maintenant: new Date('2026-11-16T00:10:00Z') })

async function campagne(pkg) {
  const appId = (await request(test.app).post('/api/apps').set('Cookie', dev).send({ ...APP, package: pkg, lienTestFerme: `https://play.google.com/apps/testing/${pkg}` })).body.app.id
  const { reference } = (await request(test.app).post(`/api/apps/${appId}/paiements`).set('Cookie', dev).send({ moyen: 'carte' })).body.paiement
  await request(test.app).post(`/api/paiements/${reference}/simulation`).set('Cookie', dev).send({ resultat: 'reussi' })
  await request(test.app).post(`/api/admin/apps/${appId}/validation`).set('Cookie', admin)
  await request(test.app).put(`/api/apps/${appId}/preparation`).set('Cookie', dev).send({ elements: TOUT })
  expect((await request(test.app).post(`/api/apps/${appId}/campagne`).set('Cookie', dev)).status).toBe(201)
  return (await pool.query('SELECT id, testeur_id::text AS testeur FROM affectations WHERE app_id = $1 ORDER BY id', [appId])).rows
}

async function rapport(affectation, testeur, jour, { actions = 'J’ai cherché du riz et ajouté deux articles au panier.', lat = 6.37, usage = 200 } = {}) {
  await pool.query(
    `INSERT INTO rapports (affectation_id, testeur_id, jour, actions, note, bug, fonctionnalites, version_app, latitude, longitude, recu_le)
     VALUES ($1, $2, $3, $4, 4, false, ARRAY['Panier'], '1.0', $5, 2.42, now())`,
    [affectation, testeur, jour, actions, lat],
  )
  await pool.query(
    `INSERT INTO journees (affectation_id, jour, connexion, usage_secondes, rapport, valide, verifie_le) VALUES ($1, $2, true, $3, true, $4, now())`,
    [affectation, jour, usage, usage > 0],
  )
}

beforeEach(async () => {
  await viderBase()
  test = creerAppTest({ maintenant: '2026-11-12T09:00:00Z' })
  await creerUtilisateur({ email: 'awa@studio.bj', statut: 'valide' })
  await creerUtilisateur({ email: 'admin@nakayo.bj', role: 'admin', statut: 'valide' })
  const connexion = (email) => request(test.app).post('/api/auth/connexion').send({ email, motDePasse: 'motdepasse-valide' })
  dev = cookieSession(await connexion('awa@studio.bj'))
  admin = cookieSession(await connexion('admin@nakayo.bj'))
  testeurs = await creerTesteursValides(15)
})

describe('anti-fraude (US-28)', () => {
  it('normalise les rapports avant de les comparer', () => {
    expect(normaliserRapport('  J’ai cherché du RIZ,  puis…  payé ! ')).toBe(normaliserRapport('j ai cherche du riz puis paye'))
  })

  it('même position plusieurs jours, usage nul, rapports copiés et même Wi-Fi', async () => {
    const [a1, a2, a3] = await campagne('bj.studioawa.un')
    const autre = await campagne('bj.studioawa.deux')
    for (const jour of ['2026-11-13', '2026-11-14', '2026-11-15']) {
      await rapport(a1.id, a1.testeur, jour)
      await rapport(a2.id, a2.testeur, jour)
    }
    // Le testeur a3 envoie un rapport sans usage, et recopie un même texte pour deux apps.
    await rapport(a3.id, a3.testeur, '2026-11-15', { usage: 0, lat: 6.5, actions: 'Tout marche bien, rien à signaler aujourd’hui.' })
    const a3Autre = autre.find((a) => a.testeur === a3.testeur)
    await rapport(a3Autre.id, a3.testeur, '2026-11-15', { lat: 6.5, actions: 'Tout marche bien : rien à signaler aujourd’hui !' })
    // Deux testeurs de la campagne vus sur le même Wi-Fi.
    await pool.query(`INSERT INTO reseaux_testeurs VALUES ($1, $3, now(), now()), ($2, $3, now(), now())`, [a1.testeur, a2.testeur, 'f'.repeat(32)])

    const codes = await detecter('2026-11-15')
    // Les deux campagnes ont les mêmes testeurs : une alerte de Wi-Fi par campagne.
    expect(codes.sort()).toEqual(['meme_position', 'meme_reseau', 'meme_reseau', 'rapports_copies', 'usage_nul'])
    // Une seconde détection ne double rien.
    expect(await detecter('2026-11-15')).toEqual([])

    const r = await alertes()
    expect(r.status).toBe(200)
    expect(r.body.total).toBe(5)
    const position = r.body.alertes.find((a) => a.code === 'meme_position')
    expect(position).toMatchObject({
      libelle: 'Rapports envoyés du même endroit',
      detail: 'Rapports envoyés du même endroit (à 1 km près) 3 jours de la campagne.',
      statut: 'ouverte',
      campagne: { appNom: 'Marché Facile' },
    })
    expect(position.testeurs.map((t) => t.id)).toEqual([a1.testeur, a2.testeur].sort((x, y) => x - y))
  })

  it('même téléphone pour deux comptes, émulateur ou root signalé par l’app', async () => {
    await creerTesteur({ telephone: '+2290191000000', gmail: 'autre@gmail.com', numeroMomo: '+2290191000001', appareil: { ...APPAREIL, identifiant: 'app-0001' } })
    expect(await detecter('2026-11-15')).toEqual(['meme_appareil'])

    const bearer = { Authorization: `Bearer ${testeurs[0].jeton}` }
    expect((await request(test.app).post('/api/testeurs/moi/signal').set(bearer).send({ integrite: { emulateur: 'oui' } })).status).toBe(422)
    expect((await request(test.app).post('/api/testeurs/moi/signal').set(bearer).send({ integrite: { emulateur: true, root: true } })).status).toBe(200)
    expect((await request(test.app).post('/api/testeurs/moi/signal').set(bearer).send({ integrite: { emulateur: true, root: false } })).status).toBe(200)
    expect((await request(test.app).post('/api/testeurs/moi/signal').set(bearer)).status).toBe(200)
    const details = (await alertes()).body.alertes.filter((a) => a.code === 'appareil_suspect').map((a) => a.detail)
    expect(details.sort()).toEqual(['L’app Nakayo tourne sur un téléphone rooté.', 'L’app Nakayo tourne sur un émulateur.'])
  })

  it('l’admin confirme ou écarte une alerte, une seule fois', async () => {
    const bearer = { Authorization: `Bearer ${testeurs[0].jeton}` }
    await request(test.app).post('/api/testeurs/moi/signal').set(bearer).send({ integrite: { emulateur: true } })
    const [alerte] = (await alertes()).body.alertes
    const decider = (corps) => request(test.app).post(`/api/admin/alertes/${alerte.id}/decision`).set('Cookie', admin).send(corps)

    expect((await decider({ decision: 'peut-etre' })).body.erreur.champs).toEqual({ decision: 'valeur_inconnue' })
    const r = await decider({ decision: 'ecartee', note: 'Testeur qui utilise un émulateur pour la démo, vérifié par téléphone.' })
    expect(r.status).toBe(200)
    expect(r.body.alerte).toMatchObject({ statut: 'ecartee', note: 'Testeur qui utilise un émulateur pour la démo, vérifié par téléphone.' })
    expect((await decider({ decision: 'confirmee' })).status).toBe(409)
    expect((await alertes()).body.total).toBe(0)
    expect((await alertes('ecartee')).body.total).toBe(1)
    expect((await request(test.app).get('/api/admin/alertes').set('Cookie', dev)).status).toBe(403)
  })
})
