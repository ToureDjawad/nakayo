import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { demarrerServeur } from './serveur.js'

describe('serveur réel', () => {
  let serveur
  beforeAll(async () => {
    serveur = await demarrerServeur()
  })
  afterAll(() => serveur?.arreter())

  it('démarre, répond et parle le format d’erreur du contrat', async () => {
    const sante = await fetch(`${serveur.url}/api/health`)
    expect(await sante.json()).toEqual({ api: 'ok', base: 'ok' })

    const r = await fetch(`${serveur.url}/api/inconnue`)
    expect(r.status).toBe(404)
    expect((await r.json()).erreur.code).toBe('introuvable')
  })
})
