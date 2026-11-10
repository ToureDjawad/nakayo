import { describe, expect, it } from 'vitest'
import { ErreurApi, ErreurReseau } from '../../src/api/client.js'
import { dureeLisible, messageChamp, messageErreurGlobale } from '../../src/lib/messages.js'

describe('messageChamp()', () => {
  it('donne le message propre au champ', () => {
    expect(messageChamp('email', 'deja_utilise')).toBe('Un compte existe déjà avec cette adresse email.')
    expect(messageChamp('motDePasse', 'trop_court')).toBe('Le mot de passe doit contenir au moins 10 caractères.')
  })

  it('retombe sur le message générique puis sur un message par défaut', () => {
    expect(messageChamp('ville', 'requis')).toBe('Ce champ est obligatoire.')
    expect(messageChamp('ville', 'code_jamais_vu')).toBe('Cette valeur n’est pas valide.')
  })

  it('ne renvoie rien sans erreur', () => {
    expect(messageChamp('email', null)).toBeNull()
  })

  it('n’utilise pas de tiret cadratin', () => {
    for (const champ of ['email', 'motDePasse', 'nom', 'pays', 'lienFicheDeveloppeur', 'accepteConditions']) {
      for (const code of ['requis', 'trop_court', 'trop_long', 'format_invalide', 'deja_utilise']) {
        expect(messageChamp(champ, code)).not.toMatch(/[\u2013\u2014]/)
      }
    }
  })
})

describe('dureeLisible()', () => {
  it('arrondit à la minute supérieure', () => {
    expect(dureeLisible(null)).toBe('quelques secondes')
    expect(dureeLisible(30)).toBe('quelques secondes')
    expect(dureeLisible(60)).toBe('1 minute')
    expect(dureeLisible(61)).toBe('2 minutes')
    expect(dureeLisible(300)).toBe('5 minutes')
  })
})

describe('messageErreurGlobale()', () => {
  it('distingue réseau, limite, serveur et champs', () => {
    expect(messageErreurGlobale(new ErreurReseau())).toMatch(/Impossible de joindre le serveur/)
    expect(messageErreurGlobale(new ErreurApi({ statut: 429, code: 'trop_de_requetes', retryAfter: 120 }))).toBe(
      'Trop de tentatives. Réessayez dans 2 minutes.',
    )
    expect(messageErreurGlobale(new ErreurApi({ statut: 503, code: 'service_indisponible' }))).toMatch(/ne répond pas/)
    expect(messageErreurGlobale(new ErreurApi({ statut: 422, code: 'validation', champs: { a: 'requis' } }))).toBe(
      'Certains champs sont à corriger.',
    )
    expect(messageErreurGlobale(new Error('x'))).toMatch(/erreur inattendue/)
  })
})
