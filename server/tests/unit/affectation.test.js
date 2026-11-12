import { describe, expect, it } from 'vitest'
import { assiduite, choisirTesteurs } from '../../src/lib/affectation.js'
import { ajouterJours, debutJourBenin, ecartJours, jourBenin } from '../../src/lib/temps.js'

const candidat = (id, autres = {}) => ({
  id: String(id),
  ville: 'Cotonou',
  operateur: 'mtn',
  modele: `Modèle ${id}`,
  actives: 0,
  terminees: 0,
  remplacees: 0,
  remises: 0,
  ...autres,
})

describe('assiduité', () => {
  it('un nouveau testeur part à 0,5 ; les campagnes terminées font monter, les remises baisser', () => {
    expect(assiduite({})).toBe(0.5)
    expect(assiduite({ terminees: 3 })).toBeCloseTo(0.8)
    expect(assiduite({ terminees: 1, remises: 2 })).toBeCloseTo(0.4)
  })
})

describe('choix des testeurs (US-16)', () => {
  it('prend les plus assidus d’abord, puis ceux qui ont le moins d’apps en cours', () => {
    const choisis = choisirTesteurs(
      [candidat(1), candidat(2, { terminees: 4 }), candidat(3, { actives: 5 }), candidat(4, { remplacees: 2 })],
      { nombre: 3 },
    )
    expect(choisis.map((c) => c.id)).toEqual(['2', '1', '3'])
  })

  it('écarte un testeur qui suit déjà 15 apps', () => {
    expect(choisirTesteurs([candidat(1, { actives: 15 }), candidat(2)], { nombre: 2 }).map((c) => c.id)).toEqual(['2'])
  })

  it('jamais plus de 3 testeurs avec le même modèle de téléphone, même en manque de candidats', () => {
    const memes = Array.from({ length: 6 }, (_, i) => candidat(i + 1, { modele: 'Tecno Spark 20' }))
    expect(choisirTesteurs(memes, { nombre: 5 })).toHaveLength(3)
    // Le modèle compte aussi les testeurs déjà dans la campagne (remplacement), sans tenir compte de la casse.
    const deja = [{ modele: 'tecno spark 20' }, { modele: 'Tecno Spark 20 ' }, { modele: 'TECNO SPARK 20' }]
    expect(choisirTesteurs(memes, { nombre: 1, deja })).toEqual([])
  })

  it('répartit les villes et les opérateurs quand c’est possible, sinon complète quand même', () => {
    const cotonou = Array.from({ length: 10 }, (_, i) => candidat(i + 1, { terminees: 2 }))
    const parakou = Array.from({ length: 5 }, (_, i) => candidat(i + 20, { ville: 'Parakou', operateur: 'moov' }))
    const choisis = choisirTesteurs([...cotonou, ...parakou], { nombre: 10 })
    // Cotonou est plus assidue, mais ne dépasse pas la moitié de la campagne.
    expect(choisis.filter((c) => c.ville === 'Cotonou')).toHaveLength(5)
    expect(choisis).toHaveLength(10)

    const seuleVille = choisirTesteurs(cotonou, { nombre: 8 })
    expect(seuleVille).toHaveLength(8)
  })
})

describe('calendrier du Bénin (UTC+1)', () => {
  it('change de jour à minuit au Bénin, soit 23 h UTC', () => {
    expect(jourBenin('2026-11-12T22:59:59Z')).toBe('2026-11-12')
    expect(jourBenin('2026-11-12T23:00:00Z')).toBe('2026-11-13')
    expect(debutJourBenin('2026-11-13').toISOString()).toBe('2026-11-12T23:00:00.000Z')
    expect(ajouterJours('2026-12-31', 1)).toBe('2027-01-01')
    expect(ecartJours('2026-11-12', '2026-11-28')).toBe(16)
  })
})
