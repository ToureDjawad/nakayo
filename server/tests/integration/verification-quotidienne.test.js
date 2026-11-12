import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { APP, cookieSession, creerTesteursValides, creerUtilisateur, JPEG } from '../fabriques.js'
import { creerAppTest, pool, viderBase } from '../outils.js'
import { demarrerVerificationNocturne, joursEnRetard, verifierJour } from '../../src/services/verificationQuotidienne.js'

const TOUT = ['testeurs_ajoutes', 'fiche_complete', 'version_publiee', 'pays_coches', 'pas_de_test_interne', 'mises_a_jour_prevues']
const JOUR = 24 * 60 * 60 * 1000
const RAPPORT = {
  actions: 'J’ai cherché du riz et ajouté deux articles au panier.',
  note: 4,
  bug: false,
  fonctionnalites: ['Panier'],
  versionApp: '1.0.3',
  position: { latitude: 6.36, longitude: 2.41 },
  retourDetaille: 'La recherche est rapide, mais le panier se vide quand je quitte l’app et il faut alors tout recommencer depuis le début.',
}
let test
let testeur
let affectation

const bearer = () => ({ Authorization: `Bearer ${testeur.jeton}` })
const deps = () => test.app.locals.deps
const maintenant = () => deps().maintenant()
const verifier = (jour) => verifierJour(deps(), { jour, maintenant: maintenant() })
const compteur = async () => (await pool.query('SELECT jours_valides, nombre_remises, statut FROM affectations WHERE id = $1', [affectation])).rows[0]

// Une journée de test complète (ou incomplète) pour le testeur suivi.
async function journee({ connexion = true, secondes = 150, rapport = true } = {}) {
  const jour = new Date(maintenant().getTime() + 60 * 60 * 1000).toISOString().slice(0, 10)
  if (connexion) await request(test.app).post('/api/testeurs/moi/signal').set(bearer())
  if (secondes) await request(test.app).post('/api/testeurs/moi/usages').set(bearer()).send({ usages: [{ package: APP.package, jour, secondes }] })
  if (rapport) expect((await request(test.app).post(`/api/testeurs/moi/apps/${affectation}/rapports`).set(bearer()).send(RAPPORT)).status).toBe(201)
  return jour
}

async function connecter(email) {
  return cookieSession(await request(test.app).post('/api/auth/connexion').send({ email, motDePasse: 'motdepasse-valide' }))
}

beforeEach(async () => {
  await viderBase()
  // 10 h au Bénin le jour du démarrage.
  test = creerAppTest({ maintenant: '2026-11-12T09:00:00Z', config: { groupeTesteurs: 'testeurs@nakayo.test' } })
  await creerUtilisateur({ email: 'awa@studio.bj', statut: 'valide' })
  await creerUtilisateur({ email: 'admin@nakayo.bj', role: 'admin', statut: 'valide' })
  const dev = await connecter('awa@studio.bj')
  const admin = await connecter('admin@nakayo.bj')
  const testeurs = await creerTesteursValides(15)
  const id = (await request(test.app).post('/api/apps').set('Cookie', dev).send(APP)).body.app.id
  const { reference } = (await request(test.app).post(`/api/apps/${id}/paiements`).set('Cookie', dev).send({ moyen: 'carte' })).body.paiement
  await request(test.app).post(`/api/paiements/${reference}/simulation`).set('Cookie', dev).send({ resultat: 'reussi' })
  await request(test.app).post(`/api/admin/apps/${id}/validation`).set('Cookie', admin)
  await request(test.app).put(`/api/apps/${id}/preparation`).set('Cookie', dev).send({ elements: TOUT })
  await request(test.app).post(`/api/apps/${id}/campagne`).set('Cookie', dev)
  const { rows } = await pool.query('SELECT id, testeur_id FROM affectations ORDER BY id LIMIT 1')
  affectation = String(rows[0].id)
  testeur = testeurs.find((t) => t.id === String(rows[0].testeur_id))
  await request(test.app).post(`/api/testeurs/moi/apps/${affectation}/inscription`).set(bearer()).attach('capture', JPEG, { filename: 'c.jpg', contentType: 'image/jpeg' })
  await request(test.app).post(`/api/testeurs/moi/apps/${affectation}/installation`).set(bearer()).send({ sourceInstallation: 'com.android.vending' })
  test.sms.vider()
})

describe('vérification de chaque nuit (US-20)', () => {
  it('valide un jour complet, une seule fois même si la vérification est rejouée', async () => {
    const jour = await journee()
    test.avancer(JOUR)
    expect(await verifier(jour)).toEqual({ jour, affectations: 1, joursValides: 1, remises: 0 })
    expect(await verifier(jour)).toEqual({ jour, affectations: 0, joursValides: 0, remises: 0 })
    expect(await compteur()).toMatchObject({ jours_valides: 1, nombre_remises: 0 })
    const { rows } = await pool.query('SELECT connexion, usage_secondes, rapport, valide FROM journees')
    expect(rows).toEqual([{ connexion: true, usage_secondes: 150, rapport: true, valide: true }])
  })

  it('il faut les trois conditions : sinon le compteur repart à 0 et le testeur est prévenu', async () => {
    for (let i = 0; i < 2; i++) {
      const jour = await journee()
      test.avancer(JOUR)
      await verifier(jour)
    }
    expect((await compteur()).jours_valides).toBe(2)

    const jour = await journee({ secondes: 90, connexion: false })
    test.avancer(JOUR)
    expect(await verifier(jour)).toMatchObject({ joursValides: 0, remises: 1 })
    expect(await compteur()).toMatchObject({ jours_valides: 0, nombre_remises: 1 })
    const sms = test.sms.envoyes[0]
    expect(sms.texte).toBe(
      'Nakayo : votre compteur pour « Marché Facile » repart à J1. Hier, il manquait : ouvrir l’app Nakayo, utiliser l’app 2 minutes. ' +
        'Restez inscrit au test : ne vous désinscrivez surtout pas.',
    )

    const apps = await request(test.app).get('/api/testeurs/moi/apps').set(bearer())
    expect(apps.body.apps[0]).toMatchObject({ joursValides: 0, derniereRemise: { jour, manquait: ['connexion', 'usage'] } })
  })

  it('un testeur encore à 0 n’est pas prévenu, et une app non installée n’est pas vérifiée', async () => {
    await pool.query(`UPDATE affectations SET installation_confirmee_le = NULL WHERE id <> $1`, [affectation])
    const jour = await journee({ rapport: false })
    test.avancer(JOUR)
    expect(await verifier(jour)).toEqual({ jour, affectations: 1, joursValides: 0, remises: 0 })
    expect(test.sms.envoyes).toEqual([])
  })

  it('les 14 jours atteints sont acquis : pas de remise ensuite', async () => {
    await pool.query('UPDATE affectations SET jours_valides = 14 WHERE id = $1', [affectation])
    const jour = await journee({ rapport: false })
    test.avancer(JOUR)
    await verifier(jour)
    expect(await compteur()).toMatchObject({ jours_valides: 14, nombre_remises: 0 })
    expect((await request(test.app).get('/api/testeurs/moi/apps').set(bearer())).body.apps[0].joursAcquis).toBe(true)
  })

  it('termine la campagne au bout de 16 jours avec ses affectations', async () => {
    test.avancer(16 * JOUR)
    await verifier('2026-11-27')
    const { rows } = await pool.query('SELECT statut FROM campagnes')
    expect(rows[0].statut).toBe('terminee')
    expect((await compteur()).statut).toBe('terminee')
    expect((await request(test.app).get('/api/testeurs/moi/apps').set(bearer())).body.apps).toEqual([])
  })

  it('un temps d’utilisation envoyé après la vérification ne change plus le jour', async () => {
    const jour = await journee({ secondes: 60 })
    test.avancer(JOUR)
    await verifier(jour)
    const r = await request(test.app).post('/api/testeurs/moi/usages').set(bearer()).send({ usages: [{ package: APP.package, jour, secondes: 300 }] })
    expect(r.body).toEqual({ enregistres: 0, ignores: 1 })
  })
})

describe('planification', () => {
  it('rattrape au démarrage les jours récents non vérifiés, puis se programme pour la nuit suivante', async () => {
    expect(await joursEnRetard(pool, { maintenant: maintenant() })).toEqual(['2026-11-09', '2026-11-10', '2026-11-11'])
    const planificateur = demarrerVerificationNocturne(deps())
    await planificateur.premier
    planificateur.arreter()
    expect(await joursEnRetard(pool, { maintenant: maintenant() })).toEqual([])
    const { rows } = await pool.query('SELECT jour::text AS jour FROM verifications_quotidiennes ORDER BY jour')
    expect(rows.map((r) => r.jour)).toEqual(['2026-11-09', '2026-11-10', '2026-11-11'])
  })
})
