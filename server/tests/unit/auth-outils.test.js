import { describe, expect, it } from 'vitest'
import { lireCookie } from '../../src/lib/cookies.js'
import { genererJeton, hacherJeton } from '../../src/lib/jetons.js'
import { versUtilisateurApi } from '../../src/lib/utilisateurs.js'
import { exigerChamps, normaliserEmail, validerEmail, validerMotDePasse } from '../../src/lib/validation.js'
import { jetonDeLaRequete } from '../../src/middlewares/authentification.js'

describe('jetons', () => {
  it('génère des jetons longs, différents et sûrs dans une URL', () => {
    const a = genererJeton()
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(genererJeton()).not.toBe(a)
  })

  it('stocke une empreinte SHA-256 de 32 octets', () => {
    expect(hacherJeton('abc')).toHaveLength(32)
    expect(hacherJeton('abc').equals(hacherJeton('abc'))).toBe(true)
  })
})

describe('cookies et en-têtes', () => {
  it('lit le cookie demandé parmi d’autres', () => {
    const req = { headers: { cookie: 'theme=clair; nakayo_session=abc%2Dd; autre=1' } }
    expect(lireCookie(req, 'nakayo_session')).toBe('abc-d')
    expect(lireCookie(req, 'absent')).toBeNull()
    expect(lireCookie({ headers: {} }, 'nakayo_session')).toBeNull()
    expect(lireCookie({ headers: { cookie: 'nakayo_session=%E0%A4%A' } }, 'nakayo_session')).toBeNull()
  })

  it('préfère le jeton Bearer (Android) au cookie (web)', () => {
    expect(jetonDeLaRequete({ headers: { authorization: 'Bearer xyz', cookie: 'nakayo_session=abc' } })).toBe('xyz')
    expect(jetonDeLaRequete({ headers: { cookie: 'nakayo_session=abc' } })).toBe('abc')
    expect(jetonDeLaRequete({ headers: { authorization: 'Basic xyz' } })).toBeNull()
  })
})

describe('validation', () => {
  it('nettoie et met en minuscules les emails', () => {
    expect(normaliserEmail('  Awa@Studio.BJ ')).toBe('awa@studio.bj')
    expect(normaliserEmail(42)).toBe('')
  })

  it('applique les règles du contrat', () => {
    expect(validerEmail('')).toBe('requis')
    expect(validerEmail('awa@studio')).toBe('format_invalide')
    expect(validerEmail(`${'a'.repeat(250)}@x.bj`)).toBe('trop_long')
    expect(validerEmail('awa@studio.bj')).toBeNull()
    expect(validerMotDePasse(undefined)).toBe('requis')
    expect(validerMotDePasse('123456789')).toBe('trop_court')
    expect(validerMotDePasse('x'.repeat(129))).toBe('trop_long')
    expect(validerMotDePasse('          ')).toBeNull()
  })

  it('lève une 422 avec seulement les champs en erreur', () => {
    expect(() => exigerChamps({ email: null })).not.toThrow()
    try {
      exigerChamps({ email: 'requis', motDePasse: null })
      throw new Error('aurait dû lever')
    } catch (e) {
      expect(e.statut).toBe(422)
      expect(e.champs).toEqual({ email: 'requis' })
    }
  })
})

describe('objet utilisateur', () => {
  it('suit le contrat §1.5 sans exposer le mot de passe', () => {
    const api = versUtilisateurApi({
      id: 42n,
      role: 'developpeur',
      statut: 'refuse',
      email: 'awa@studio.bj',
      nom: 'Studio Awa',
      pays: 'BJ',
      lien_fiche_developpeur: null,
      motif_refus: 'Fiche introuvable sur Google Play.',
      email_verifie_le: new Date(),
      cree_le: new Date('2026-11-10T14:07:01.512Z'),
      mot_de_passe_hash: 'scrypt$...',
    })
    expect(api).toEqual({
      id: '42',
      role: 'developpeur',
      statut: 'refuse',
      emailVerifie: true,
      email: 'awa@studio.bj',
      nom: 'Studio Awa',
      pays: 'BJ',
      lienFicheDeveloppeur: null,
      motifRefus: 'Fiche introuvable sur Google Play.',
      creeLe: '2026-11-10T14:07:01.512Z',
    })
  })
})
