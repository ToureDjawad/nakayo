import { creerMomoFedapay } from './fedapay.js'

// Fournisseurs de versements Mobile Money (US-22). Un fournisseur est un objet
// { nom, verser({ reference, numero, operateur, montant, devise }) } qui renvoie
// { statut: 'verse' | 'en_cours' | 'echoue', referenceFournisseur?, motif? }.
// « en_cours » : l'agrégateur confirmera plus tard par webhook (docs/api-sprint4.md §2.3).
// Une exception compte comme un échec : le versement est retenté plus tard.

// Simulation (développement et tests) : chaque versement réussit tout de suite.
export function creerMomoSimulation() {
  const versements = []
  return {
    nom: 'simulation',
    versements,
    async verser(demande) {
      versements.push(demande)
      return { statut: 'verse', referenceFournisseur: `SIM-${demande.reference}` }
    },
  }
}

// Choix selon la configuration. Sans fournisseur branché (mode « aucun », ou FedaPay sans clé),
// rien n'est versé : les versements attendent, aucun n'est perdu.
export function creerMomo(config, { fedapay } = {}) {
  if (config.versementMode === 'simulation') return creerMomoSimulation()
  if (config.versementMode === 'fedapay' && fedapay) return creerMomoFedapay(fedapay)
  return null
}
