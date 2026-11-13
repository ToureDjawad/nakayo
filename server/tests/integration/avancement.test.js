import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { APP, cookieSession, creerTesteursValides, creerUtilisateur, JPEG } from '../fabriques.js'
import { creerAppTest, pool, viderBase } from '../outils.js'
import { verifierJour } from '../../src/services/verificationQuotidienne.js'

const TOUT = ['testeurs_ajoutes', 'fiche_complete', 'version_publiee', 'pays_coches', 'pas_de_test_interne', 'mises_a_jour_prevues']
const JOUR = 24 * 60 * 60 * 1000
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
let appId
let testeurs
let affectations

const deps = () => test.app.locals.deps
const maintenant = () => deps().maintenant()
const jourCourant = () => new Date(maintenant().getTime() + 60 * 60 * 1000).toISOString().slice(0, 10)
const avancement = () => request(test.app).get(`/api/apps/${appId}/campagne/avancement`).set('Cookie', dev)

async function connecter(email) {
  return cookieSession(await request(test.app).post('/api/auth/connexion').send({ email, motDePasse: 'motdepasse-valide' }))
}

// Le testeur n° `i` de la campagne : inscription, installation.
async function installer(i) {
  const bearer = { Authorization: `Bearer ${testeurs[i].jeton}` }
  await request(test.app).post(`/api/testeurs/moi/apps/${affectations[i]}/inscription`).set(bearer).attach('capture', JPEG, { filename: 'c.jpg', contentType: 'image/jpeg' })
  await request(test.app).post(`/api/testeurs/moi/apps/${affectations[i]}/installation`).set(bearer).send({ sourceInstallation: 'com.android.vending' })
}

async function journee(i, { secondes = 150, rapport = RAPPORT } = {}) {
  const bearer = { Authorization: `Bearer ${testeurs[i].jeton}` }
  await request(test.app).post('/api/testeurs/moi/signal').set(bearer)
  await request(test.app).post('/api/testeurs/moi/usages').set(bearer).send({ usages: [{ package: APP.package, jour: jourCourant(), secondes }] })
  if (rapport) expect((await request(test.app).post(`/api/testeurs/moi/apps/${affectations[i]}/rapports`).set(bearer).send(rapport)).status).toBe(201)
}

beforeEach(async () => {
  await viderBase()
  test = creerAppTest({ maintenant: '2026-11-12T09:00:00Z', config: { groupeTesteurs: 'testeurs@nakayo.test' } })
  await creerUtilisateur({ email: 'awa@studio.bj', statut: 'valide' })
  await creerUtilisateur({ email: 'admin@nakayo.bj', role: 'admin', statut: 'valide' })
  dev = await connecter('awa@studio.bj')
  const admin = await connecter('admin@nakayo.bj')
  const crees = await creerTesteursValides(15, { modele: (i) => (i < 3 ? 'Spark 20' : i < 5 ? 'Redmi 13C' : `Modèle ${i}`) })
  appId = (await request(test.app).post('/api/apps').set('Cookie', dev).send(APP)).body.app.id
  const { reference } = (await request(test.app).post(`/api/apps/${appId}/paiements`).set('Cookie', dev).send({ moyen: 'carte' })).body.paiement
  await request(test.app).post(`/api/paiements/${reference}/simulation`).set('Cookie', dev).send({ resultat: 'reussi' })
  await request(test.app).post(`/api/admin/apps/${appId}/validation`).set('Cookie', admin)
  await request(test.app).put(`/api/apps/${appId}/preparation`).set('Cookie', dev).send({ elements: TOUT })
  await request(test.app).post(`/api/apps/${appId}/campagne`).set('Cookie', dev)
  const { rows } = await pool.query('SELECT id, testeur_id FROM affectations ORDER BY id')
  affectations = rows.map((r) => String(r.id))
  testeurs = rows.map((r) => crees.find((t) => t.id === String(r.testeur_id)))
})

describe('avancement de la campagne (US-21)', () => {
  it('jour par jour : temps, rapports, jours validés, couverture et appareils', async () => {
    await installer(0)
    await installer(1)
    await journee(0)
    await journee(1, { secondes: 60, rapport: { ...RAPPORT, note: 2, bug: true, commentaireBug: 'Le panier se vide quand je quitte l’app.', fonctionnalites: ['Panier', 'Recherche de produits'] } })
    const jour1 = jourCourant()
    test.avancer(JOUR)
    await verifierJour(deps(), { jour: jour1, maintenant: maintenant() })
    await journee(0, { rapport: { ...RAPPORT, note: 5 } })

    const res = await avancement()
    expect(res.status).toBe(200)
    const a = res.body.avancement
    expect(a).toMatchObject({ statut: 'en_cours', jour: 2, joursExiges: 14 })
    expect(a.parJour).toEqual([
      { jour: '2026-11-12', numero: 1, tempsSecondes: 210, testeursAvecUsage: 2, rapports: 2, testeursValides: 1 },
      { jour: '2026-11-13', numero: 2, tempsSecondes: 150, testeursAvecUsage: 1, rapports: 1, testeursValides: null },
    ])
    expect(a.resume).toEqual({ testeursActifs: 2, installes: 2, tempsTotalSecondes: 360, rapports: 3, noteMoyenne: 3.7, bugs: 1, appareilsEntreeDeGamme: 0 })
    expect(a.testeurs).toHaveLength(15)
    expect(a.testeurs[0]).toMatchObject({ numero: 1, joursValides: 1, installationConfirmee: true, actif: true, dernierRapport: '2026-11-13' })
    expect(a.testeurs[2]).toMatchObject({ numero: 3, installationConfirmee: false, actif: false, dernierRapport: null })
    expect(a.couverture).toEqual([
      { fonctionnalite: 'Recherche de produits', testeurs: 1, rapports: 1, part: 0.5 },
      { fonctionnalite: 'Panier', testeurs: 2, rapports: 3, part: 1 },
      { fonctionnalite: 'Suivi de livraison', testeurs: 0, rapports: 0, part: 0 },
    ])
    expect(a.appareils[0]).toMatchObject({ modele: 'Spark 20', testeurs: 3 })
    expect(a.appareils[1]).toMatchObject({ modele: 'Redmi 13C', testeurs: 2 })
    expect(a.appareils).toHaveLength(12)
    // Du plus récent au plus ancien, sans la position du testeur.
    expect(a.rapports.map((r) => [r.jourCampagne, r.testeur, r.note])).toEqual([[2, 1, 5], [1, 2, 2], [1, 1, 4]])
    expect(a.rapports[1]).toMatchObject({ bug: true, commentaireBug: 'Le panier se vide quand je quitte l’app.', versionApp: '1.0.3' })
    expect(a.rapports[0]).not.toHaveProperty('latitude')
    expect(JSON.stringify(a)).not.toMatch(/gmail|telephone|\+229/)
    expect(a.objectif).toEqual({ atteint: false, testeursAtteints: 0, dateEstimee: null })
  })

  it('estime la date des 14 jours pour 12 testeurs', async () => {
    for (let i = 0; i < 12; i++) await installer(i)
    await pool.query('UPDATE affectations SET jours_valides = 10 WHERE id = ANY($1)', [affectations.slice(0, 11)])
    await pool.query('UPDATE affectations SET jours_valides = 3 WHERE id = $1', [affectations[11]])
    const a = (await avancement()).body.avancement
    // Le 12e testeur a 3 jours : il lui en reste 11, aujourd'hui compris.
    expect(a.objectif).toEqual({ atteint: false, testeursAtteints: 0, dateEstimee: '2026-11-22' })

    await pool.query('UPDATE affectations SET jours_valides = 14 WHERE id = ANY($1)', [affectations.slice(0, 12)])
    expect((await avancement()).body.avancement.objectif).toEqual({ atteint: true, testeursAtteints: 12, dateEstimee: null })
  })

  it('réservé au développeur de l’app, 404 sans campagne', async () => {
    await creerUtilisateur({ email: 'autre@studio.bj', statut: 'valide' })
    const autre = await connecter('autre@studio.bj')
    expect((await request(test.app).get(`/api/apps/${appId}/campagne/avancement`).set('Cookie', autre)).status).toBe(404)
    expect((await request(test.app).get(`/api/apps/abc/campagne/avancement`).set('Cookie', dev)).status).toBe(404)
    expect((await request(test.app).get(`/api/apps/${appId}/campagne/avancement`)).status).toBe(401)
    await pool.query('DELETE FROM campagnes')
    expect((await avancement()).status).toBe(404)
  })
})
