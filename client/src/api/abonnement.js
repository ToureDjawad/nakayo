import { requete } from './client.js'

// US-45 : abonnement mensuel des agences et studios (docs/abonnement.md).
export function lireAbonnement({ signal } = {}) {
  return requete('/abonnement', { signal })
}

export function payerAbonnement({ moyen, numeroMomo, telephoneRappels }) {
  return requete('/abonnement/paiements', { methode: 'POST', corps: { moyen, numeroMomo, telephoneRappels } })
}

// Campagne Standard prise sur l'abonnement, sans paiement.
export function utiliserAbonnement(appId) {
  return requete(`/apps/${encodeURIComponent(appId)}/abonnement`, { methode: 'POST' })
}
