import { describe, expect, it } from 'vitest'
import { APP } from '../fabriques.js'
import { lireApp, normaliserLienTest, validerLienTest, validerPackage } from '../../src/lib/apps.js'


const erreursDe = (corps) => Object.fromEntries(Object.entries(lireApp(corps).erreurs).filter(([, v]) => v))

describe('validerPackage', () => {
  it('accepte un identifiant Android', () => {
    expect(validerPackage('com.exemple.app')).toBeNull()
    expect(validerPackage('bj.Studio_Awa.app2')).toBeNull()
  })
  it('refuse un segment unique, un segment qui commence par un chiffre ou des caractères interdits', () => {
    expect(validerPackage('')).toBe('requis')
    expect(validerPackage('monapp')).toBe('format_invalide')
    expect(validerPackage('com.2app')).toBe('format_invalide')
    expect(validerPackage('com.exemple-app')).toBe('format_invalide')
    expect(validerPackage('com..app')).toBe('format_invalide')
    expect(validerPackage(`com.${'a'.repeat(150)}`)).toBe('trop_long')
  })
})

describe('lien du test fermé', () => {
  it('complète un lien collé sans https', () => {
    expect(normaliserLienTest(' play.google.com/apps/testing/com.exemple.app ')).toBe('https://play.google.com/apps/testing/com.exemple.app')
    expect(normaliserLienTest('http://play.google.com/apps/testing/a.b')).toBe('https://play.google.com/apps/testing/a.b')
  })
  it('doit être un lien d’inscription au test qui vise le même package', () => {
    expect(validerLienTest('https://play.google.com/apps/testing/com.exemple.app', 'com.exemple.app')).toBeNull()
    expect(validerLienTest('https://play.google.com/apps/testing/Com.Exemple.App/', 'com.exemple.app')).toBeNull()
    expect(validerLienTest('https://play.google.com/apps/testing/com.autre.app', 'com.exemple.app')).toBe('ne_correspond_pas')
    expect(validerLienTest('https://play.google.com/store/apps/details?id=com.exemple.app', 'com.exemple.app')).toBe('format_invalide')
    expect(validerLienTest('', 'com.exemple.app')).toBe('requis')
  })
  it('ne compare pas au package quand celui-ci est invalide (une seule erreur à corriger)', () => {
    expect(validerLienTest('https://play.google.com/apps/testing/com.exemple.app', 'monapp')).toBeNull()
  })
})

describe('lireApp', () => {
  it('nettoie les valeurs d’une app valide', () => {
    const { valeurs, erreurs } = lireApp({
      ...APP,
      nom: '  Marché   Facile ',
      description: `${APP.description}\r\n\r\n\r\n\r\nFin.`,
      fonctionnalites: [' Recherche  de produits ', '', 'Panier', 'Suivi de livraison'],
      identifiantsTest: 'ignorés sans connexion',
    })
    expect(Object.values(erreurs).filter(Boolean)).toEqual([])
    expect(valeurs.nom).toBe('Marché Facile')
    expect(valeurs.description).toBe(`${APP.description}\n\nFin.`)
    expect(valeurs.fonctionnalites).toEqual(['Recherche de produits', 'Panier', 'Suivi de livraison'])
    expect(valeurs.identifiantsTest).toBeNull()
  })

  it('signale chaque champ manquant', () => {
    expect(erreursDe({})).toEqual({
      nom: 'requis',
      package: 'requis',
      lienTestFerme: 'requis',
      description: 'requis',
      instructions: 'requis',
      fonctionnalites: 'requis',
      connexionRequise: 'requis',
      comptePlay: 'requis',
    })
  })

  it('demande 3 à 10 fonctionnalités distinctes de 3 à 120 caractères', () => {
    expect(erreursDe({ ...APP, fonctionnalites: ['Panier', 'Recherche'] })).toEqual({ fonctionnalites: 'trop_peu' })
    expect(erreursDe({ ...APP, fonctionnalites: Array.from({ length: 11 }, (_, i) => `Fonction ${i}`) })).toEqual({ fonctionnalites: 'trop_nombreuses' })
    expect(erreursDe({ ...APP, fonctionnalites: ['Panier', 'Ok', 'Recherche'] })).toEqual({ fonctionnalites: 'element_trop_court' })
    expect(erreursDe({ ...APP, fonctionnalites: ['Panier', 'panier', 'Recherche'] })).toEqual({ fonctionnalites: 'doublon' })
    expect(erreursDe({ ...APP, fonctionnalites: 'Panier' })).toEqual({ fonctionnalites: 'requis' })
  })

  it('exige des identifiants de test quand l’app demande une connexion', () => {
    expect(erreursDe({ ...APP, connexionRequise: true })).toEqual({ identifiantsTest: 'requis' })
    const { valeurs, erreurs } = lireApp({ ...APP, connexionRequise: true, identifiantsTest: 'testeur@exemple.com / motdepasse' })
    expect(erreurs.identifiantsTest).toBeNull()
    expect(valeurs.identifiantsTest).toBe('testeur@exemple.com / motdepasse')
    expect(erreursDe({ ...APP, connexionRequise: 'oui' })).toEqual({ connexionRequise: 'requis' })
  })

  it('refuse un type de compte Google Play inconnu et des textes trop courts', () => {
    expect(erreursDe({ ...APP, comptePlay: 'entreprise', description: 'Trop court', nom: 'A' })).toEqual({
      comptePlay: 'valeur_inconnue',
      description: 'trop_court',
      nom: 'trop_court',
    })
  })
})
