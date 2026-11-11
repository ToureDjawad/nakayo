import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { pool, viderBase } from '../outils.js'
import { demarrerServeur } from './serveur.js'

describe('contrôles automatiques sur le serveur réel', () => {
  let serveur
  beforeAll(async () => {
    await viderBase()
    serveur = await demarrerServeur()
  })
  afterAll(() => serveur?.arreter())

  it('enregistre les contrôles après l’inscription d’un développeur', async () => {
    const r = await fetch(`${serveur.url}/api/auth/inscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'awa@yopmail.com',
        motDePasse: 'une phrase assez longue',
        nom: 'Studio Awa',
        pays: 'BJ',
        lienFicheDeveloppeur: 'https://play.google.com/store/apps/dev?id=1234567890',
        accepteConditions: true,
      }),
    })
    expect(r.status).toBe(201)
    const { id } = (await r.json()).utilisateur

    let lignes = []
    for (let i = 0; i < 40; i++) {
      const { rows } = await pool.query(
        `SELECT c.code, c.resultat FROM controles_comptes c JOIN utilisateurs u ON u.id = c.utilisateur_id
          WHERE u.id = $1 AND u.controles_termines_le IS NOT NULL ORDER BY c.code`,
        [id],
      )
      lignes = rows
      if (lignes.length) break
      await new Promise((attente) => setTimeout(attente, 50))
    }
    expect(lignes).toEqual([
      { code: 'email_jetable', resultat: 'alerte' },
      // Le serveur de test ne sort pas sur Internet (CONTROLES_RESEAU désactivé).
      { code: 'fiche_play_accessible', resultat: 'indisponible' },
      { code: 'fiche_play_doublon', resultat: 'ok' },
    ])
  })
})
