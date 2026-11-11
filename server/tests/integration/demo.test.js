import { existsSync } from 'node:fs'
import path from 'node:path'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { COMPTES_DEMO, MOT_DE_PASSE_DEMO, remplirDemo, TESTEURS_DEMO } from '../../src/services/demo.js'
import { cookieSession } from '../fabriques.js'
import { creerAppTest, pool, viderBase } from '../outils.js'

const RAPIDE = { N: 2 ** 10, r: 8, p: 1 }
let test
beforeEach(async () => {
  await viderBase()
  test = creerAppTest()
})

const remplir = () => remplirDemo(pool, { dossierDocuments: test.dossierDocuments, parametresHachage: RAPIDE })
const connecter = (email) =>
  request(test.app).post('/api/auth/connexion').send({ email, motDePasse: MOT_DE_PASSE_DEMO })

describe('comptes de démonstration', () => {
  it('crée des comptes web utilisables avec le mot de passe du README', async () => {
    expect(await remplir()).toEqual({ comptes: COMPTES_DEMO.length, testeurs: TESTEURS_DEMO.length })
    for (const { email, statut } of COMPTES_DEMO.filter((c) => !c.emailNonVerifie)) {
      const reponse = await connecter(email)
      expect(reponse.status, email).toBe(200)
      expect(reponse.body.utilisateur.statut, email).toBe(statut)
    }
    // Compte prévu pour montrer le refus de connexion tant que l'email n'est pas confirmé.
    const nonVerifie = await connecter('dev.nonverifie@nakayo.test')
    expect(nonVerifie.status).toBe(403)
    expect(nonVerifie.body.erreur.code).toBe('email_non_verifie')
  })

  it('remplit la file admin avec des contrôles et de vraies photos', async () => {
    await remplir()
    const admin = cookieSession(await connecter('admin@nakayo.test'))
    const liste = await request(test.app).get('/api/admin/comptes').set('Cookie', admin)
    expect(liste.status).toBe(200)
    const testeur = liste.body.comptes.find((c) => c.role === 'testeur')
    expect(testeur).toBeDefined()
    expect(liste.body.comptes.filter((c) => c.role === 'testeur')).toHaveLength(TESTEURS_DEMO.length)
    expect(testeur.controles.etat).toBe('termine')
    expect(testeur.controles.liste.length).toBeGreaterThan(0)

    const photo = await request(test.app)
      .get(`/api/admin/comptes/${testeur.id}/documents/selfie`)
      .set('Cookie', admin)
    expect(photo.status).toBe(200)
    expect(photo.headers['content-type']).toMatch(/image\/png/)
  })

  it('peut être relancé : les anciens comptes et leurs photos sont remplacés', async () => {
    await remplir()
    const { rows: avant } = await pool.query("SELECT id FROM utilisateurs WHERE role = 'testeur' LIMIT 1")
    await remplir()
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM utilisateurs')
    expect(rows[0].n).toBe(COMPTES_DEMO.length + TESTEURS_DEMO.length)
    expect(existsSync(path.join(test.dossierDocuments, String(avant[0].id)))).toBe(false)
  })

  it('ne touche pas aux autres comptes', async () => {
    await pool.query(
      "INSERT INTO utilisateurs (email, mot_de_passe_hash, role, statut, nom) VALUES ('awa@studio.bj', 'x', 'developpeur', 'en_attente', 'Studio Awa')",
    )
    await remplir()
    await remplir()
    const { rows } = await pool.query("SELECT count(*)::int AS n FROM utilisateurs WHERE email = 'awa@studio.bj'")
    expect(rows[0].n).toBe(1)
  })
})
