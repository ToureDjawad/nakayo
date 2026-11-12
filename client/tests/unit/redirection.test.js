import { describe, expect, it } from 'vitest'
import { destinationApresConnexion, suiteSure } from '../../src/lib/redirection.js'
import { validerConfirmation } from '../../src/lib/validation.js'

describe('suiteSure()', () => {
  it('accepte un chemin interne', () => {
    expect(suiteSure('/admin/comptes?role=testeur')).toBe('/admin/comptes?role=testeur')
    expect(suiteSure('/mon-compte')).toBe('/mon-compte')
  })

  it('refuse tout ce qui peut mener vers un autre site', () => {
    for (const suite of ['https://exemple.com', '//exemple.com', '/\\exemple.com', 'javascript:alert(1)', 'mon-compte', '', null, undefined]) {
      expect(suiteSure(suite)).toBeNull()
    }
  })

  it('refuse de revenir sur les pages de connexion', () => {
    expect(suiteSure('/connexion')).toBeNull()
    expect(suiteSure('/connexion?suite=/admin')).toBeNull()
    expect(suiteSure('/mot-de-passe-oublie')).toBeNull()
  })
})

describe('destinationApresConnexion()', () => {
  const admin = { role: 'admin' }
  const dev = { role: 'developpeur' }

  it('envoie chaque rôle sur sa page par défaut', () => {
    expect(destinationApresConnexion(admin, null)).toBe('/admin/tableau-de-bord')
    expect(destinationApresConnexion(dev, null)).toBe('/mon-compte')
  })

  it('suit la page demandée si elle est sûre et permise', () => {
    expect(destinationApresConnexion(admin, '/admin/comptes?page=2')).toBe('/admin/comptes?page=2')
    expect(destinationApresConnexion(dev, '/mon-compte')).toBe('/mon-compte')
  })

  it('n’envoie pas un développeur vers le back-office', () => {
    expect(destinationApresConnexion(dev, '/admin/comptes')).toBe('/mon-compte')
  })

  it('ignore une suite dangereuse', () => {
    expect(destinationApresConnexion(admin, '//exemple.com')).toBe('/admin/tableau-de-bord')
  })
})

describe('validerConfirmation()', () => {
  it('compare au mot de passe saisi', () => {
    expect(validerConfirmation('', { motDePasse: 'abc' })).toBe('requis')
    expect(validerConfirmation('abd', { motDePasse: 'abc' })).toBe('different')
    expect(validerConfirmation('abc', { motDePasse: 'abc' })).toBeNull()
  })
})
