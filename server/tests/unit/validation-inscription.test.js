import { describe, expect, it } from 'vitest'
import { normaliserLienFiche, validerLienFiche, validerNom, validerPays } from '../../src/lib/validation.js'

describe('règles de l’inscription développeur (§1.4)', () => {
  it('nom : 2 à 80 caractères', () => {
    expect(validerNom('')).toBe('requis')
    expect(validerNom('A')).toBe('trop_court')
    expect(validerNom('A'.repeat(81))).toBe('trop_long')
    expect(validerNom('Studio Awa')).toBeNull()
  })

  it('pays : code ISO connu', () => {
    expect(validerPays('')).toBe('requis')
    expect(validerPays('XX')).toBe('valeur_inconnue')
    expect(validerPays('BJ')).toBeNull()
  })

  it('remet en forme un lien de fiche collé sans https', () => {
    expect(normaliserLienFiche(' play.google.com/store/apps/dev?id=123 ')).toBe('https://play.google.com/store/apps/dev?id=123')
    expect(normaliserLienFiche('http://play.google.com/store/apps/dev?id=123')).toBe('https://play.google.com/store/apps/dev?id=123')
    expect(normaliserLienFiche(undefined)).toBe('')
  })

  it('n’accepte que les fiches développeur Google Play', () => {
    expect(validerLienFiche('')).toBe('requis')
    expect(validerLienFiche('https://play.google.com/store/apps/dev?id=1234567890')).toBeNull()
    expect(validerLienFiche('https://play.google.com/store/apps/developer?id=Studio+Awa&hl=fr')).toBeNull()
    expect(validerLienFiche('https://play.google.com/store/apps/details?id=bj.awa')).toBe('format_invalide')
    expect(validerLienFiche('https://exemple.com/store/apps/dev?id=1')).toBe('format_invalide')
    expect(validerLienFiche(`https://play.google.com/store/apps/dev?id=${'1'.repeat(300)}`)).toBe('trop_long')
  })
})
