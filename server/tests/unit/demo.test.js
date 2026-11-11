import { inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { COMPTES_DEMO, MOT_DE_PASSE_DEMO, pngUni } from '../../src/services/demo.js'
import { validerEmail, validerMotDePasse } from '../../src/lib/validation.js'

describe('pngUni', () => {
  it('produit un PNG valide (signature, dimensions, fin de fichier standard)', () => {
    const png = pngUni(4, 3, [10, 20, 30])
    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    expect(png.readUInt32BE(16)).toBe(4)
    expect(png.readUInt32BE(20)).toBe(3)
    // Bloc IEND avec sa somme de contrôle CRC-32 standard.
    expect(png.subarray(-12).toString('hex')).toBe('0000000049454e44ae426082')
    const longueurIdat = png.readUInt32BE(33)
    const pixels = inflateSync(png.subarray(41, 41 + longueurIdat))
    expect(pixels).toHaveLength(3 * (1 + 4 * 3))
    expect([...pixels.subarray(1, 4)]).toEqual([10, 20, 30])
  })
})

describe('identifiants de démonstration', () => {
  it('respectent les règles de validation du site', () => {
    expect(validerMotDePasse(MOT_DE_PASSE_DEMO)).toBeNull()
    for (const { email } of COMPTES_DEMO) expect(validerEmail(email), email).toBeNull()
  })
})

describe('testeurs de démonstration', () => {
  it('ont des appareils acceptés par l’API, pour se connecter par SMS', async () => {
    const { lireAppareil, validerTelephone } = await import('../../src/lib/testeurs.js')
    const { TESTEURS_DEMO } = await import('../../src/services/demo.js')
    for (const t of TESTEURS_DEMO) {
      expect(lireAppareil(t.appareil).erreur, t.nom).toBeUndefined()
      expect(validerTelephone(t.telephone), t.nom).toBeFalsy()
    }
  })
})
