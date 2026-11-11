// Petites aides pour écrire des réponses conformes au contrat (docs/api-sprint1.md).
export const RESEAU_COUPE = Symbol('reseau-coupe')

export function ok(corps, statut = 200, entetes = {}) {
  return { statut, corps, entetes }
}

export function vide(statut = 204) {
  return { statut, corps: null, entetes: {} }
}

export function erreur(statut, code, { message, champs, retryAfter, ...details } = {}) {
  return {
    statut,
    corps: { erreur: { code, message: message ?? code, ...(champs ? { champs } : {}), ...details } },
    entetes: retryAfter ? { 'Retry-After': String(retryAfter) } : {},
  }
}
