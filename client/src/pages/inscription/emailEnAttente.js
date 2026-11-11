// Garde l'email saisi le temps de la session de l'onglet, pour que l'écran
// « vérifiez votre email » survive à un rechargement de page.
const CLE = 'nakayo:email-a-verifier'

export function memoriserEmailEnAttente(email) {
  try {
    sessionStorage.setItem(CLE, email)
  } catch {
    // stockage indisponible (navigation privée) : l'écran demandera l'adresse
  }
}

export function lireEmailEnAttente() {
  try {
    return sessionStorage.getItem(CLE)
  } catch {
    return null
  }
}
