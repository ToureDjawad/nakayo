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

export function connecter(email, motDePasse) {
  return requete('/auth/connexion', { methode: 'POST', corps: { email, motDePasse } })
}

export function deconnecter() {
  return requete('/auth/deconnexion', { methode: 'POST' })
}

export function demanderReinitialisation(email) {
  return requete('/auth/mot-de-passe/oubli', { methode: 'POST', corps: { email } })
}

export function reinitialiserMotDePasse(jeton, motDePasse) {
  return requete('/auth/mot-de-passe/reinitialisation', { methode: 'POST', corps: { jeton, motDePasse } })
}
