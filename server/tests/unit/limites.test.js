import { describe, expect, it } from 'vitest'
import { ErreurHttp } from '../../src/lib/erreurs.js'
import { creerLimiteur } from '../../src/lib/limites.js'

describe('creerLimiteur()', () => {
  it('bloque au-delà du maximum puis libère après la fenêtre', () => {
    let t = 0
    const limiteur = creerLimiteur({ max: 2, fenetreMs: 60000, maintenant: () => t })
    limiteur.consommer('a')
    limiteur.consommer('a')
    let erreur
    try {
      limiteur.consommer('a')
    } catch (e) {
      erreur = e
    }
    expect(erreur).toBeInstanceOf(ErreurHttp)
    expect(erreur.statut).toBe(429)
    expect(erreur.retryAfter).toBe(60)

    limiteur.consommer('b')
    t = 60001
    expect(() => limiteur.consommer('a')).not.toThrow()
  })

  it('calcule le délai depuis la plus ancienne tentative', () => {
    let t = 0
    const limiteur = creerLimiteur({ max: 1, fenetreMs: 10000, maintenant: () => t })
    limiteur.consommer('a')
    t = 7500
    expect(() => limiteur.consommer('a')).toThrow(expect.objectContaining({ retryAfter: 3 }))
  })

  it('peut vérifier sans compter, puis compter seulement les échecs', () => {
    const limiteur = creerLimiteur({ max: 1, fenetreMs: 1000, maintenant: () => 0 })
    limiteur.verifier('a')
    limiteur.verifier('a')
    limiteur.compter('a')
    expect(() => limiteur.verifier('a')).toThrow(ErreurHttp)
    limiteur.effacer('a')
    expect(() => limiteur.verifier('a')).not.toThrow()
  })
})
