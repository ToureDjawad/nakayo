import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { creerAdmin } from '../../src/services/admins.js'
import { creerUtilisateur } from '../fabriques.js'
import { pool, viderBase } from '../outils.js'
import { demarrerServeur } from './serveur.js'

describe('messages au support sur le serveur réel', () => {
  let serveur
  const appel = (chemin, { methode = 'GET', corps, cookie } = {}) =>
    fetch(`${serveur.url}${chemin}`, {
      method: methode,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: corps ? JSON.stringify(corps) : undefined,
    })
  async function connecter(email, motDePasse) {
    const r = await appel('/api/auth/connexion', { methode: 'POST', corps: { email, motDePasse } })
    return r.headers.getSetCookie()[0].split(';')[0]
  }

  beforeAll(async () => {
    await viderBase()
    await creerAdmin(pool, { email: 'admin@nakayo.bj', motDePasse: 'admin-nakayo-2026' })
    await creerUtilisateur({ email: 'awa@studio.bj', nom: 'Studio Awa' })
    serveur = await demarrerServeur({ CLIENT_URL: 'http://localhost:5173' })
  })
  afterAll(() => serveur?.arreter())

  it('le développeur écrit, l’admin lit puis traite, le développeur voit le statut', async () => {
    const dev = await connecter('awa@studio.bj', 'motdepasse-valide')
    const envoi = await appel('/api/tickets', {
      methode: 'POST',
      corps: { sujet: 'Question sur la campagne', message: 'Bonjour, quand puis-je lancer ma campagne ?' },
      cookie: dev,
    })
    expect(envoi.status).toBe(201)
    const { ticket } = await envoi.json()

    const admin = await connecter('admin@nakayo.bj', 'admin-nakayo-2026')
    const liste = await (await appel('/api/admin/tickets', { cookie: admin })).json()
    expect(liste.tickets.map((t) => t.sujet)).toEqual(['Question sur la campagne'])
    expect((await appel(`/api/admin/tickets/${ticket.id}/traitement`, { methode: 'POST', cookie: admin })).status).toBe(200)

    const historique = await (await appel('/api/tickets/moi', { cookie: dev })).json()
    expect(historique.tickets[0].statut).toBe('traite')
  })
})
