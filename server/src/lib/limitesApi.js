import { creerLimiteur } from './limites.js'

const MINUTE = 60 * 1000
const HEURE = 60 * MINUTE

// Limites du contrat, créées par application (chaque test part de compteurs vides).
export function creerLimitesApi(maintenant) {
  const horloge = () => maintenant().getTime()
  return {
    // §3.1 : 5 échecs de connexion en 15 min pour un email ou une IP.
    connexionEmail: creerLimiteur({ max: 5, fenetreMs: 15 * MINUTE, maintenant: horloge }),
    connexionIp: creerLimiteur({ max: 5, fenetreMs: 15 * MINUTE, maintenant: horloge }),
    // §2.3 et §3.4 : un email par minute et 5 par heure pour une adresse.
    emailMinute: creerLimiteur({ max: 1, fenetreMs: MINUTE, maintenant: horloge }),
    emailHeure: creerLimiteur({ max: 5, fenetreMs: HEURE, maintenant: horloge }),
    // §2.1 : 5 inscriptions par heure depuis une IP.
    inscriptionIp: creerLimiteur({ max: 5, fenetreMs: HEURE, maintenant: horloge }),
  }
}

// Envoi d'email vers une adresse : vérifie les deux fenêtres avant de compter. Chaque type
// d'email a ses compteurs (un renvoi de vérification ne bloque pas un mot de passe oublié).
export function consommerEnvoiEmail(limites, type, email) {
  const cle = `${type}:${email}`
  limites.emailMinute.verifier(cle)
  limites.emailHeure.verifier(cle)
  limites.emailMinute.compter(cle)
  limites.emailHeure.compter(cle)
}
