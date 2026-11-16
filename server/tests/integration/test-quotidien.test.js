import { readdirSync } from 'node:fs'
import path from 'node:path'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { APP, cookieSession, creerTesteursValides, creerUtilisateur, JPEG } from '../fabriques.js'
import { creerAppTest, pool, viderBase } from '../outils.js'

const TOUT = ['testeurs_ajoutes', 'fiche_complete', 'version_publiee', 'pays_coches', 'pas_de_test_interne', 'mises_a_jour_prevues']
const JOUR = 24 * 60 * 60 * 1000
const RAPPORT = {
  actions: 'J’ai cherché du riz et ajouté deux articles au panier.',
  note: 4,
  bug: false,
  fonctionnalites: ['Panier', 'Recherche de produits'],
  versionApp: '1.0.3',
  position: { latitude: 6.36536, longitude: 2.41833 },
}
let test
let testeurs
let affectation

async function connecter(email) {
  return cookieSession(await request(test.app).post('/api/auth/connexion').send({ email, motDePasse: 'motdepasse-valide' }))
}

const bearer = (t) => ({ Authorization: `Bearer ${t.jeton}` })
const appsDe = (t) => request(test.app).get('/api/testeurs/moi/apps').set(bearer(t))
const inscrire = (t, id = affectation) =>
  request(test.app).post(`/api/testeurs/moi/apps/${id}/inscription`).set(bearer(t)).attach('capture', JPEG, { filename: 'capture.jpg', contentType: 'image/jpeg' })
const installer = (t, id = affectation, sourceInstallation = 'com.android.vending') =>
  request(test.app).post(`/api/testeurs/moi/apps/${id}/installation`).set(bearer(t)).send({ sourceInstallation })
const rapporter = (t, corps = RAPPORT, id = affectation) => request(test.app).post(`/api/testeurs/moi/apps/${id}/rapports`).set(bearer(t)).send(corps)

// Le premier testeur affecté à la campagne d'une app prête.
async function testeurAffecte() {
  const { rows } = await pool.query('SELECT a.id, a.testeur_id FROM affectations a ORDER BY a.id LIMIT 1')
  affectation = String(rows[0].id)
  return testeurs.find((t) => t.id === String(rows[0].testeur_id))
}

beforeEach(async () => {
  await viderBase()
  test = creerAppTest({ maintenant: '2026-11-12T09:00:00Z', config: { groupeTesteurs: 'testeurs@nakayo.test' } })
  await creerUtilisateur({ email: 'awa@studio.bj', statut: 'valide' })
  await creerUtilisateur({ email: 'admin@nakayo.bj', role: 'admin', statut: 'valide' })
  const dev = await connecter('awa@studio.bj')
  const admin = await connecter('admin@nakayo.bj')
  testeurs = await creerTesteursValides(16)
  const id = (await request(test.app).post('/api/apps').set('Cookie', dev).send(APP)).body.app.id
  const { reference } = (await request(test.app).post(`/api/apps/${id}/paiements`).set('Cookie', dev).send({ moyen: 'carte' })).body.paiement
  await request(test.app).post(`/api/paiements/${reference}/simulation`).set('Cookie', dev).send({ resultat: 'reussi' })
  await request(test.app).post(`/api/admin/apps/${id}/validation`).set('Cookie', admin)
  await request(test.app).put(`/api/apps/${id}/preparation`).set('Cookie', dev).send({ elements: TOUT })
  await request(test.app).post(`/api/apps/${id}/campagne`).set('Cookie', dev)
})

describe('apps à tester (US-17)', () => {
  it('liste l’app affectée avec les liens, les identifiants et l’état du jour', async () => {
    const testeur = await testeurAffecte()
    const r = await appsDe(testeur)
    expect(r.status).toBe(200)
    expect(r.body.apps).toEqual([
      {
        id: affectation,
        campagneId: expect.any(String),
        app: {
          id: expect.any(String),
          nom: 'Marché Facile',
          package: 'bj.studioawa.marche',
          instructions: APP.instructions,
          fonctionnalites: APP.fonctionnalites,
          connexionRequise: false,
          identifiantsTest: null,
        },
        lienInscription: 'https://play.google.com/apps/testing/bj.studioawa.marche',
        lienPlayStore: 'https://play.google.com/store/apps/details?id=bj.studioawa.marche',
        jourCampagne: 1,
        joursCampagne: 16,
        joursExiges: 14,
        joursValides: 0,
        joursAcquis: false,
        derniereRemise: null,
        inscriptionConfirmee: false,
        installationConfirmee: false,
        rapportDuJour: false,
        retourDetailleAttendu: false,
        usageDuJourSecondes: 0,
        usageMinimumSecondes: 120,
        rapportsDeBugs: false,
        questionnaireTerrain: null,
      },
    ])
  })

  it('un testeur non affecté n’a rien, et ne voit pas l’app des autres', async () => {
    await testeurAffecte()
    const { rows } = await pool.query('SELECT testeur_id FROM affectations')
    const libre = testeurs.find((t) => !rows.some((r) => String(r.testeur_id) === t.id))
    expect((await appsDe(libre)).body.apps).toEqual([])
    expect((await inscrire(libre)).status).toBe(404)
  })

  it('un compte suspendu ou un développeur n’y a pas accès', async () => {
    const testeur = await testeurAffecte()
    await pool.query(`UPDATE utilisateurs SET statut = 'suspendu' WHERE id = $1`, [testeur.id])
    expect((await appsDe(testeur)).body.erreur.code).toBe('compte_non_valide')
    const dev = await connecter('awa@studio.bj')
    expect((await request(test.app).get('/api/testeurs/moi/apps').set('Cookie', dev)).status).toBe(403)
  })
})

describe('inscription et installation (US-17, US-18, US-43)', () => {
  it('la capture confirme l’inscription, et le compteur du développeur suit', async () => {
    const testeur = await testeurAffecte()
    const r = await inscrire(testeur)
    expect(r.status).toBe(200)
    expect(r.body.app.inscriptionConfirmee).toBe(true)

    // Une nouvelle capture remplace l'ancienne sans garder de fichier en trop.
    await inscrire(testeur)
    expect(readdirSync(path.join(test.dossierDocuments, testeur.id))).toHaveLength(1)

    const dev = await connecter('awa@studio.bj')
    const { rows } = await pool.query('SELECT app_id FROM affectations WHERE id = $1', [affectation])
    const suivi = await request(test.app).get(`/api/apps/${rows[0].app_id}/campagne`).set('Cookie', dev)
    expect(suivi.body.campagne.compteurs.inscritsConfirmes).toBe(1)
  })

  it('refuse un fichier qui n’est pas une image', async () => {
    const testeur = await testeurAffecte()
    const r = await request(test.app)
      .post(`/api/testeurs/moi/apps/${affectation}/inscription`)
      .set(bearer(testeur))
      .attach('capture', Buffer.from('pas une image'), { filename: 'capture.jpg', contentType: 'image/jpeg' })
    expect(r.status).toBe(422)
    expect(r.body.erreur.champs).toEqual({ capture: 'type_fichier_invalide' })
  })

  it('l’installation demande l’inscription puis une source Play Store', async () => {
    const testeur = await testeurAffecte()
    expect((await installer(testeur)).body.erreur.code).toBe('inscription_requise')
    await inscrire(testeur)
    const apk = await installer(testeur, affectation, 'com.google.android.packageinstaller')
    expect(apk.status).toBe(422)
    expect(apk.body.erreur.champs).toEqual({ sourceInstallation: 'source_non_play_store' })
    const r = await installer(testeur)
    expect(r.status).toBe(200)
    expect(r.body.app.installationConfirmee).toBe(true)
  })
})

describe('rapport du jour (US-19)', () => {
  async function pret() {
    const testeur = await testeurAffecte()
    await inscrire(testeur)
    await installer(testeur)
    return testeur
  }

  it('enregistre un rapport par jour, avec une position arrondie', async () => {
    const testeur = await pret()
    const r = await rapporter(testeur, { ...RAPPORT, fonctionnalites: ['Panier', 'Recherche de produits', 'Panier'] })
    expect(r.status).toBe(201)
    expect(r.body.app.rapportDuJour).toBe(true)
    const { rows } = await pool.query('SELECT jour::text AS jour, latitude, longitude, fonctionnalites FROM rapports')
    expect(rows[0]).toEqual({ jour: '2026-11-12', latitude: '6.37', longitude: '2.42', fonctionnalites: ['Recherche de produits', 'Panier'] })

    const deux = await rapporter(testeur)
    expect(deux.status).toBe(409)
    expect(deux.body.erreur.code).toBe('rapport_deja_envoye')

    // Le jour change à minuit au Bénin (23 h UTC) : un nouveau rapport est possible.
    test.avancer(14 * 60 * 60 * 1000)
    expect((await rapporter(testeur)).status).toBe(201)
  })

  it('valide chaque champ et exige un commentaire en cas de bug', async () => {
    const testeur = await pret()
    const r = await rapporter(testeur, {
      actions: 'court',
      note: 6,
      bug: true,
      fonctionnalites: ['Inventée'],
      versionApp: '',
      position: { latitude: 120, longitude: 2 },
    })
    expect(r.status).toBe(422)
    expect(r.body.erreur.champs).toEqual({
      actions: 'trop_court',
      note: 'format_invalide',
      commentaireBug: 'requis',
      fonctionnalites: 'valeur_inconnue',
      versionApp: 'requis',
      position: 'format_invalide',
    })
  })

  it('demande un retour détaillé les jours 3, 7 et 12', async () => {
    const testeur = await pret()
    test.avancer(2 * JOUR)
    expect((await appsDe(testeur)).body.apps[0]).toMatchObject({ jourCampagne: 3, retourDetailleAttendu: true })
    expect((await rapporter(testeur)).body.erreur.champs).toEqual({ retourDetaille: 'requis' })
    const r = await rapporter(testeur, { ...RAPPORT, retourDetaille: 'La recherche est rapide, mais le panier se vide quand je quitte l’app. '.repeat(2) })
    expect(r.status).toBe(201)
    expect(r.body.app.retourDetailleAttendu).toBe(false)
  })

  it('pas de rapport avant l’installation', async () => {
    const testeur = await testeurAffecte()
    await inscrire(testeur)
    expect((await rapporter(testeur)).body.erreur.code).toBe('installation_requise')
  })
})

describe('app compagnon (US-18)', () => {
  it('enregistre chaque ouverture à l’heure du serveur, une ligne par jour', async () => {
    const testeur = await testeurAffecte()
    const r = await request(test.app).post('/api/testeurs/moi/signal').set(bearer(testeur))
    expect(r.body).toEqual({ recuLe: '2026-11-12T09:00:00.000Z' })
    test.avancer(60 * 1000)
    await request(test.app).post('/api/testeurs/moi/signal').set(bearer(testeur))
    const { rows } = await pool.query('SELECT nombre, premiere_le, derniere_le FROM connexions_compagnon')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ nombre: 2, premiere_le: new Date('2026-11-12T09:00:00Z'), derniere_le: new Date('2026-11-12T09:01:00Z') })
  })

  it('garde le plus grand cumul du jour et ignore les apps et les jours hors campagne', async () => {
    const testeur = await testeurAffecte()
    const envoyer = (usages) => request(test.app).post('/api/testeurs/moi/usages').set(bearer(testeur)).send({ usages })
    const r = await envoyer([
      { package: 'BJ.StudioAwa.Marche', jour: '2026-11-12', secondes: 150 },
      { package: 'com.inconnue', jour: '2026-11-12', secondes: 600 },
      { package: 'bj.studioawa.marche', jour: '2026-11-11', secondes: 300 },
      { package: 'bj.studioawa.marche', jour: '2026-11-01', secondes: 300 },
    ])
    expect(r.body).toEqual({ enregistres: 1, ignores: 3 })
    await envoyer([{ package: 'bj.studioawa.marche', jour: '2026-11-12', secondes: 90 }])
    expect((await appsDe(testeur)).body.apps[0].usageDuJourSecondes).toBe(150)

    // Le lendemain, le cumul d'hier envoyé en retard compte encore.
    test.avancer(JOUR)
    await envoyer([{ package: 'bj.studioawa.marche', jour: '2026-11-12', secondes: 400 }])
    const { rows } = await pool.query('SELECT secondes FROM usages_quotidiens')
    expect(rows[0].secondes).toBe(400)

    expect((await envoyer([])).body.erreur.champs).toEqual({ usages: 'requis' })
    expect((await envoyer([{ package: 'a', jour: 'hier', secondes: 1 }])).body.erreur.champs).toEqual({ usages: 'format_invalide' })
  })
})
