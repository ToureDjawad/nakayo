import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { cookieSession, creerUtilisateur } from '../fabriques.js'
import { creerAppTest, pool, viderBase } from '../outils.js'

let test
let admin
beforeEach(async () => {
  await viderBase()
  test = creerAppTest({ maintenant: '2026-11-12T09:00:00Z' })
  await creerUtilisateur({ email: 'admin@nakayo.bj', role: 'admin', statut: 'valide', motDePasse: 'admin-nakayo-2026' })
  admin = await connecter('admin@nakayo.bj', 'admin-nakayo-2026')
})

async function connecter(email, motDePasse = 'motdepasse-valide') {
  return cookieSession(await request(test.app).post('/api/auth/connexion').send({ email, motDePasse }))
}
const lirePublic = () => request(test.app).get('/api/support')
const lireAdmin = (cookie = admin) => request(test.app).get('/api/admin/support').set('Cookie', cookie)
const enregistrer = (whatsapp, cookie = admin) =>
  request(test.app).put('/api/admin/support').set('Cookie', cookie).send({ whatsapp })
const publier = (cookie = admin) => request(test.app).post('/api/admin/support/publication').set('Cookie', cookie)
const retirer = (cookie = admin) => request(test.app).delete('/api/admin/support/publication').set('Cookie', cookie)

describe('contact du support (§11)', () => {
  it('rien de publié au départ', async () => {
    const r = await lirePublic()
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ support: { whatsapp: null } })
    expect(r.headers['cache-control']).toBe('public, max-age=60')
    expect((await lireAdmin()).body).toEqual({
      support: { whatsapp: null, whatsappPublie: null, modifieLe: null, publieLe: null },
    })
  })

  it('enregistrer ne publie pas, publier rend le numéro visible, retirer le cache', async () => {
    const e = await enregistrer('+229 01 97 00 00 00')
    expect(e.status).toBe(200)
    expect(e.body.support).toEqual({
      whatsapp: '+2290197000000',
      whatsappPublie: null,
      modifieLe: '2026-11-12T09:00:00.000Z',
      publieLe: null,
    })
    expect((await lirePublic()).body.support.whatsapp).toBeNull()

    const p = await publier()
    expect(p.status).toBe(200)
    expect(p.body.support).toMatchObject({ whatsappPublie: '+2290197000000', publieLe: '2026-11-12T09:00:00.000Z' })
    expect((await lirePublic()).body.support.whatsapp).toBe('+2290197000000')

    // Un nouveau numéro enregistré ne remplace le numéro publié qu'après publication.
    await enregistrer('+2290196000000')
    expect((await lirePublic()).body.support.whatsapp).toBe('+2290197000000')
    await publier()
    expect((await lirePublic()).body.support.whatsapp).toBe('+2290196000000')

    const r = await retirer()
    expect(r.status).toBe(200)
    expect(r.body.support).toMatchObject({ whatsapp: '+2290196000000', whatsappPublie: null })
    expect((await lirePublic()).body.support.whatsapp).toBeNull()

    const { rows } = await pool.query('SELECT modifie_par, publie_par FROM contact_support')
    expect(rows).toHaveLength(1)
    expect(rows[0].modifie_par).toBe(rows[0].publie_par)
  })

  it('publier sans numéro enregistré : 409 rien_a_publier', async () => {
    const r = await publier()
    expect(r.status).toBe(409)
    expect(r.body.erreur.code).toBe('rien_a_publier')
  })

  it('numéro invalide : 422', async () => {
    const r = await enregistrer('97 00 00 00')
    expect(r.status).toBe(422)
    expect(r.body.erreur.champs).toEqual({ whatsapp: 'format_invalide' })
    expect((await enregistrer(undefined)).body.erreur.champs).toEqual({ whatsapp: 'requis' })
  })

  it('réservé aux admins', async () => {
    await creerUtilisateur({ email: 'awa@studio.bj', statut: 'valide' })
    const dev = await connecter('awa@studio.bj')
    expect((await request(test.app).get('/api/admin/support')).status).toBe(401)
    expect((await lireAdmin(dev)).status).toBe(403)
    expect((await enregistrer('+2290197000000', dev)).status).toBe(403)
    expect((await publier(dev)).status).toBe(403)
    expect((await retirer(dev)).status).toBe(403)
  })
})
