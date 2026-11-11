import { describe, expect, it } from 'vitest'
import {
  lireAppareil,
  lireLangues,
  normaliserGmail,
  normaliserTelephone,
  typeImage,
  validerCodeSms,
  validerGmail,
  validerMotifMomo,
  validerOperateur,
  validerTelephone,
  validerVille,
} from '../../src/lib/testeurs.js'

const APPAREIL = { fabricant: 'Tecno', modele: 'Spark 20', versionAndroid: '14', niveauApi: 34, identifiant: '8f3c2b1a9d' }

describe('téléphone béninois', () => {
  it('remet en forme les saisies courantes', () => {
    expect(normaliserTelephone('01 97 00 00 00')).toBe('+2290197000000')
    expect(normaliserTelephone('229 01-97-00-00-00')).toBe('+2290197000000')
    expect(normaliserTelephone('002290197000000')).toBe('+2290197000000')
    expect(normaliserTelephone(' +2290197000000 ')).toBe('+2290197000000')
  })

  it('exige +229 puis 10 chiffres commençant par 01', () => {
    expect(validerTelephone('')).toBe('requis')
    expect(validerTelephone('+2290197000000')).toBeNull()
    expect(validerTelephone('+22997000000')).toBe('format_invalide')
    expect(validerTelephone('+2330197000000')).toBe('format_invalide')
  })
})

describe('Gmail', () => {
  it('n’accepte que @gmail.com', () => {
    expect(validerGmail('')).toBe('requis')
    expect(validerGmail('koffi@yahoo.fr')).toBe('non_gmail')
    expect(validerGmail('koffi')).toBe('format_invalide')
    expect(validerGmail('kof fi@gmail.com')).toBe('format_invalide')
    expect(validerGmail('koffi.agbo@gmail.com')).toBeNull()
  })

  it('normalise comme Gmail : sans points ni suffixe +', () => {
    expect(normaliserGmail('K.offi.Agbo+test@gmail.com')).toBe('koffiagbo@gmail.com')
  })
})

describe('autres champs', () => {
  it('ville, opérateur et code SMS', () => {
    expect(validerVille('C')).toBe('trop_court')
    expect(validerVille('Cotonou')).toBeNull()
    expect(validerOperateur('celtiis')).toBe('valeur_inconnue')
    expect(validerOperateur('moov')).toBeNull()
    expect(validerCodeSms('12345')).toBe('format_invalide')
    expect(validerCodeSms('012345')).toBeNull()
  })

  it('lit l’appareil en objet ou en JSON', () => {
    expect(lireAppareil(APPAREIL).appareil).toEqual(APPAREIL)
    expect(lireAppareil(JSON.stringify(APPAREIL)).appareil).toEqual(APPAREIL)
    expect(lireAppareil({ ...APPAREIL, versionAndroid: 14 }).appareil.versionAndroid).toBe('14')
    expect(lireAppareil(undefined).erreur).toBe('requis')
    expect(lireAppareil('{pas du json').erreur).toBe('format_invalide')
    expect(lireAppareil({ ...APPAREIL, niveauApi: '34' }).erreur).toBe('format_invalide')
    expect(lireAppareil({ ...APPAREIL, identifiant: 'court' }).erreur).toBe('format_invalide')
  })

  it('reconnaît JPEG et PNG à leurs premiers octets', () => {
    expect(typeImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
    expect(typeImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe('image/png')
    expect(typeImage(Buffer.from('GIF89a'))).toBeNull()
    expect(typeImage(Buffer.from('<svg>'))).toBeNull()
  })
})

describe('profil testeur (US-10)', () => {
  it('langues : 1 à 10 codes connus, sans doublon', () => {
    expect(lireLangues(['fr', 'FON', 'fr']).langues).toEqual(['fr', 'fon'])
    expect(lireLangues([]).erreur).toBe('requis')
    expect(lireLangues('fr').erreur).toBe('format_invalide')
    expect(lireLangues(['fr', 'de']).erreur).toBe('valeur_inconnue')
    expect(lireLangues([1]).erreur).toBe('format_invalide')
  })

  it('motif de changement MoMo : 10 à 300 caractères', () => {
    expect(validerMotifMomo('')).toBe('requis')
    expect(validerMotifMomo('court')).toBe('trop_court')
    expect(validerMotifMomo('x'.repeat(301))).toBe('trop_long')
    expect(validerMotifMomo('Numéro perdu avec mon ancien téléphone.')).toBeNull()
  })
})
