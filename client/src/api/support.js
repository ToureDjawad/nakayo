import { requete } from './client.js'

// Contact du support publié par l'admin (docs/api-sprint1.md §11.1).
export function lireContactSupport({ signal } = {}) {
  return requete('/support', { signal })
}
