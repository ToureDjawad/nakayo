import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { creerAdmin } from '../../src/services/admins.js'
import { pool, viderBase } from '../outils.js'
import { demarrerServeur } from './serveur.js'

describe('numéro WhatsApp du support sur le serveur réel', () => {
  let serveur
  const appel = (chemin, { methode = 'GET', corps, cookie } = {}) =>
    fetch(`${serveur.url}${chemin}`, {
      method: methode,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: corps ? JSON.stringify(corps) : undefined,
    })

  beforeAll(async () => {
    await viderBase()
    await creerAdmin(pool, { email: 'admin@nakayo.bj', motDePasse: 'admin-nakayo-2026' })
    serveur = await demarrerServeur({ CLIENT_URL: 'http://localhost:5173' })
  })
  afterAll(() => serveur?.arreter())

  it('l’admin enregistre puis publie le numéro, tout le monde le voit', async () => {
    const connexion = await appel('/api/auth/connexion', {
      methode: 'POST',
      corps: { email: 'admin@nakayo.bj', motDePasse: 'admin-nakayo-2026' },
    })
    const cookie = connexion.headers.getSetCookie()[0].split(';')[0]

    expect((await (await appel('/api/support')).json()).support.whatsapp).toBeNull()
    expect((await appel('/api/admin/support', { methode: 'PUT', corps: { whatsapp: '00229 01 97 00 00 00' }, cookie })).status).toBe(200)
    expect((await appel('/api/admin/support/publication', { methode: 'POST', cookie })).status).toBe(200)
    expect((await (await appel('/api/support')).json()).support.whatsapp).toBe('+2290197000000')
  })
})
