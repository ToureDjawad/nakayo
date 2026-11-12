import { describe, expect, it } from 'vitest'
import { normaliserWhatsapp, validerWhatsapp } from '../../src/services/support.js'

describe('numéro WhatsApp du support (US-40)', () => {
  it('nettoie les séparateurs et remplace 00 par +', () => {
    expect(normaliserWhatsapp(' +229 01 97 00-00.00 ')).toBe('+2290197000000')
    expect(normaliserWhatsapp('00229 (01) 97000000')).toBe('+2290197000000')
    expect(normaliserWhatsapp(42)).toBe('')
  })

  it('exige le format international', () => {
    expect(validerWhatsapp('')).toBe('requis')
    expect(validerWhatsapp('0197000000')).toBe('format_invalide')
    expect(validerWhatsapp('+0197000000')).toBe('format_invalide')
    expect(validerWhatsapp('+229019700000000000')).toBe('format_invalide')
    expect(validerWhatsapp('+22901abc0000')).toBe('format_invalide')
    expect(validerWhatsapp('+2290197000000')).toBeNull()
    expect(validerWhatsapp('+33612345678')).toBeNull()
  })
})
