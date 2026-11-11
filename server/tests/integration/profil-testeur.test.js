import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { APPAREIL, cookieSession, creerTesteur, creerUtilisateur } from '../fabriques.js'
import { creerAppTest, pool, viderBase } from '../outils.js'

let test
let testeur
beforeEach(async () => {
  await viderBase()
  test = creerAppTest()
  testeur = await creerTesteur()
})

const moi = (jeton = testeur.jeton) => request(test.app).get('/api/testeurs/moi').set('Authorization', `Bearer ${jeton}`)
const modifier = (corps, jeton = testeur.jeton) =>
  request(test.app).patch('/api/testeurs/moi').set('Authorization', `Bearer ${jeton}`).send(corps)
const demander = (corps, jeton = testeur.jeton) =>
  request(test.app).post('/api/testeurs/moi/demande-changement-momo').set('Authorization', `Bearer ${jeton}`).send(corps)

const DEMANDE = { numeroMomo: '+2290195000000', operateurMomo: 'moov', motif: 'Mon ancien numéro MTN a été perdu.' }

describe('profil testeur (§4.4)', () => {
  it('renvoie le profil du testeur connecté', async () => {
    const r = await moi()
    expect(r.status).toBe(200)
    expect(r.body.utilisateur).toMatchObject({ id: testeur.id, gmail: 'koffi.agbo@gmail.com', langues: [], demandeChangementMomo: null })
  })

  it('répond 401 sans session et 403 pour un développeur', async () => {
    expect((await request(test.app).get('/api/testeurs/moi')).status).toBe(401)
    await creerUtilisateur({ email: 'awa@studio.bj' })
    const connexion = await request(test.app).post('/api/auth/connexion').send({ email: 'awa@studio.bj', motDePasse: 'motdepasse-valide' })
    const r = await request(test.app).get('/api/testeurs/moi').set('Cookie', cookieSession(connexion))
    expect(r.status).toBe(403)
  })

  it('enregistre les langues sans doublon', async () => {
    const r = await modifier({ langues: ['fr', 'fon', 'FR'] })
    expect(r.status).toBe(200)
    expect(r.body.utilisateur.langues).toEqual(['fr', 'fon'])
    expect((await moi()).body.utilisateur.langues).toEqual(['fr', 'fon'])
  })

  it('met à jour l’appareil affiché quand le modèle ou la version change', async () => {
    const r = await modifier({ appareil: { ...APPAREIL, versionAndroid: '15', niveauApi: 35 } })
    expect(r.body.utilisateur.appareil).toEqual({ fabricant: 'Tecno', modele: 'Spark 20', versionAndroid: '15', niveauApi: 35 })
    test.avancer(1000)
    const nouveau = await modifier({ appareil: { ...APPAREIL, identifiant: 'app-nouveau-tel', fabricant: 'Itel', modele: 'A70' } })
    expect(nouveau.body.utilisateur.appareil.modele).toBe('A70')
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM appareils')
    expect(rows[0].n).toBe(2)
  })

  it('refuse de modifier le numéro MoMo, le Gmail ou le téléphone (422 non_modifiable)', async () => {
    const r = await modifier({ numeroMomo: '+2290195000000', gmail: 'autre@gmail.com', telephone: '+2290191000000', operateurMomo: 'moov', langues: ['xx'] })
    expect(r.status).toBe(422)
    expect(r.body.erreur.champs).toEqual({
      numeroMomo: 'non_modifiable',
      gmail: 'non_modifiable',
      telephone: 'non_modifiable',
      operateurMomo: 'non_modifiable',
      langues: 'valeur_inconnue',
    })
    expect((await moi()).body.utilisateur.numeroMomo).toBe('+2290196000000')
  })

  it('valide l’appareil (422)', async () => {
    const r = await modifier({ appareil: { modele: '' } })
    expect(r.body.erreur.champs).toEqual({ appareil: 'format_invalide' })
  })
})

describe('demande de changement de numéro MoMo (§4.4)', () => {
  it('crée la demande et l’affiche dans le profil', async () => {
    const r = await demander({ ...DEMANDE, numeroMomo: '01 95 00 00 00' })
    expect(r.status).toBe(201)
    expect(r.body.demande).toEqual({
      id: expect.any(String),
      numeroMomo: '+2290195000000',
      operateurMomo: 'moov',
      statut: 'en_attente',
      creeLe: expect.any(String),
    })
    const profil = (await moi()).body.utilisateur
    expect(profil.demandeChangementMomo).toEqual(r.body.demande)
    expect(profil.numeroMomo).toBe('+2290196000000')
  })

  it('refuse une seconde demande tant que la première attend (409 statut_incompatible)', async () => {
    await demander(DEMANDE)
    const r = await demander({ ...DEMANDE, numeroMomo: '+2290194000000' })
    expect(r.status).toBe(409)
    expect(r.body.erreur.code).toBe('statut_incompatible')
  })

  it('valide les champs (422)', async () => {
    const r = await demander({ numeroMomo: '97', operateurMomo: 'celtiis', motif: 'court' })
    expect(r.body.erreur.champs).toEqual({ numeroMomo: 'format_invalide', operateurMomo: 'valeur_inconnue', motif: 'trop_court' })
  })

  it('refuse le numéro actuel avec le même opérateur', async () => {
    const r = await demander({ ...DEMANDE, numeroMomo: '+2290196000000', operateurMomo: 'mtn' })
    expect(r.status).toBe(422)
    expect(r.body.erreur.champs).toEqual({ numeroMomo: 'identique' })
  })

  it('refuse un numéro MoMo déjà utilisé par un autre testeur (409)', async () => {
    await creerTesteur({ telephone: '+2290191000000', gmail: 'awa@gmail.com', numeroMomo: '+2290195000000' })
    const r = await demander(DEMANDE)
    expect(r.status).toBe(409)
    expect(r.body.erreur.champs).toEqual({ numeroMomo: 'deja_utilise' })
  })
})
