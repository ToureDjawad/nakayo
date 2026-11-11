import { describe, expect, it, vi } from 'vitest'
import { corpsErreur, ErreurHttp, gestionnaireErreurs } from '../../src/lib/erreurs.js'
import { lireConfig } from '../../src/config.js'

function reponseFactice() {
  const res = { entetes: {}, statut: null, corps: null }
  res.set = (k, v) => ((res.entetes[k] = v), res)
  res.status = (s) => ((res.statut = s), res)
  res.json = (c) => ((res.corps = c), res)
  return res
}

describe('format des erreurs', () => {
  it('met code, message, champs et détails dans « erreur »', () => {
    const e = new ErreurHttp(400, 'code_invalide', { message: 'Code faux', champs: { code: 'format_invalide' }, tentativesRestantes: 2 })
    expect(corpsErreur(e)).toEqual({
      erreur: { code: 'code_invalide', message: 'Code faux', champs: { code: 'format_invalide' }, tentativesRestantes: 2 },
    })
  })

  it('ajoute Retry-After pour une limite atteinte', () => {
    const res = reponseFactice()
    gestionnaireErreurs()(new ErreurHttp(429, 'trop_de_requetes', { retryAfter: 30 }), {}, res, () => {})
    expect(res.statut).toBe(429)
    expect(res.entetes['Retry-After']).toBe('30')
  })

  it('cache le détail d’une erreur inattendue et la journalise', () => {
    const journal = { error: vi.fn() }
    const res = reponseFactice()
    gestionnaireErreurs(journal)(new Error('mot de passe de la base : secret'), {}, res, () => {})
    expect(res.statut).toBe(500)
    expect(JSON.stringify(res.corps)).not.toContain('secret')
    expect(res.corps.erreur.code).toBe('erreur_interne')
    expect(journal.error).toHaveBeenCalled()
  })
})

describe('lireConfig()', () => {
  it('active le cookie sécurisé en production seulement, sauf réglage explicite', () => {
    expect(lireConfig({ NODE_ENV: 'production' }).cookieSecurise).toBe(true)
    expect(lireConfig({}).cookieSecurise).toBe(false)
    expect(lireConfig({ NODE_ENV: 'production', COOKIE_SECURISE: 'false' }).cookieSecurise).toBe(false)
  })
})
