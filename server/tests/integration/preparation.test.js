import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { APP, cookieSession, creerUtilisateur } from '../fabriques.js'
import { creerAppTest, viderBase } from '../outils.js'

const TOUT = ['testeurs_ajoutes', 'fiche_complete', 'version_publiee', 'pays_coches', 'pas_de_test_interne', 'mises_a_jour_prevues']
let test
let dev
let appId

async function connecter(email) {
  return cookieSession(await request(test.app).post('/api/auth/connexion').send({ email, motDePasse: 'motdepasse-valide' }))
}
const preparer = (elements, id = appId, cookie = dev) =>
  request(test.app).put(`/api/apps/${id}/preparation`).set('Cookie', cookie).send({ elements })

async function payer(id) {
  const { reference } = (await request(test.app).post(`/api/apps/${id}/paiements`).set('Cookie', dev).send({ moyen: 'carte' })).body.paiement
  await request(test.app).post(`/api/paiements/${reference}/simulation`).set('Cookie', dev).send({ resultat: 'reussi' })
}

beforeEach(async () => {
  await viderBase()
  test = creerAppTest({ maintenant: '2026-11-12T09:00:00Z', config: { groupeTesteurs: 'testeurs@nakayo.test' } })
  await creerUtilisateur({ email: 'awa@studio.bj', statut: 'valide' })
  dev = await connecter('awa@studio.bj')
  appId = (await request(test.app).post('/api/apps').set('Cookie', dev).send(APP)).body.app.id
})

describe('préparation du lancement (US-42, US-13)', () => {
  it('donne la liste des points et l’adresse du groupe des testeurs', async () => {
    const r = await request(test.app).get(`/api/apps/${appId}/preparation`).set('Cookie', dev)
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ preparation: { elements: [], complete: false, completeLe: null }, elements: TOUT, groupeTesteurs: 'testeurs@nakayo.test' })
  })

  it('un brouillon ne se prépare pas encore (409)', async () => {
    const r = await preparer(['fiche_complete'])
    expect(r.status).toBe(409)
    expect(r.body.erreur).toMatchObject({ code: 'statut_incompatible', statut: 'brouillon' })
  })

  it('enregistre les points cochés ; complète quand tout est coché, et plus si l’on décoche', async () => {
    await payer(appId)
    const partiel = await preparer(['pays_coches', 'fiche_complete', 'pays_coches'])
    expect(partiel.status).toBe(200)
    expect(partiel.body.app.preparation).toEqual({ elements: ['fiche_complete', 'pays_coches'], complete: false, completeLe: null })

    test.avancer(60 * 1000)
    const complet = await preparer(TOUT)
    expect(complet.body.app.preparation).toEqual({ elements: TOUT, complete: true, completeLe: '2026-11-12T09:01:00.000Z' })

    const decoche = await preparer(TOUT.slice(1))
    expect(decoche.body.app.preparation.complete).toBe(false)
    expect(decoche.body.app.preparation.completeLe).toBeNull()
  })

  it('codes inconnus ou corps invalide : 422', async () => {
    await payer(appId)
    expect((await preparer(['inconnu'])).body.erreur.champs).toEqual({ elements: 'valeur_inconnue' })
    expect((await preparer('tout')).body.erreur.champs).toEqual({ elements: 'requis' })
  })

  it('l’app d’un autre développeur répond 404', async () => {
    await creerUtilisateur({ email: 'kofi@studio.bj', statut: 'valide' })
    const autre = await connecter('kofi@studio.bj')
    expect((await preparer(TOUT, appId, autre)).status).toBe(404)
    expect((await request(test.app).get(`/api/apps/${appId}/preparation`).set('Cookie', autre)).status).toBe(404)
  })

  it('sans groupe configuré, groupeTesteurs vaut null', async () => {
    const sans = creerAppTest({ maintenant: '2026-11-12T09:00:00Z' })
    const cookie = cookieSession(await request(sans.app).post('/api/auth/connexion').send({ email: 'awa@studio.bj', motDePasse: 'motdepasse-valide' }))
    expect((await request(sans.app).get(`/api/apps/${appId}/preparation`).set('Cookie', cookie)).body.groupeTesteurs).toBeNull()
  })
})
