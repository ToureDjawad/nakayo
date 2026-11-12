import { describe, expect, it } from 'vitest'
import { lireTicket } from '../../src/services/tickets.js'

describe('message au support (US-40)', () => {
  it('nettoie le sujet et garde les retours à la ligne du message', () => {
    const { valeurs, erreurs } = lireTicket({ sujet: '  Paiement   en  retard ', message: ' Bonjour,\r\nmon paiement n’est pas arrivé. ' })
    expect(valeurs).toEqual({ sujet: 'Paiement en retard', message: 'Bonjour,\nmon paiement n’est pas arrivé.' })
    expect(erreurs).toEqual({ sujet: null, message: null })
  })

  it('longueurs : sujet de 3 à 120 caractères, message de 10 à 2000', () => {
    expect(lireTicket({}).erreurs).toEqual({ sujet: 'requis', message: 'requis' })
    expect(lireTicket({ sujet: 'ab', message: 'trop court' .slice(0, 9) }).erreurs).toEqual({ sujet: 'trop_court', message: 'trop_court' })
    expect(lireTicket({ sujet: 'x'.repeat(121), message: 'x'.repeat(2001) }).erreurs).toEqual({ sujet: 'trop_long', message: 'trop_long' })
    // Un caractère hors du plan de base (emoji) compte pour un, comme dans PostgreSQL.
    expect(lireTicket({ sujet: '😀'.repeat(120), message: 'x'.repeat(10) }).erreurs.sujet).toBeNull()
    expect(lireTicket({ sujet: 42, message: ['x'] }).erreurs).toEqual({ sujet: 'requis', message: 'requis' })
  })
})
