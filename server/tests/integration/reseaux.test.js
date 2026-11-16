import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { APP, cookieSession, creerTesteursValides, creerUtilisateur, JPEG } from '../fabriques.js'
import { creerAppTest, pool, viderBase } from '../outils.js'

// US-16 : deux testeurs d'un même réseau Wi-Fi ne sont jamais dans la même campagne (docs/api-reseaux.md).
const TOUT = ['testeurs_ajoutes', 'fiche_complete', 'version_publiee', 'pays_coches', 'pas_de_test_interne', 'mises_a_jour_prevues']
const RAPPORT = {
  actions: 'J’ai cherché du riz et ajouté deux articles au panier.',
  note: 4,
  bug: false,
  fonctionnalites: ['Panier'],
  versionApp: '1.0.3',
  position: { latitude: 6.36536, longitude: 2.41833 },
}
let test
let dev
let admin

beforeEach(async () => {
  await viderBase()
  test = creerAppTest({ maintenant: '2026-11-12T09:00:00Z' })
  await creerUtilisateur({ email: 'awa@studio.bj', statut: 'valide' })
  await creerUtilisateur({ email: 'admin@nakayo.bj', role: 'admin', statut: 'valide' })
  const connexion = (email) => request(test.app).post('/api/auth/connexion').send({ email, motDePasse: 'motdepasse-valide' })
  dev = cookieSession(await connexion('awa@studio.bj'))
  admin = cookieSession(await connexion('admin@nakayo.bj'))
})

async function campagne(pkg) {
  const corps = { ...APP, package: pkg, lienTestFerme: `https://play.google.com/apps/testing/${pkg}` }
  const id = (await request(test.app).post('/api/apps').set('Cookie', dev).send(corps)).body.app.id
  const { reference } = (await request(test.app).post(`/api/apps/${id}/paiements`).set('Cookie', dev).send({ moyen: 'carte' })).body.paiement
  await request(test.app).post(`/api/paiements/${reference}/simulation`).set('Cookie', dev).send({ resultat: 'reussi' })
  await request(test.app).post(`/api/admin/apps/${id}/validation`).set('Cookie', admin)
  await request(test.app).put(`/api/apps/${id}/preparation`).set('Cookie', dev).send({ elements: TOUT })
  const r = await request(test.app).post(`/api/apps/${id}/campagne`).set('Cookie', dev)
  expect(r.status).toBe(201)
  return id
}

// Le testeur rejoint la campagne et envoie son rapport du jour, en Wi-Fi ou non.
async function rapporter(t, corps) {
  const bearer = { Authorization: `Bearer ${t.jeton}` }
  const [app] = (await request(test.app).get('/api/testeurs/moi/apps').set(bearer)).body.apps
  await request(test.app).post(`/api/testeurs/moi/apps/${app.id}/inscription`).set(bearer).field('gmailPrincipal', 'true').attach('capture', JPEG, { filename: 'c.jpg', contentType: 'image/jpeg' })
  await request(test.app).post(`/api/testeurs/moi/apps/${app.id}/installation`).set(bearer).send({ sourceInstallation: 'com.android.vending' })
  return request(test.app).post(`/api/testeurs/moi/apps/${app.id}/rapports`).set(bearer).send(corps)
}

const affectesA = async (appId) =>
  (await pool.query('SELECT testeur_id::text AS id FROM affectations WHERE app_id = $1', [appId])).rows.map((r) => r.id)

describe('réseau partagé (US-16)', () => {
  it('garde l’empreinte du Wi-Fi, et sépare ensuite les testeurs qui le partagent', async () => {
    const testeurs = await creerTesteursValides(15)
    await campagne('bj.studioawa.un')
    // Les deux premiers envoient leur rapport depuis le même Wi-Fi ; le troisième en 4G.
    expect((await rapporter(testeurs[0], { ...RAPPORT, wifi: true })).status).toBe(201)
    expect((await rapporter(testeurs[1], { ...RAPPORT, wifi: true })).status).toBe(201)
    expect((await rapporter(testeurs[2], { ...RAPPORT, wifi: false })).status).toBe(201)
    const { rows } = await pool.query('SELECT testeur_id::text AS id, empreinte FROM reseaux_testeurs ORDER BY testeur_id')
    expect(rows.map((r) => r.id)).toEqual([testeurs[0].id, testeurs[1].id])
    expect(rows[0].empreinte).toMatch(/^[0-9a-f]{32}$/)
    expect(rows[0].empreinte).toBe(rows[1].empreinte)

    // Une autre campagne avec 16 testeurs disponibles : un seul des deux voisins y entre.
    await creerTesteursValides(1, { debut: 15 })
    const ids = await affectesA(await campagne('bj.studioawa.deux'))
    expect(ids).toHaveLength(15)
    expect([testeurs[0].id, testeurs[1].id].filter((id) => ids.includes(id))).toHaveLength(1)
  })

  it('refuse un champ wifi qui n’est pas un booléen', async () => {
    const [t] = await creerTesteursValides(15)
    await campagne('bj.studioawa.un')
    const r = await rapporter(t, { ...RAPPORT, wifi: 'oui' })
    expect(r.status).toBe(422)
    expect(r.body.erreur.champs).toEqual({ wifi: 'format_invalide' })
  })
})
