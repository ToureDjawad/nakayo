import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { cookieSession, creerTesteur, creerUtilisateur } from '../fabriques.js'
import { creerAppTest, viderBase } from '../outils.js'

let test
let admin
let dev
let testeur
beforeEach(async () => {
  await viderBase()
  test = creerAppTest({ maintenant: '2026-11-12T09:00:00Z' })
  await creerUtilisateur({ email: 'admin@nakayo.bj', role: 'admin', statut: 'valide', motDePasse: 'admin-nakayo-2026' })
  admin = await connecter('admin@nakayo.bj', 'admin-nakayo-2026')
  await creerUtilisateur({ email: 'awa@studio.bj', nom: 'Studio Awa' })
  dev = await connecter('awa@studio.bj')
  testeur = await creerTesteur()
})

async function connecter(email, motDePasse = 'motdepasse-valide') {
  return cookieSession(await request(test.app).post('/api/auth/connexion').send({ email, motDePasse }))
}
const MESSAGE = { sujet: 'Fiche Google Play', message: 'Bonjour, ma fiche a changé de nom, que dois-je faire ?' }
const envoyerDev = (corps = MESSAGE, cookie = dev) => request(test.app).post('/api/tickets').set('Cookie', cookie).send(corps)
const envoyerTesteur = (corps = MESSAGE) =>
  request(test.app).post('/api/tickets').set('Authorization', `Bearer ${testeur.jeton}`).send(corps)
const lister = (query = '', cookie = admin) => request(test.app).get(`/api/admin/tickets${query}`).set('Cookie', cookie)
const traiter = (id, cookie = admin) => request(test.app).post(`/api/admin/tickets/${id}/traitement`).set('Cookie', cookie)

describe('envoi d’un message au support (§12.1)', () => {
  it('un développeur envoie un message et le retrouve dans son historique', async () => {
    const r = await envoyerDev()
    expect(r.status).toBe(201)
    expect(r.body.ticket).toEqual({
      id: expect.any(String),
      sujet: 'Fiche Google Play',
      message: MESSAGE.message,
      statut: 'ouvert',
      creeLe: '2026-11-12T09:00:00.000Z',
      traiteLe: null,
    })
    const h = await request(test.app).get('/api/tickets/moi').set('Cookie', dev)
    expect(h.status).toBe(200)
    expect(h.body.tickets).toEqual([r.body.ticket])
  })

  it('un testeur envoie un message depuis l’app (Bearer)', async () => {
    const r = await envoyerTesteur()
    expect(r.status).toBe(201)
    const h = await request(test.app).get('/api/tickets/moi').set('Authorization', `Bearer ${testeur.jeton}`)
    expect(h.body.tickets).toHaveLength(1)
    // Chacun ne voit que ses propres messages.
    expect((await request(test.app).get('/api/tickets/moi').set('Cookie', dev)).body.tickets).toEqual([])
  })

  it('champs invalides : 422', async () => {
    const r = await envoyerDev({ sujet: 'a', message: '' })
    expect(r.status).toBe(422)
    expect(r.body.erreur.champs).toEqual({ sujet: 'trop_court', message: 'requis' })
  })

  it('5 messages par heure au plus', async () => {
    // Un message refusé pour un champ invalide ne compte pas.
    expect((await envoyerDev({ sujet: '', message: '' })).status).toBe(422)
    for (let i = 0; i < 5; i++) expect((await envoyerDev()).status).toBe(201)
    const r = await envoyerDev()
    expect(r.status).toBe(429)
    expect(Number(r.headers['retry-after'])).toBeGreaterThan(0)
    test.avancer(60 * 60 * 1000 + 1000)
    expect((await envoyerDev()).status).toBe(201)
  })

  it('sans session : 401 ; un admin n’envoie pas de message : 403', async () => {
    expect((await request(test.app).post('/api/tickets').send(MESSAGE)).status).toBe(401)
    expect((await envoyerDev(MESSAGE, admin)).status).toBe(403)
  })
})

describe('messages dans le back-office (§12.2)', () => {
  it('liste les messages ouverts du plus ancien au plus récent, avec leur auteur', async () => {
    const a = (await envoyerDev({ sujet: 'Premier', message: 'Premier message envoyé.' })).body.ticket
    test.avancer(60 * 1000)
    const b = (await envoyerTesteur({ sujet: 'Second', message: 'Second message envoyé.' })).body.ticket

    const r = await lister()
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ total: 2, page: 1, parPage: 20 })
    expect(r.body.tickets.map((t) => t.id)).toEqual([a.id, b.id])
    expect(r.body.tickets[0].auteur).toMatchObject({ role: 'developpeur', nom: 'Studio Awa', email: 'awa@studio.bj', telephone: null })
    expect(r.body.tickets[1].auteur).toMatchObject({ role: 'testeur', nom: 'Koffi Agbo', email: null })
    expect(r.body.tickets[1].auteur.telephone).toMatch(/^\+229/)
  })

  it('marquer comme traité, une seule fois', async () => {
    const t = (await envoyerDev()).body.ticket
    test.avancer(5 * 60 * 1000)
    const r = await traiter(t.id)
    expect(r.status).toBe(200)
    expect(r.body.ticket).toMatchObject({ id: t.id, statut: 'traite', traiteLe: '2026-11-12T09:05:00.000Z' })

    expect((await lister()).body).toMatchObject({ total: 0, tickets: [] })
    expect((await lister('?statut=traite')).body.tickets.map((x) => x.id)).toEqual([t.id])
    const encore = await traiter(t.id)
    expect(encore.status).toBe(409)
    expect(encore.body.erreur).toMatchObject({ code: 'statut_incompatible', statut: 'traite' })
    // L'auteur voit que son message a été traité.
    expect((await request(test.app).get('/api/tickets/moi').set('Cookie', dev)).body.tickets[0].statut).toBe('traite')
  })

  it('message inconnu : 404 ; filtres invalides : 422', async () => {
    expect((await traiter(999)).status).toBe(404)
    expect((await traiter('abc')).status).toBe(404)
    const r = await lister('?statut=ferme&page=0')
    expect(r.status).toBe(422)
    expect(r.body.erreur.champs).toEqual({ statut: 'valeur_inconnue', page: 'format_invalide' })
  })

  it('réservé aux admins', async () => {
    expect((await request(test.app).get('/api/admin/tickets')).status).toBe(401)
    expect((await lister('', dev)).status).toBe(403)
    expect((await traiter(1, dev)).status).toBe(403)
  })
})
