import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { APP, cookieSession, creerTesteursValides, creerUtilisateur } from '../fabriques.js'
import { creerAppTest, pool, viderBase } from '../outils.js'

const TOUT = ['testeurs_ajoutes', 'fiche_complete', 'version_publiee', 'pays_coches', 'pas_de_test_interne', 'mises_a_jour_prevues']
let test
let dev
let admin

async function connecter(email) {
  return cookieSession(await request(test.app).post('/api/auth/connexion').send({ email, motDePasse: 'motdepasse-valide' }))
}

// App payée, validée par l'équipe et préparée : prête à démarrer.
async function appPrete(corps = APP) {
  const id = (await request(test.app).post('/api/apps').set('Cookie', dev).send(corps)).body.app.id
  const { reference } = (await request(test.app).post(`/api/apps/${id}/paiements`).set('Cookie', dev).send({ moyen: 'carte' })).body.paiement
  await request(test.app).post(`/api/paiements/${reference}/simulation`).set('Cookie', dev).send({ resultat: 'reussi' })
  await request(test.app).post(`/api/admin/apps/${id}/validation`).set('Cookie', admin)
  await request(test.app).put(`/api/apps/${id}/preparation`).set('Cookie', dev).send({ elements: TOUT })
  return id
}
const demarrer = (id) => request(test.app).post(`/api/apps/${id}/campagne`).set('Cookie', dev)
const autreApp = (pkg) => ({ ...APP, package: pkg, lienTestFerme: `https://play.google.com/apps/testing/${pkg}` })

beforeEach(async () => {
  await viderBase()
  test = creerAppTest({ maintenant: '2026-11-12T09:00:00Z', config: { groupeTesteurs: 'testeurs@nakayo.test' } })
  await creerUtilisateur({ email: 'awa@studio.bj', statut: 'valide' })
  await creerUtilisateur({ email: 'admin@nakayo.bj', role: 'admin', statut: 'valide' })
  dev = await connecter('awa@studio.bj')
  admin = await connecter('admin@nakayo.bj')
})

describe('démarrage de la campagne (US-13, US-16)', () => {
  it('affecte 15 testeurs validés pour 16 jours, prévient les testeurs et le développeur', async () => {
    await creerTesteursValides(17)
    const id = await appPrete()
    const r = await demarrer(id)
    expect(r.status).toBe(201)
    const { campagne } = r.body
    expect(campagne).toMatchObject({
      app: { id, nom: 'Marché Facile', package: 'bj.studioawa.marche' },
      statut: 'en_cours',
      jour: 1,
      joursCampagne: 16,
      joursExiges: 14,
      testeursVises: 15,
      groupeGoogle: 'testeurs@nakayo.test',
      demarreeLe: '2026-11-12T09:00:00.000Z',
      finPrevueLe: '2026-11-28T09:00:00.000Z',
      compteurs: { affectes: 15, inscritsConfirmes: 0, installes: 0 },
      alerteInscrits: false,
    })
    expect(campagne.testeurs).toHaveLength(15)
    expect(campagne.testeurs[0]).toEqual({
      id: expect.any(String),
      numero: 1,
      statut: 'active',
      ville: expect.any(String),
      gmail: expect.stringMatching(/@gmail\.com$/),
      inscriptionConfirmee: false,
      installationConfirmee: false,
      joursValides: 0,
    })
    // Le développeur ne voit ni le nom ni le téléphone des testeurs.
    expect(campagne.testeurs[0]).not.toHaveProperty('nom')
    expect(campagne.testeurs[0]).not.toHaveProperty('telephone')

    expect(test.sms.envoyes.filter((m) => m.texte.includes('« Marché Facile »'))).toHaveLength(15)
    expect(test.emails.dernierPour('awa@studio.bj').sujet).toBe('La campagne de « Marché Facile » a démarré')

    const lue = await request(test.app).get(`/api/apps/${id}/campagne`).set('Cookie', dev)
    expect(lue.body.campagne).toEqual(campagne)
    const app = await request(test.app).get(`/api/apps/${id}`).set('Cookie', dev)
    expect(app.body.app.campagne).toEqual({ id: campagne.id, statut: 'en_cours', demarreeLe: '2026-11-12T09:00:00.000Z' })
  })

  it('refuse tant que l’app n’est pas validée ou la liste pas complète, et une seconde fois', async () => {
    await creerTesteursValides(15)
    const brouillon = (await request(test.app).post('/api/apps').set('Cookie', dev).send(autreApp('bj.studioawa.brouillon'))).body.app.id
    expect((await demarrer(brouillon)).body.erreur).toMatchObject({ code: 'statut_incompatible', statut: 'brouillon' })

    const id = await appPrete()
    await request(test.app).put(`/api/apps/${id}/preparation`).set('Cookie', dev).send({ elements: TOUT.slice(1) })
    expect((await demarrer(id)).body.erreur.code).toBe('preparation_incomplete')

    await request(test.app).put(`/api/apps/${id}/preparation`).set('Cookie', dev).send({ elements: TOUT })
    expect((await demarrer(id)).status).toBe(201)
    const encore = await demarrer(id)
    expect(encore.status).toBe(409)
    expect(encore.body.erreur.code).toBe('campagne_existante')
    // La liste de vérification est figée une fois la campagne démarrée.
    const decoche = await request(test.app).put(`/api/apps/${id}/preparation`).set('Cookie', dev).send({ elements: [] })
    expect(decoche.body.erreur.code).toBe('campagne_existante')
  })

  it('pas assez de testeurs disponibles : 409 et rien n’est créé', async () => {
    await creerTesteursValides(14)
    const id = await appPrete()
    const r = await demarrer(id)
    expect(r.status).toBe(409)
    expect(r.body.erreur).toMatchObject({ code: 'testeurs_insuffisants', disponibles: 14 })
    expect((await pool.query('SELECT count(*)::int AS n FROM campagnes')).rows[0].n).toBe(0)
  })

  it('n’affecte que des testeurs validés, 15 apps au plus par testeur, et 3 téléphones identiques au plus', async () => {
    // 17 testeurs : 1 suspendu, et 4 avec le même téléphone dont un restera dehors.
    await creerTesteursValides(17, { modele: (i) => (i < 4 ? 'Tecno Spark 20' : `Modèle ${i}`) })
    await pool.query(`UPDATE utilisateurs SET statut = 'suspendu' WHERE nom = 'Testeur 15'`)
    const id = await appPrete()
    const { campagne } = (await demarrer(id)).body
    const { rows } = await pool.query(
      `SELECT u.nom, ap.modele FROM affectations a JOIN utilisateurs u ON u.id = a.testeur_id
         JOIN appareils ap ON ap.utilisateur_id = u.id WHERE a.campagne_id = $1`,
      [campagne.id],
    )
    expect(rows.map((r) => r.nom)).not.toContain('Testeur 15')
    expect(rows.filter((r) => r.modele === 'Tecno Spark 20')).toHaveLength(3)

    // Un testeur qui suit déjà 15 apps n'est plus choisi.
    const { rows: occupe } = await pool.query(`SELECT a.testeur_id FROM affectations a LIMIT 1`)
    for (let i = 0; i < 14; i++) {
      const pkg = `bj.charge.app${i}`
      const { rows: app } = await pool.query(
        `INSERT INTO apps (developpeur_id, nom, package, lien_test_ferme, description, instructions, fonctionnalites, connexion_requise, compte_play, statut)
         SELECT developpeur_id, nom, $1, lien_test_ferme, description, instructions, fonctionnalites, false, compte_play, 'validee' FROM apps LIMIT 1 RETURNING id`,
        [pkg],
      )
      await pool.query(
        `INSERT INTO affectations (campagne_id, app_id, testeur_id, affecte_le) VALUES ($1, $2, $3, now())`,
        [campagne.id, app[0].id, occupe[0].testeur_id],
      )
    }
    await creerTesteursValides(15, { debut: 100 })
    const deuxieme = await appPrete(autreApp('bj.studioawa.deux'))
    const r = await demarrer(deuxieme)
    expect(r.status).toBe(201)
    const { rows: affectes } = await pool.query('SELECT testeur_id FROM affectations a JOIN campagnes c ON c.id = a.campagne_id WHERE c.app_id = $1', [deuxieme])
    expect(affectes.map((a) => a.testeur_id)).not.toContain(occupe[0].testeur_id)
  })

  it('exporte les Gmail des testeurs en CSV (méthode de secours)', async () => {
    await creerTesteursValides(15)
    const id = await appPrete()
    await demarrer(id)
    const r = await request(test.app).get(`/api/apps/${id}/campagne/testeurs.csv`).set('Cookie', dev)
    expect(r.status).toBe(200)
    expect(r.headers['content-type']).toBe('text/csv; charset=utf-8')
    expect(r.headers['content-disposition']).toBe('attachment; filename="testeurs-bj.studioawa.marche.csv"')
    const lignes = r.text.trim().split('\n')
    expect(lignes[0]).toBe('gmail')
    expect(lignes).toHaveLength(16)
  })

  it('l’app d’un autre développeur répond 404', async () => {
    await creerTesteursValides(15)
    const id = await appPrete()
    await creerUtilisateur({ email: 'kofi@studio.bj', statut: 'valide' })
    const autre = await connecter('kofi@studio.bj')
    expect((await request(test.app).post(`/api/apps/${id}/campagne`).set('Cookie', autre)).status).toBe(404)
    expect((await request(test.app).get(`/api/apps/${id}/campagne`).set('Cookie', autre)).status).toBe(404)
  })
})

describe('suivi admin et remplacement (US-43)', () => {
  async function campagneDemarree() {
    await creerTesteursValides(17)
    const id = await appPrete()
    return (await demarrer(id)).body.campagne
  }

  it('liste les campagnes en cours et détaille les testeurs', async () => {
    const campagne = await campagneDemarree()
    const liste = await request(test.app).get('/api/admin/campagnes').set('Cookie', admin)
    expect(liste.status).toBe(200)
    expect(liste.body).toMatchObject({ total: 1, page: 1, parPage: 20 })
    expect(liste.body.campagnes[0]).toMatchObject({
      id: campagne.id,
      developpeur: { nom: 'Studio Awa', email: 'awa@studio.bj' },
      compteurs: { affectes: 15, inscritsConfirmes: 0 },
      remplacementPossible: true,
    })
    expect(liste.body.campagnes[0]).not.toHaveProperty('testeurs')

    const detail = await request(test.app).get(`/api/admin/campagnes/${campagne.id}`).set('Cookie', admin)
    expect(detail.body.campagne.testeurs[0]).toMatchObject({
      testeurId: expect.any(String),
      nom: expect.stringMatching(/^Testeur /),
      telephone: expect.stringMatching(/^\+229/),
      modele: expect.stringMatching(/^Modèle /),
      nombreRemises: 0,
      remplaceeLe: null,
    })
    expect((await request(test.app).get('/api/admin/campagnes?statut=inconnu').set('Cookie', admin)).status).toBe(422)
    expect((await request(test.app).get('/api/admin/campagnes').set('Cookie', dev)).status).toBe(403)
  })

  it('alerte quand les inscrits confirmés passent sous 13 à partir du 2e jour', async () => {
    const campagne = await campagneDemarree()
    await pool.query(`UPDATE affectations SET inscription_confirmee_le = now() WHERE id IN (SELECT id FROM affectations ORDER BY id LIMIT 12)`)
    test.avancer(24 * 60 * 60 * 1000)
    const r = await request(test.app).get(`/api/admin/campagnes/${campagne.id}`).set('Cookie', admin)
    expect(r.body.campagne).toMatchObject({ jour: 2, compteurs: { inscritsConfirmes: 12 }, alerteInscrits: true })
    await pool.query(`UPDATE affectations SET inscription_confirmee_le = now()`)
    const ok = await request(test.app).get(`/api/apps/${campagne.app.id}/campagne`).set('Cookie', dev)
    expect(ok.body.campagne.alerteInscrits).toBe(false)
  })

  it('remplace un testeur pendant les 2 premiers jours, puis plus', async () => {
    const campagne = await campagneDemarree()
    const sortant = campagne.testeurs[0]
    const url = `/api/admin/campagnes/${campagne.id}/affectations/${sortant.id}/remplacement`
    expect((await request(test.app).post(url).set('Cookie', admin).send({ motif: 'court' })).status).toBe(422)

    test.sms.vider()
    const r = await request(test.app).post(url).set('Cookie', admin).send({ motif: 'Ne s’est pas inscrit au test.' })
    expect(r.status).toBe(200)
    const testeurs = r.body.campagne.testeurs
    expect(testeurs).toHaveLength(16)
    expect(testeurs.find((t) => t.id === sortant.id)).toMatchObject({ statut: 'remplacee', motifRemplacement: 'Ne s’est pas inscrit au test.' })
    expect(r.body.campagne.compteurs.affectes).toBe(15)
    expect(test.sms.envoyes).toHaveLength(1)
    // Le développeur ne voit plus le testeur remplacé.
    const vueDev = await request(test.app).get(`/api/apps/${campagne.app.id}/campagne`).set('Cookie', dev)
    expect(vueDev.body.campagne.testeurs.map((t) => t.id)).not.toContain(sortant.id)

    const deja = await request(test.app).post(url).set('Cookie', admin).send({ motif: 'Ne s’est pas inscrit au test.' })
    expect(deja.body.erreur.code).toBe('statut_incompatible')

    test.avancer(2 * 24 * 60 * 60 * 1000)
    const tard = await request(test.app)
      .post(`/api/admin/campagnes/${campagne.id}/affectations/${campagne.testeurs[1].id}/remplacement`)
      .set('Cookie', admin)
      .send({ motif: 'Ne s’est pas inscrit au test.' })
    expect(tard.status).toBe(409)
    expect(tard.body.erreur.code).toBe('delai_depasse')
  })

  it('aucun remplaçant disponible : 409 et le testeur reste affecté', async () => {
    await creerTesteursValides(15)
    const id = await appPrete()
    const { campagne } = (await demarrer(id)).body
    const r = await request(test.app)
      .post(`/api/admin/campagnes/${campagne.id}/affectations/${campagne.testeurs[0].id}/remplacement`)
      .set('Cookie', admin)
      .send({ motif: 'Ne s’est pas inscrit au test.' })
    expect(r.status).toBe(409)
    expect(r.body.erreur.code).toBe('testeurs_insuffisants')
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM affectations WHERE statut = 'active'`)
    expect(rows[0].n).toBe(15)
  })
})
