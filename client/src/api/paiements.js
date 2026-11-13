import { ErreurApi, ErreurReseau, requete } from './client.js'

// Offre, paiements et factures du développeur (docs/api-sprint2.md §2 et §3).
export function lireOffres({ signal } = {}) {
  return requete('/offres', { signal })
}

export function payerApp(appId, { offre, moyen, numeroMomo }) {
  return requete(`/apps/${encodeURIComponent(appId)}/paiements`, { methode: 'POST', corps: { offre, moyen, numeroMomo } })
}

// Passage de Standard à Pro d'une app déjà payée (docs/api-offres.md §2).
export function monterEnGamme(appId, { offre = 'pro', moyen, numeroMomo }) {
  return requete(`/apps/${encodeURIComponent(appId)}/montee-en-gamme`, { methode: 'POST', corps: { offre, moyen, numeroMomo } })
}

export function listerMesPaiements({ signal } = {}) {
  return requete('/paiements', { signal })
}

export function lirePaiement(reference, { signal } = {}) {
  return requete(`/paiements/${encodeURIComponent(reference)}`, { signal })
}

export function simulerPaiement(reference, resultat) {
  return requete(`/paiements/${encodeURIComponent(reference)}/simulation`, { methode: 'POST', corps: { resultat } })
}

// La facture est un PDF : on la récupère en Blob pour la proposer au téléchargement.
export async function telechargerFacture(numero) {
  let reponse
  try {
    reponse = await fetch(`/api/factures/${encodeURIComponent(numero)}`, { credentials: 'same-origin' })
  } catch {
    throw new ErreurReseau()
  }
  if (!reponse.ok) {
    let erreur = {}
    try {
      erreur = (await reponse.json())?.erreur ?? {}
    } catch {
      erreur = {}
    }
    throw new ErreurApi({ statut: reponse.status, code: erreur.code ?? 'erreur_inconnue', message: erreur.message })
  }
  return reponse.blob()
}
