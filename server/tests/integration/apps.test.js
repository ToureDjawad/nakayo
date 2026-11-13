import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { APP, cookieSession, creerTesteur, creerUtilisateur } from '../fabriques.js'
import { creerAppTest, pool, viderBase } from '../outils.js'

let test
let dev
beforeEach(async () => {
  await viderBase()
  test = creerAppTest({ maintenant: '2026-11-12T09:00:00Z' })
  await creerUtilisateur({ email: 'awa@studio.bj', statut: 'valide' })
  dev = await connecter('awa@studio.bj')
})

async function connecter(email) {
  return cookieSession(await request(test.app).post('/api/auth/connexion').send({ email, motDePasse: 'motdepasse-valide' }))
}
const soumettre = (corps = APP, cookie = dev) => request(test.app).post('/api/apps').set('Cookie', cookie).send(corps)
const modifier = (id, corps, cookie = dev) => request(test.app).put(`/api/apps/${id}`).set('Cookie', cookie).send(corps)

describe('soumission d’une app (§1.3)', () => {
  it('un développeur validé soumet son app : elle reste en brouillon', async () => {
    const r = await soumettre({ ...APP, lienTestFerme: 'play.google.com/apps/testing/bj.studioawa.marche' })
    expect(r.status).toBe(201)
    expect(r.body.app).toEqual({
      id: expect.any(String),
      ...APP,
      identifiantsTest: null,
      testObligatoire: true,
      statut: 'brouillon',
      offre: 'standard',
      motifRefus: null,
      preparation: { elements: [], complete: false, completeLe: null },
      campagne: null,
      creeLe: '2026-11-12T09:00:00.000Z',
      modifieLe: '2026-11-12T09:00:00.000Z',
    })
    const liste = await request(test.app).get('/api/apps').set('Cookie', dev)
    expect(liste.body.apps).toEqual([r.body.app])
    const detail = await request(test.app).get(`/api/apps/${r.body.app.id}`).set('Cookie', dev)
    expect(detail.body.app).toEqual(r.body.app)
  })

  it('compte organisation ou personnel ancien : pas de test obligatoire', async () => {
    const r = await soumettre({ ...APP, comptePlay: 'organisation' })
    expect(r.body.app.testObligatoire).toBe(false)
  })

  it('champs invalides : 422 avec le détail par champ', async () => {
    const r = await soumettre({ ...APP, lienTestFerme: 'https://play.google.com/apps/testing/com.autre.app', fonctionnalites: ['Panier'] })
    expect(r.status).toBe(422)
    expect(r.body.erreur.champs).toEqual({ lienTestFerme: 'ne_correspond_pas', fonctionnalites: 'trop_peu' })
  })

  it('un package déjà inscrit (même casse différente) est refusé en 409', async () => {
    await soumettre()
    await creerUtilisateur({ email: 'kofi@studio.bj', statut: 'valide' })
    const autre = await connecter('kofi@studio.bj')
    const r = await soumettre(
      { ...APP, package: 'BJ.StudioAwa.Marche', lienTestFerme: 'https://play.google.com/apps/testing/BJ.StudioAwa.Marche' },
      autre,
    )
    expect(r.status).toBe(409)
    expect(r.body.erreur).toMatchObject({ code: 'conflit', champs: { package: 'deja_utilise' } })
  })

  it('une app refusée libère son package', async () => {
    const { body } = await soumettre()
    await pool.query(`UPDATE apps SET statut = 'refusee', motif_refus = 'App interdite.' WHERE id = $1`, [body.app.id])
    expect((await soumettre()).status).toBe(201)
  })

  it('compte en attente de validation : 403 compte_non_valide, mais la liste reste lisible', async () => {
    await creerUtilisateur({ email: 'attente@studio.bj' })
    const enAttente = await connecter('attente@studio.bj')
    const r = await soumettre(APP, enAttente)
    expect(r.status).toBe(403)
    expect(r.body.erreur.code).toBe('compte_non_valide')
    expect((await request(test.app).get('/api/apps').set('Cookie', enAttente)).body.apps).toEqual([])
  })

  it('testeur, admin et visiteur n’y ont pas accès', async () => {
    const testeur = await creerTesteur()
    expect((await request(test.app).get('/api/apps').set('Authorization', `Bearer ${testeur.jeton}`)).status).toBe(403)
    await creerUtilisateur({ email: 'admin@nakayo.bj', role: 'admin', statut: 'valide' })
    expect((await request(test.app).get('/api/apps').set('Cookie', await connecter('admin@nakayo.bj'))).status).toBe(403)
    expect((await request(test.app).get('/api/apps')).status).toBe(401)
  })

  it('au plus 10 apps soumises par heure ; une soumission invalide ne compte pas', async () => {
    await soumettre({ nom: '' })
    for (let i = 0; i < 10; i++) {
      const pkg = `bj.studioawa.app${i}`
      expect((await soumettre({ ...APP, package: pkg, lienTestFerme: `https://play.google.com/apps/testing/${pkg}` })).status).toBe(201)
    }
    const r = await soumettre({ ...APP, package: 'bj.studioawa.de.trop', lienTestFerme: 'https://play.google.com/apps/testing/bj.studioawa.de.trop' })
    expect(r.status).toBe(429)
    test.avancer(60 * 60 * 1000)
    expect((await soumettre({ ...APP, package: 'bj.studioawa.de.trop', lienTestFerme: 'https://play.google.com/apps/testing/bj.studioawa.de.trop' })).status).toBe(201)
  })
})

describe('modification et suppression d’un brouillon (§1.4)', () => {
  it('modifie un brouillon et met à jour modifieLe', async () => {
    const { body } = await soumettre()
    test.avancer(60 * 1000)
    const r = await modifier(body.app.id, { ...APP, connexionRequise: true, identifiantsTest: 'Compte : test@marche.bj\nMot de passe : marche2026' })
    expect(r.status).toBe(200)
    expect(r.body.app).toMatchObject({
      connexionRequise: true,
      identifiantsTest: 'Compte : test@marche.bj\nMot de passe : marche2026',
      creeLe: '2026-11-12T09:00:00.000Z',
      modifieLe: '2026-11-12T09:01:00.000Z',
    })
  })

  it('garder son propre package n’est pas un conflit, prendre celui d’une autre app oui', async () => {
    const { body: a } = await soumettre()
    await soumettre({ ...APP, package: 'bj.studioawa.autre', lienTestFerme: 'https://play.google.com/apps/testing/bj.studioawa.autre' })
    expect((await modifier(a.app.id, { ...APP, nom: 'Marché Facile 2' })).status).toBe(200)
    const r = await modifier(a.app.id, { ...APP, package: 'bj.studioawa.autre', lienTestFerme: 'https://play.google.com/apps/testing/bj.studioawa.autre' })
    expect(r.status).toBe(409)
    expect(r.body.erreur.champs).toEqual({ package: 'deja_utilise' })
  })

  it('une app sortie du brouillon ne se modifie plus et ne se supprime plus', async () => {
    const { body } = await soumettre()
    await pool.query(`UPDATE apps SET statut = 'en_verification' WHERE id = $1`, [body.app.id])
    const r = await modifier(body.app.id, APP)
    expect(r.status).toBe(409)
    expect(r.body.erreur).toMatchObject({ code: 'statut_incompatible', statut: 'en_verification' })
    expect((await request(test.app).delete(`/api/apps/${body.app.id}`).set('Cookie', dev)).status).toBe(409)
  })

  it('supprime un brouillon', async () => {
    const { body } = await soumettre()
    expect((await request(test.app).delete(`/api/apps/${body.app.id}`).set('Cookie', dev)).status).toBe(204)
    expect((await request(test.app).get(`/api/apps/${body.app.id}`).set('Cookie', dev)).status).toBe(404)
  })

  it('l’app d’un autre développeur ou un identifiant invalide répond 404', async () => {
    const { body } = await soumettre()
    await creerUtilisateur({ email: 'kofi@studio.bj', statut: 'valide' })
    const autre = await connecter('kofi@studio.bj')
    expect((await request(test.app).get(`/api/apps/${body.app.id}`).set('Cookie', autre)).status).toBe(404)
    expect((await modifier(body.app.id, APP, autre)).status).toBe(404)
    expect((await request(test.app).delete(`/api/apps/${body.app.id}`).set('Cookie', autre)).status).toBe(404)
    expect((await request(test.app).get('/api/apps/abc').set('Cookie', dev)).status).toBe(404)
    expect((await request(test.app).get(`/api/apps/${body.app.id}`).set('Cookie', dev)).status).toBe(200)
  })
})
