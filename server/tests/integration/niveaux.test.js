import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { APP, cookieSession, creerTesteursValides, creerUtilisateur } from '../fabriques.js'
import { creerAppTest, pool, viderBase } from '../outils.js'

// US-38 : niveau du testeur dans son profil (docs/api-niveaux.md).
const TOUT = ['testeurs_ajoutes', 'fiche_complete', 'version_publiee', 'pays_coches', 'pas_de_test_interne', 'mises_a_jour_prevues']
let test
let dev
let appId

beforeEach(async () => {
  await viderBase()
  test = creerAppTest({ maintenant: '2026-11-12T09:00:00Z' })
  await creerUtilisateur({ email: 'awa@studio.bj', statut: 'valide' })
  await creerUtilisateur({ email: 'admin@nakayo.bj', role: 'admin', statut: 'valide' })
  const connexion = (email) => request(test.app).post('/api/auth/connexion').send({ email, motDePasse: 'motdepasse-valide' })
  dev = cookieSession(await connexion('awa@studio.bj'))
  const admin = cookieSession(await connexion('admin@nakayo.bj'))
  appId = (await request(test.app).post('/api/apps').set('Cookie', dev).send(APP)).body.app.id
  const { reference } = (await request(test.app).post(`/api/apps/${appId}/paiements`).set('Cookie', dev).send({ moyen: 'carte' })).body.paiement
  await request(test.app).post(`/api/paiements/${reference}/simulation`).set('Cookie', dev).send({ resultat: 'reussi' })
  await request(test.app).post(`/api/admin/apps/${appId}/validation`).set('Cookie', admin)
  await request(test.app).put(`/api/apps/${appId}/preparation`).set('Cookie', dev).send({ elements: TOUT })
})

const niveau = async (t) => (await request(test.app).get('/api/testeurs/moi').set({ Authorization: `Bearer ${t.jeton}` })).body.utilisateur.niveau

describe('niveau du testeur (US-38)', () => {
  it('passe Argent après une campagne menée au bout et compte les bugs acceptés', async () => {
    const [t] = await creerTesteursValides(15)
    await request(test.app).post(`/api/apps/${appId}/campagne`).set('Cookie', dev)
    expect(await niveau(t)).toMatchObject({ code: 'bronze', campagnesTerminees: 0 })

    await pool.query("UPDATE affectations SET statut = 'terminee' WHERE testeur_id = $1", [t.id])
    const { rows } = await pool.query('SELECT id, campagne_id, app_id FROM affectations WHERE testeur_id = $1', [t.id])
    await pool.query(
      `INSERT INTO bugs (affectation_id, campagne_id, app_id, testeur_id, titre, etapes, resultat_attendu, resultat_obtenu,
                         gravite, version_app, statut, signale_le, decide_le)
       VALUES ($1, $2, $3, $4, 'Panier vide', 'Ouvrir le panier puis payer', 'Le paiement', 'Un écran blanc',
               'genante', '1.0.0', 'accepte', now(), now())`,
      [rows[0].id, rows[0].campagne_id, rows[0].app_id, t.id],
    )

    expect(await niveau(t)).toEqual({
      code: 'argent',
      nom: 'Argent',
      campagnesTerminees: 1,
      bugsAcceptes: 1,
      assiduite: 66,
      suivant: {
        code: 'or',
        nom: 'Or',
        conditions: [
          { code: 'campagnes', requis: 3, actuel: 1, rempli: false },
          { code: 'bugs', requis: 2, actuel: 1, rempli: false },
          { code: 'assiduite', requis: 75, actuel: 66, rempli: false },
        ],
      },
    })
  })
})
