import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { APP, cookieSession, creerTesteursValides, creerUtilisateur } from '../fabriques.js'
import { creerAppTest, pool, viderBase } from '../outils.js'

// US-44 : nouvelle version annoncée aux testeurs (docs/nouvelle-version.md).
const TOUT = ['testeurs_ajoutes', 'fiche_complete', 'version_publiee', 'pays_coches', 'pas_de_test_interne', 'mises_a_jour_prevues']
const CHANGEMENTS = 'Le panier ne se vide plus quand on change d’écran.'
let test
let admin
let dev
let appId
let testeurs

const bearer = (t) => ({ Authorization: `Bearer ${t.jeton}` })
const annoncer = (corps) => request(test.app).post(`/api/apps/${appId}/campagne/versions`).set('Cookie', dev).send(corps)

beforeEach(async () => {
  await viderBase()
  test = creerAppTest({ maintenant: '2026-11-12T09:00:00Z' })
  await creerUtilisateur({ email: 'awa@studio.bj', statut: 'valide' })
  await creerUtilisateur({ email: 'admin@nakayo.bj', role: 'admin', statut: 'valide' })
  const connexion = (email) => request(test.app).post('/api/auth/connexion').send({ email, motDePasse: 'motdepasse-valide' })
  dev = cookieSession(await connexion('awa@studio.bj'))
  admin = cookieSession(await connexion('admin@nakayo.bj'))
  testeurs = await creerTesteursValides(15)
  appId = (await request(test.app).post('/api/apps').set('Cookie', dev).send(APP)).body.app.id
  const { reference } = (await request(test.app).post(`/api/apps/${appId}/paiements`).set('Cookie', dev).send({ moyen: 'carte' })).body.paiement
  await request(test.app).post(`/api/paiements/${reference}/simulation`).set('Cookie', dev).send({ resultat: 'reussi' })
  await request(test.app).post(`/api/admin/apps/${appId}/validation`).set('Cookie', admin)
  await request(test.app).put(`/api/apps/${appId}/preparation`).set('Cookie', dev).send({ elements: TOUT })
  await request(test.app).post(`/api/apps/${appId}/campagne`).set('Cookie', dev)
})

describe('nouvelle version (US-44)', () => {
  it('annonce : SMS aux inscrits, rappel dans l’app jusqu’au premier rapport sur la version', async () => {
    const [t] = testeurs
    await pool.query("UPDATE affectations SET inscription_confirmee_le = now() WHERE testeur_id = $1", [t.id])
    test.sms.envoyes.length = 0

    expect((await annoncer({ numero: '', changements: 'court' })).body.erreur.champs).toEqual({ numero: 'requis', changements: 'trop_court' })
    test.avancer(2 * 24 * 60 * 60 * 1000)
    const r = await annoncer({ numero: '1.0.3', changements: CHANGEMENTS })
    expect(r.status).toBe(201)
    expect(r.body.versions).toEqual([{ numero: '1.0.3', changements: CHANGEMENTS, annonceeLe: '2026-11-14T09:00:00.000Z', jourCampagne: 3, testeursSurVersion: 0 }])
    expect((await annoncer({ numero: '1.0.3', changements: CHANGEMENTS })).body.erreur.champs).toEqual({ numero: 'deja_utilise' })

    // Seul le testeur inscrit est prévenu.
    expect(test.sms.envoyes.map((s) => s.a)).toEqual(['+2290197000000'])
    expect(test.sms.envoyes[0].texte).toContain('nouvelle version (1.0.3)')

    const app = async () => (await request(test.app).get('/api/testeurs/moi/apps').set(bearer(t))).body.apps[0]
    expect((await app()).nouvelleVersion).toEqual({ numero: '1.0.3', changements: CHANGEMENTS, annonceeLe: '2026-11-14T09:00:00.000Z' })

    const { rows } = await pool.query('SELECT id FROM affectations WHERE testeur_id = $1', [t.id])
    await pool.query(
      `INSERT INTO rapports (affectation_id, testeur_id, jour, actions, note, bug, fonctionnalites, version_app, latitude, longitude, recu_le)
       VALUES ($1, $2, '2026-11-14', 'J’ai vérifié le panier, il reste plein.', 5, false, ARRAY['Panier'], '1.0.3', 6.37, 2.42, now())`,
      [rows[0].id, t.id],
    )
    expect((await app()).nouvelleVersion).toBeNull()
    const versions = await request(test.app).get(`/api/apps/${appId}/campagne/versions`).set('Cookie', dev)
    expect(versions.body.versions[0].testeursSurVersion).toBe(1)
  })

  it('reprise dans le brouillon du rapport final ; pas d’annonce hors du test', async () => {
    await annoncer({ numero: '1.0.3', changements: CHANGEMENTS })
    await pool.query("UPDATE campagnes SET statut = 'terminee', terminee_le = now()")
    test.avancer(15 * 24 * 60 * 60 * 1000)
    const rapport = (await request(test.app).get(`/api/apps/${appId}/campagne/rapport`).set('Cookie', dev)).body.rapport
    expect(rapport.bilan.versionsAnnoncees).toHaveLength(1)
    const reponses = rapport.brouillon.parties.flatMap((p) => p.questions)
    expect(reponses.find((q) => q.id === 'changements').reponse).toContain(`- 1.0.3 (jour 1) : ${CHANGEMENTS} Vérifiée par 0 testeur.`)
    expect((await request(test.app).get(`/api/apps/${appId}/campagne/rapport.pdf`).set('Cookie', dev)).status).toBe(200)
    expect((await annoncer({ numero: '1.0.4', changements: CHANGEMENTS })).body.erreur.code).toBe('statut_incompatible')
  })
})
