import { describe, expect, it } from 'vitest'
import { niveauTesteur, rangNiveau } from '../../src/lib/niveaux.js'

// US-38 : niveaux Bronze, Argent et Or (docs/api-niveaux.md).
describe('niveaux des testeurs', () => {
  it('Bronze au départ, Argent après une campagne menée au bout', () => {
    expect(rangNiveau({})).toBe(0)
    expect(rangNiveau({ terminees: 1 })).toBe(1)
    expect(niveauTesteur({ terminees: 1 })).toMatchObject({ code: 'argent', nom: 'Argent', campagnesTerminees: 1, assiduite: 66 })
  })

  it('Or avec 3 campagnes, 2 bugs acceptés et 75 % d’assiduité', () => {
    expect(rangNiveau({ terminees: 3, bugsAcceptes: 2 })).toBe(2)
    // Trop de remplacements : l'assiduité tombe sous 75 %, le testeur reste Argent.
    expect(rangNiveau({ terminees: 3, bugsAcceptes: 2, remplacees: 1 })).toBe(1)
    expect(rangNiveau({ terminees: 5, bugsAcceptes: 2, remplacees: 1 })).toBe(2)
    expect(niveauTesteur({ terminees: 3, bugsAcceptes: 4 })).toMatchObject({ code: 'or', suivant: null })
  })

  it('on ne saute pas Argent : des bugs sans campagne menée au bout laissent en Bronze', () => {
    expect(rangNiveau({ bugsAcceptes: 5 })).toBe(0)
  })

  it('donne le chemin vers le niveau suivant', () => {
    expect(niveauTesteur({ terminees: 2, bugsAcceptes: 1, remises: 1 }).suivant).toEqual({
      code: 'or',
      nom: 'Or',
      conditions: [
        { code: 'campagnes', requis: 3, actuel: 2, rempli: false },
        { code: 'bugs', requis: 2, actuel: 1, rempli: false },
        { code: 'assiduite', requis: 75, actuel: 60, rempli: false },
      ],
    })
  })
})
