import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { creerAdmin } from '../../src/services/admins.js'
import { pool, viderBase } from '../outils.js'
import { demarrerServeur } from './serveur.js'

describe('validation des comptes par un admin sur le serveur réel', () => {
  let serveur
  const appel = async (chemin, { corps, cookie } = {}) =>
    fetch(`${serveur.url}${chemin}`, {
      method: corps ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: corps ? JSON.stringify(corps) : undefined,
    })
  const cookieDe = (r) => r.headers.getSetCookie()[0].split(';')[0]

  async function lien(motif) {
    for (let i = 0; i < 40; i++) {
      const trouve = serveur.dernier(motif)
      if (trouve) return trouve[1]
      await new Promise((r) => setTimeout(r, 50))
    }
    throw new Error('Lien absent du journal')
  }

  beforeAll(async () => {
    await viderBase()
    await creerAdmin(pool, { email: 'admin@nakayo.bj', motDePasse: 'admin-nakayo-2026' })
    serveur = await demarrerServeur({ CLIENT_URL: 'http://localhost:5173' })
  })
  afterAll(() => serveur?.arreter())

  it('un développeur s’inscrit, l’admin le refuse avec un motif, le développeur le voit', async () => {
    await appel('/api/auth/inscription', {
      corps: {
        email: 'awa@studio.bj',
        motDePasse: 'une phrase assez longue',
        nom: 'Studio Awa',
        pays: 'BJ',
        lienFicheDeveloppeur: 'https://play.google.com/store/apps/dev?id=1234567890',
        accepteConditions: true,
      },
    })
    const jeton = await lien(/verification-email\?jeton=([A-Za-z0-9_-]+)/g)
    const dev = cookieDe(await appel('/api/auth/verification-email', { corps: { jeton } }))

    const admin = cookieDe(
      await appel('/api/auth/connexion', { corps: { email: 'admin@nakayo.bj', motDePasse: 'admin-nakayo-2026' } }),
    )
    const liste = await (await appel('/api/admin/comptes', { cookie: admin })).json()
    expect(liste.total).toBe(1)
    const [compte] = liste.comptes
    expect(compte.developpeur.email).toBe('awa@studio.bj')

    const refus = await appel(`/api/admin/comptes/${compte.id}/refus`, {
      corps: { motif: 'La fiche Google Play indiquée n’existe pas.' },
      cookie: admin,
    })
    expect(refus.status).toBe(200)
    expect((await appel(`/api/admin/comptes/${compte.id}/validation`, { corps: {}, cookie: admin })).status).toBe(409)

    const moi = await (await appel('/api/auth/moi', { cookie: dev })).json()
    expect(moi.utilisateur).toMatchObject({ statut: 'refuse', motifRefus: 'La fiche Google Play indiquée n’existe pas.' })
    expect((await (await appel('/api/admin/comptes', { cookie: admin })).json()).total).toBe(0)
  })
})
