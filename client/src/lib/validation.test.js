import { describe, expect, it } from 'vitest'
import { PAYS, nomPays } from './pays.js'
import { normaliserLienFiche, validerEmail, validerLienFiche, validerMotDePasse, validerNom } from './validation.js'

describe('validation', () => {
  it('vérifie les emails', () => {
    expect(validerEmail('')).toBe('requis')
    expect(validerEmail('  ')).toBe('requis')
    expect(validerEmail('awa@')).toBe('format_invalide')
    expect(validerEmail(`${'a'.repeat(250)}@b.co`)).toBe('trop_long')
    expect(validerEmail(' awa@studio.bj ')).toBeNull()
  })

  it('vérifie la longueur du mot de passe', () => {
    expect(validerMotDePasse('')).toBe('requis')
    expect(validerMotDePasse('123456789')).toBe('trop_court')
    expect(validerMotDePasse('1234567890')).toBeNull()
    expect(validerMotDePasse('x'.repeat(129))).toBe('trop_long')
  })

  it('vérifie le nom', () => {
    expect(validerNom(' a ')).toBe('trop_court')
    expect(validerNom('x'.repeat(81))).toBe('trop_long')
    expect(validerNom('Studio Awa')).toBeNull()
  })

  it('accepte les deux formats de fiche développeur Google Play', () => {
    expect(validerLienFiche('https://play.google.com/store/apps/dev?id=1234567890')).toBeNull()
    expect(validerLienFiche('https://play.google.com/store/apps/developer?id=Studio+Awa')).toBeNull()
    expect(validerLienFiche('https://play.google.com/store/apps/dev?id=123&hl=fr')).toBeNull()
  })

  it('refuse les liens qui ne sont pas des fiches développeur', () => {
    expect(validerLienFiche('')).toBe('requis')
    expect(validerLienFiche('https://play.google.com/store/apps/details?id=bj.awa.app')).toBe('format_invalide')
    expect(validerLienFiche('https://exemple.com/store/apps/dev?id=1')).toBe('format_invalide')
    expect(validerLienFiche('https://play.google.com/store/apps/dev?id=')).toBe('format_invalide')
  })

  it('complète un lien collé sans https', () => {
    expect(normaliserLienFiche(' play.google.com/store/apps/dev?id=1 ')).toBe('https://play.google.com/store/apps/dev?id=1')
    expect(normaliserLienFiche('http://play.google.com/store/apps/dev?id=1')).toBe('https://play.google.com/store/apps/dev?id=1')
  })
})

describe('pays', () => {
  it('donne un nom français à chaque code', () => {
    expect(nomPays('BJ')).toBe('Bénin')
    for (const p of PAYS) expect(p.nom).not.toBe(p.code)
  })

  it('trie la liste dans l’ordre alphabétique français', () => {
    const noms = PAYS.map((p) => p.nom)
    expect([...noms].sort((a, b) => a.localeCompare(b, 'fr'))).toEqual(noms)
  })
})
