import { describe, expect, it } from 'vitest'
import { empreinteReseau, reseauDeLAdresse } from '../../src/lib/reseaux.js'

// US-16 : empreinte du réseau Wi-Fi (docs/api-reseaux.md).
describe('empreinte du réseau', () => {
  it('garde l’IPv4 entière et le préfixe /64 d’une IPv6', () => {
    expect(reseauDeLAdresse('::ffff:197.234.10.4')).toBe('197.234.10.4')
    expect(reseauDeLAdresse('2c0f:f5c0:0441:0012:a1b2:c3d4:e5f6:0789')).toBe('2c0f:f5c0:441:12::/64')
    expect(reseauDeLAdresse('2c0f:f5c0:441:12::1')).toBe('2c0f:f5c0:441:12::/64')
    expect(reseauDeLAdresse('pas une adresse')).toBeNull()
  })

  it('deux téléphones d’une même box ont la même empreinte, sans que l’adresse soit lisible', () => {
    const a = empreinteReseau('2c0f:f5c0:441:12::1', 'secret')
    expect(a).toMatch(/^[0-9a-f]{32}$/)
    expect(empreinteReseau('2c0f:f5c0:441:12:ffff::2', 'secret')).toBe(a)
    expect(empreinteReseau('2c0f:f5c0:441:13::1', 'secret')).not.toBe(a)
    expect(empreinteReseau('197.234.10.4', 'autre secret')).not.toBe(empreinteReseau('197.234.10.4', 'secret'))
    expect(empreinteReseau('197.234.10.4', null)).toBeNull()
  })
})
