import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { viderBase } from '../outils.js'
import { demarrerServeur } from './serveur.js'

describe('inscription d’un développeur sur le serveur réel', () => {
  let serveur
  const post = (chemin, corps, cookie) =>
    fetch(`${serveur.url}${chemin}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify(corps ?? {}),
    })

  beforeAll(async () => {
    await viderBase()
    serveur = await demarrerServeur({ CLIENT_URL: 'http://localhost:5173' })
  })
  afterAll(() => serveur?.arreter())

  it('inscription, lien reçu par email, vérification, session, puis reconnexion', async () => {
    const inscription = await post('/api/auth/inscription', {
      email: 'awa@studio.bj',
      motDePasse: 'une phrase assez longue',
      nom: 'Studio Awa',
      pays: 'BJ',
      lienFicheDeveloppeur: 'https://play.google.com/store/apps/dev?id=1234567890',
      accepteConditions: true,
    })
    expect(inscription.status).toBe(201)

    // Avant la vérification, la connexion est refusée avec un code dédié.
    const tropTot = await post('/api/auth/connexion', { email: 'awa@studio.bj', motDePasse: 'une phrase assez longue' })
    expect((await tropTot.json()).erreur.code).toBe('email_non_verifie')

    let lien = null
    for (let i = 0; i < 20 && !lien; i++) {
      lien = serveur.dernier(/http:\/\/localhost:5173\/verification-email\?jeton=([A-Za-z0-9_-]+)/g)
      if (!lien) await new Promise((r) => setTimeout(r, 50))
    }
    expect(lien).not.toBeNull()

    const verification = await post('/api/auth/verification-email', { jeton: lien[1] })
    expect(verification.status).toBe(200)
    const cookie = verification.headers.getSetCookie()[0].split(';')[0]

    const moi = await fetch(`${serveur.url}/api/auth/moi`, { headers: { Cookie: cookie } })
    expect((await moi.json()).utilisateur).toMatchObject({ statut: 'en_attente', emailVerifie: true })

    expect((await post('/api/auth/deconnexion', null, cookie)).status).toBe(204)
    const connexion = await post('/api/auth/connexion', { email: 'awa@studio.bj', motDePasse: 'une phrase assez longue' })
    expect(connexion.status).toBe(200)
  })
})
