import { requete } from './client.js'

export function inscrireDeveloppeur(donnees) {
  return requete('/auth/inscription', { methode: 'POST', corps: donnees })
}

export function verifierEmail(jeton) {
  return requete('/auth/verification-email', { methode: 'POST', corps: { jeton } })
}

export function renvoyerEmailVerification(email) {
  return requete('/auth/verification-email/renvoi', { methode: 'POST', corps: { email } })
}

export function lireSession({ signal } = {}) {
  return requete('/auth/moi', { signal })
}
