import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { APP, cookieSession, creerTesteursValides, creerUtilisateur } from '../fabriques.js'
import { creerAppTest, pool, viderBase } from '../outils.js'

// US-43 : un Groupe Google par app, créé et rempli sans action du développeur (docs/groupes-google.md).
const TOUT = ['testeurs_ajoutes', 'fiche_complete', 'version_publiee', 'pays_coches', 'pas_de_test_interne', 'mises_a_jour_prevues']
let test
let dev
let admin
let appId
let groupes

function fauxGroupes({ enPanne = false } = {}) {
  const membres = new Map()
  return {
    domaine: 'groupes.nakayo.test',
    crees: [],
    membres,
    enPanne,
    async creerGroupe({ adresse, nom }) {
      if (this.enPanne) throw new Error('Google injoignable')
      this.crees.push({ adresse, nom })
      membres.set(adresse, new Set())
    },
    async ajouterMembre(adresse, email) {
      if (this.enPanne) throw new Error('Google injoignable')
      membres.get(adresse).add(email)
    },
    async retirerMembre(adresse, email) {
      membres.get(adresse).delete(email)
    },
  }
}

async function preparer(options) {
  groupes = fauxGroupes(options)
  test = creerAppTest({ maintenant: '2026-11-12T09:00:00Z', groupes, config: { groupeTesteurs: 'testeurs@nakayo.test' } })
  await creerUtilisateur({ email: 'awa@studio.bj', statut: 'valide' })
  await creerUtilisateur({ email: 'admin@nakayo.bj', role: 'admin', statut: 'valide' })
  const connexion = (email) => request(test.app).post('/api/auth/connexion').send({ email, motDePasse: 'motdepasse-valide' })
  dev = cookieSession(await connexion('awa@studio.bj'))
  admin = cookieSession(await connexion('admin@nakayo.bj'))
  await creerTesteursValides(16)
  appId = (await request(test.app).post('/api/apps').set('Cookie', dev).send(APP)).body.app.id
  const { reference } = (await request(test.app).post(`/api/apps/${appId}/paiements`).set('Cookie', dev).send({ moyen: 'carte' })).body.paiement
  await request(test.app).post(`/api/paiements/${reference}/simulation`).set('Cookie', dev).send({ resultat: 'reussi' })
  await request(test.app).post(`/api/admin/apps/${appId}/validation`).set('Cookie', admin)
}

const preparation = () => request(test.app).get(`/api/apps/${appId}/preparation`).set('Cookie', dev)
const synchro = () => test.app.locals.deps.synchroGroupes.lancer()

beforeEach(viderBase)

describe('Groupes Google des campagnes (US-43)', () => {
  it('crée le groupe à la préparation, puis y met les testeurs au démarrage et au remplacement', async () => {
    await preparer()
    const adresse = `nakayo-app-${appId}@groupes.nakayo.test`
    expect((await preparation()).body.groupeTesteurs).toBe(adresse)
    expect((await preparation()).body.groupeTesteurs).toBe(adresse)
    expect(groupes.crees).toEqual([{ adresse, nom: 'Testeurs Nakayo · Marché Facile' }])

    await request(test.app).put(`/api/apps/${appId}/preparation`).set('Cookie', dev).send({ elements: TOUT })
    const demarrage = await request(test.app).post(`/api/apps/${appId}/campagne`).set('Cookie', dev)
    expect(demarrage.status).toBe(201)
    expect(demarrage.body.campagne.groupeGoogle).toBe(adresse)
    await synchro()
    const { rows: actives } = await pool.query(
      `SELECT a.id, p.gmail FROM affectations a JOIN profils_testeurs p ON p.utilisateur_id = a.testeur_id WHERE a.app_id = $1 ORDER BY a.id`,
      [appId],
    )
    expect([...groupes.membres.get(adresse)].sort()).toEqual(actives.map((a) => a.gmail).sort())

    // Remplacement par l'admin : le sortant quitte le groupe, le remplaçant y entre.
    const campagneId = demarrage.body.campagne.id
    const r = await request(test.app)
      .post(`/api/admin/campagnes/${campagneId}/affectations/${actives[0].id}/remplacement`)
      .set('Cookie', admin)
      .send({ motif: 'Inscription au test jamais faite.' })
    expect(r.status).toBe(200)
    await synchro()
    const membres = groupes.membres.get(adresse)
    expect(membres.has(actives[0].gmail)).toBe(false)
    expect(membres.size).toBe(actives.length)
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM affectations WHERE app_id = $1 AND groupe_retire_le IS NOT NULL', [appId])
    expect(rows[0].n).toBe(1)
  })

  it('garde le groupe unique si Google ne répond pas, et reprend les ajouts au passage suivant', async () => {
    await preparer({ enPanne: true })
    expect((await preparation()).body.groupeTesteurs).toBe('testeurs@nakayo.test')
    groupes.enPanne = false
    const adresse = (await preparation()).body.groupeTesteurs
    expect(adresse).toBe(`nakayo-app-${appId}@groupes.nakayo.test`)

    await request(test.app).put(`/api/apps/${appId}/preparation`).set('Cookie', dev).send({ elements: TOUT })
    groupes.enPanne = true
    await request(test.app).post(`/api/apps/${appId}/campagne`).set('Cookie', dev)
    await synchro()
    expect(groupes.membres.get(adresse).size).toBe(0)
    groupes.enPanne = false
    await synchro()
    expect(groupes.membres.get(adresse).size).toBe(15)
  })
})
