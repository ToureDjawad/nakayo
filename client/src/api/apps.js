import { requete } from './client.js'

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
