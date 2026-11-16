import { ErreurApi, ErreurReseau, requete } from './client.js'

// Apps du développeur connecté (docs/api-sprint2.md §1).
export function listerMesApps({ signal } = {}) {
  return requete('/apps', { signal })
}

export function lireApp(id, { signal } = {}) {
  return requete(`/apps/${encodeURIComponent(id)}`, { signal })
}

export function soumettreApp(app) {
  return requete('/apps', { methode: 'POST', corps: app })
}

export function modifierApp(id, app) {
  return requete(`/apps/${encodeURIComponent(id)}`, { methode: 'PUT', corps: app })
}

export function supprimerApp(id) {
  return requete(`/apps/${encodeURIComponent(id)}`, { methode: 'DELETE' })
}

// Préparation du lancement (docs/api-sprint2.md §5).
export function lirePreparation(id, { signal } = {}) {
  return requete(`/apps/${encodeURIComponent(id)}/preparation`, { signal })
}

export function enregistrerPreparation(id, elements) {
  return requete(`/apps/${encodeURIComponent(id)}/preparation`, { methode: 'PUT', corps: { elements } })
}

// Campagne de test (docs/api-sprint3.md §1.3).
export function lireCampagne(id, { signal } = {}) {
  return requete(`/apps/${encodeURIComponent(id)}/campagne`, { signal })
}

export function demarrerCampagne(id) {
  return requete(`/apps/${encodeURIComponent(id)}/campagne`, { methode: 'POST' })
}

// Avancement de la campagne au jour le jour (docs/api-sprint4.md §1, US-21).
export function lireAvancement(id, { signal } = {}) {
  return requete(`/apps/${encodeURIComponent(id)}/campagne/avancement`, { signal })
}

// Rapport de fin, brouillon des réponses au formulaire Google et décision de Google (§6, US-36).
export function lireRapportFinal(id, { signal } = {}) {
  return requete(`/apps/${encodeURIComponent(id)}/campagne/rapport`, { signal })
}

export function enregistrerDecisionGoogle(id, { decision, le }) {
  return requete(`/apps/${encodeURIComponent(id)}/campagne/decision-google`, { methode: 'PUT', corps: { decision, le: le || null } })
}

// Le rapport est un PDF : récupéré en Blob avec la session du site.
export async function telechargerRapportFinal(id) {
  let reponse
  try {
    reponse = await fetch(`/api/apps/${encodeURIComponent(id)}/campagne/rapport.pdf`, { credentials: 'same-origin' })
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

// Bugs signalés par les testeurs (docs/api-bugs.md §2, US-34).
export function listerBugs(id, { signal } = {}) {
  return requete(`/apps/${encodeURIComponent(id)}/bugs`, { signal })
}

export function deciderBug(id, bugId, { decision, motif }) {
  return requete(`/apps/${encodeURIComponent(id)}/bugs/${encodeURIComponent(bugId)}/decision`, { methode: 'POST', corps: { decision, motif } })
}

// Export CSV des bugs, récupéré en Blob avec la session du site.
export async function telechargerBugsCsv(id) {
  let reponse
  try {
    reponse = await fetch(`/api/apps/${encodeURIComponent(id)}/bugs.csv`, { credentials: 'same-origin' })
  } catch {
    throw new ErreurReseau()
  }
  if (!reponse.ok) throw new ErreurApi({ statut: reponse.status, code: 'erreur_inconnue' })
  return reponse.blob()
}

// Devis de l'Offre Plus (docs/api-offres.md §4, US-37).
export function lireDevis(id, { signal } = {}) {
  return requete(`/apps/${encodeURIComponent(id)}/devis`, { signal })
}

export function demanderDevis(id, { pays, langues, profils, scenarios }) {
  return requete(`/apps/${encodeURIComponent(id)}/devis`, { methode: 'PUT', corps: { pays, langues, profils, scenarios } })
}

// Garantie après un refus de Google (docs/garantie.md, US-30).
export function lireGarantie(id, { signal } = {}) {
  return requete(`/apps/${encodeURIComponent(id)}/garantie`, { signal })
}

export function demanderGarantie(id, { choix, motifGoogle, emailGoogle, engagement }) {
  return requete(`/apps/${encodeURIComponent(id)}/garantie`, { methode: 'POST', corps: { choix, motifGoogle, emailGoogle, engagement } })
}

// Versions annoncées aux testeurs pendant le test (docs/nouvelle-version.md, US-44).
export function lireVersions(id, { signal } = {}) {
  return requete(`/apps/${encodeURIComponent(id)}/campagne/versions`, { signal })
}

export function annoncerVersion(id, { numero, changements }) {
  return requete(`/apps/${encodeURIComponent(id)}/campagne/versions`, { methode: 'POST', corps: { numero, changements } })
}
