import { describe, expect, it } from 'vitest'
import { construireRequeteComptes } from '../../src/api/admin.js'
import { aujourdhuiBenin, dateHeure, operateur, pluriel, telephone } from '../../src/lib/format.js'
import { validerMotifRefus, validerPeriode } from '../../src/lib/validation.js'
import { resumeControles } from '../../src/pages/admin/resumeControles.js'

describe('construireRequeteComptes()', () => {
  it('demande les comptes en attente sans filtre par défaut', () => {
    expect(construireRequeteComptes({ role: '', du: '', au: '', tri: 'ancien', page: 1 })).toBe('statut=en_attente')
  })

  it('ajoute seulement les filtres renseignés', () => {
    expect(construireRequeteComptes({ role: 'testeur', du: '2026-11-01', au: '2026-11-10', tri: 'recent', page: 2 })).toBe(
      'statut=en_attente&role=testeur&du=2026-11-01&au=2026-11-10&tri=recent&page=2',
    )
  })
})

describe('format', () => {
  it('affiche la date à l’heure du Bénin (UTC+1)', () => {
    expect(dateHeure('2026-11-10T23:30:00.000Z')).toBe('11 nov. 2026 à 00:30')
    expect(dateHeure('pas une date')).toBe('')
  })

  it('donne le jour au Bénin, qui peut différer du jour UTC', () => {
    expect(aujourdhuiBenin(new Date('2026-11-10T23:30:00.000Z'))).toBe('2026-11-11')
  })

  it('groupe les chiffres d’un numéro béninois', () => {
    expect(telephone('+2290197000000')).toBe('+229 01 97 00 00 00')
    expect(telephone('+33612345678')).toBe('+33612345678')
    expect(telephone(null)).toBe('')
  })

  it('nomme les opérateurs et accorde au pluriel', () => {
    expect(operateur('mtn')).toBe('MTN')
    expect(operateur('moov')).toBe('Moov')
    expect(pluriel(1, 'compte')).toBe('1 compte')
    expect(pluriel(3, 'compte')).toBe('3 comptes')
  })
})

describe('validation des filtres et du motif', () => {
  it('refuse une période inversée', () => {
    expect(validerPeriode('', '')).toEqual({})
    expect(validerPeriode('2026-11-01', '2026-11-01')).toEqual({})
    expect(validerPeriode('2026-11-10', '2026-11-01')).toEqual({ au: 'avant_debut' })
    expect(validerPeriode('10/11/2026', '')).toEqual({ du: 'format_invalide' })
  })

  it('exige un motif de 10 à 500 caractères', () => {
    expect(validerMotifRefus('   ')).toBe('requis')
    expect(validerMotifRefus('Trop court')).toBeNull()
    expect(validerMotifRefus('Court')).toBe('trop_court')
    expect(validerMotifRefus('x'.repeat(501))).toBe('trop_long')
  })
})

describe('resumeControles()', () => {
  const liste = (...resultats) => ({ etat: 'termine', liste: resultats.map((resultat, i) => ({ code: `c${i}`, resultat })) })

  it('met en avant les échecs puis les alertes', () => {
    expect(resumeControles(liste('ok', 'echec', 'alerte', 'alerte'))).toEqual({ texte: '1 échec, 2 à vérifier', ton: 'erreur' })
    expect(resumeControles(liste('ok', 'alerte'))).toEqual({ texte: '1 à vérifier', ton: 'alerte' })
    expect(resumeControles(liste('echec', 'echec'))).toEqual({ texte: '2 échecs', ton: 'erreur' })
  })

  it('indique des contrôles conformes, en cours ou absents', () => {
    expect(resumeControles(liste('ok', 'ok'))).toEqual({ texte: 'Contrôles conformes', ton: 'succes' })
    expect(resumeControles({ etat: 'en_cours', liste: [] }).texte).toBe('Contrôles en cours')
    expect(resumeControles({ etat: 'termine', liste: [] }).texte).toBe('Aucun contrôle')
    expect(resumeControles(undefined).texte).toBe('Aucun contrôle')
  })
})
