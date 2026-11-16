import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { APP, cookieSession, creerTesteursValides, creerUtilisateur } from '../fabriques.js'
import { creerAppTest, pool, viderBase } from '../outils.js'

// US-31 : fiche d'un testeur pour l'admin (docs/fiche-testeur.md).
const TOUT = ['testeurs_ajoutes', 'fiche_complete', 'version_publiee', 'pays_coches', 'pas_de_test_interne', 'mises_a_jour_prevues']
let test
let admin
let dev
let testeurs

const historique = (id, query = '') => request(test.app).get(`/api/admin/testeurs/${id}/historique${query}`).set('Cookie', admin)

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

describe('fiche testeur (US-31)', () => {
  it('jours, connexions, temps, rapports, positions et alertes de la campagne', async () => {
    const appId = (await request(test.app).post('/api/apps').set('Cookie', dev).send(APP)).body.app.id
    const { reference } = (await request(test.app).post(`/api/apps/${appId}/paiements`).set('Cookie', dev).send({ moyen: 'carte' })).body.paiement
    await request(test.app).post(`/api/paiements/${reference}/simulation`).set('Cookie', dev).send({ resultat: 'reussi' })
    await request(test.app).post(`/api/admin/apps/${appId}/validation`).set('Cookie', admin)
    await request(test.app).put(`/api/apps/${appId}/preparation`).set('Cookie', dev).send({ elements: TOUT })
    await request(test.app).post(`/api/apps/${appId}/campagne`).set('Cookie', dev)
    const [t] = testeurs
    const { rows } = await pool.query('SELECT id FROM affectations WHERE testeur_id = $1', [t.id])
    const aff = rows[0].id
    await pool.query(
      `INSERT INTO rapports (affectation_id, testeur_id, jour, actions, note, bug, fonctionnalites, version_app, latitude, longitude, recu_le)
       VALUES ($1, $2, '2026-11-13', 'J’ai cherché du riz et payé.', 4, false, ARRAY['Panier'], '1.0.2', 6.37, 2.42, '2026-11-13T19:00:00Z')`,
      [aff, t.id],
    )
    await pool.query("INSERT INTO connexions_compagnon (testeur_id, jour, premiere_le, derniere_le, nombre) VALUES ($1, '2026-11-13', '2026-11-13T08:00:00Z', '2026-11-13T19:00:00Z', 3)", [t.id])
    await pool.query("INSERT INTO usages_quotidiens (affectation_id, jour, secondes, maj_le) VALUES ($1, '2026-11-13', 420, now())", [aff])
    await pool.query("INSERT INTO journees (affectation_id, jour, connexion, usage_secondes, rapport, valide, verifie_le) VALUES ($1, '2026-11-13', true, 420, true, true, now())", [aff])
    await pool.query("INSERT INTO alertes_fraude (code, cle, testeur_ids, detail, creee_le) VALUES ('usage_nul', 'x', ARRAY[$1::bigint], 'Test.', now())", [t.id])
    test.avancer(2 * 24 * 60 * 60 * 1000)

    const r = await historique(t.id)
    expect(r.status).toBe(200)
    expect(r.body.testeur).toMatchObject({ id: t.id, statut: 'valide', niveau: { code: 'bronze' } })
    expect(r.body.affectations).toHaveLength(1)
    expect(r.body.affectations[0]).toMatchObject({ app: 'Marché Facile', statut: 'active', joursExiges: 14 })
    expect(r.body.affectation).toBe(String(aff))
    expect(r.body.jours.map((j) => j.jour)).toEqual(['2026-11-12', '2026-11-13', '2026-11-14'])
    expect(r.body.jours[1]).toEqual({
      jour: '2026-11-13',
      connexion: { premiere: '2026-11-13T08:00:00.000Z', derniere: '2026-11-13T19:00:00.000Z', nombre: 3 },
      usageSecondes: 420,
      rapport: true,
      valide: true,
    })
    expect(r.body.jours[0]).toMatchObject({ connexion: null, usageSecondes: 0, rapport: false, valide: null })
    expect(r.body.rapports).toEqual([
      expect.objectContaining({ jour: '2026-11-13', actions: 'J’ai cherché du riz et payé.', position: { latitude: 6.37, longitude: 2.42 }, versionApp: '1.0.2', bug: null }),
    ])
    expect(r.body.alertes).toEqual([expect.objectContaining({ libelle: expect.any(String), statut: 'ouverte' })])
  })

  it('testeur sans campagne, inconnu, ou campagne d’un autre testeur ; réservé aux admins', async () => {
    const r = await historique(testeurs[0].id)
    expect(r.body).toMatchObject({ affectations: [], affectation: null, jours: [], rapports: [] })
    expect((await historique('999999')).status).toBe(404)
    expect((await historique(testeurs[0].id, '?affectation=42')).status).toBe(404)
    expect((await request(test.app).get(`/api/admin/testeurs/${testeurs[0].id}/historique`).set('Cookie', dev)).status).toBe(403)
  })
})
