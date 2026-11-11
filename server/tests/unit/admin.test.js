import { describe, expect, it } from 'vitest'
import { lireFiltres, messageDecision, validerMotifRefus } from '../../src/routes/admin.js'

describe('filtres de la liste admin (§5.1)', () => {
  it('applique les valeurs par défaut', () => {
    expect(lireFiltres({})).toEqual({ statut: 'en_attente', role: '', du: '', au: '', tri: 'ancien', page: 1, parPage: 20 })
  })

  it('signale chaque paramètre invalide', () => {
    try {
      lireFiltres({ statut: 'x', role: 'admin', du: '2026-02-30', au: '11/11/2026', tri: 'nom', page: '0', parPage: '51' })
      throw new Error('aurait dû lever')
    } catch (e) {
      expect(e.champs).toEqual({
        statut: 'valeur_inconnue',
        role: 'valeur_inconnue',
        du: 'format_invalide',
        au: 'format_invalide',
        tri: 'valeur_inconnue',
        page: 'format_invalide',
        parPage: 'format_invalide',
      })
    }
  })

  it('refuse une fin de période avant son début', () => {
    expect(() => lireFiltres({ du: '2026-11-10', au: '2026-11-01' })).toThrow(
      expect.objectContaining({ champs: { au: 'avant_debut' } }),
    )
    expect(lireFiltres({ du: '2026-11-01', au: '2026-11-01' }).du).toBe('2026-11-01')
  })
})

describe('décision', () => {
  it('motif de refus : 10 à 500 caractères', () => {
    expect(validerMotifRefus('')).toBe('requis')
    expect(validerMotifRefus('trop bref')).toBe('trop_court')
    expect(validerMotifRefus('x'.repeat(501))).toBe('trop_long')
  })

  it('prévient le développeur par email et le testeur par SMS, avec le motif', () => {
    const dev = messageDecision({ role: 'developpeur', email: 'awa@studio.bj' }, { decision: 'refuse', motif: 'Fiche introuvable.', clientUrl: 'https://nakayo.bj' })
    expect(dev).toMatchObject({ canal: 'emails', a: 'awa@studio.bj' })
    expect(dev.texte).toContain('Motif : Fiche introuvable.')
    const testeur = messageDecision({ role: 'testeur', telephone: '+2290197000000' }, { decision: 'valide', clientUrl: '' })
    expect(testeur).toMatchObject({ canal: 'sms', a: '+2290197000000' })
    expect(testeur.texte.length).toBeLessThanOrEqual(160)
  })
})
