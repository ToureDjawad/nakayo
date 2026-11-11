import { describe, expect, it } from 'vitest'
import { lireConfig } from '../../src/config.js'

describe('configuration', () => {
  it('donne un vrai chemin pour le dossier des documents, même avec des accents', () => {
    const { dossierDocuments } = lireConfig({})
    expect(dossierDocuments).toMatch(/stockage\/documents\/?$/)
    expect(dossierDocuments).not.toMatch(/%[0-9A-F]{2}/)
  })

  it('cookie Secure en production seulement, sauf réglage explicite', () => {
    expect(lireConfig({ NODE_ENV: 'production' }).cookieSecurise).toBe(true)
    expect(lireConfig({}).cookieSecurise).toBe(false)
    expect(lireConfig({ NODE_ENV: 'production', COOKIE_SECURISE: 'false' }).cookieSecurise).toBe(false)
  })
})
