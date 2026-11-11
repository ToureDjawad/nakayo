import { erreurValidation } from './erreurs.js'

// Règles des champs (docs/api-sprint1.md §1.4), identiques à celles du front.
export const LIMITES = {
  email: 254,
  motDePasseMin: 10,
  motDePasseMax: 128,
}

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function texte(valeur) {
  return typeof valeur === 'string' ? valeur.trim() : ''
}

export function normaliserEmail(valeur) {
  return texte(valeur).toLowerCase()
}

export function validerEmail(valeur) {
  if (!valeur) return 'requis'
  if (valeur.length > LIMITES.email) return 'trop_long'
  if (!RE_EMAIL.test(valeur)) return 'format_invalide'
  return null
}

// Le mot de passe n'est pas nettoyé : les espaces font partie de la phrase choisie.
export function validerMotDePasse(valeur) {
  if (typeof valeur !== 'string' || !valeur) return 'requis'
  if (valeur.length < LIMITES.motDePasseMin) return 'trop_court'
  if (valeur.length > LIMITES.motDePasseMax) return 'trop_long'
  return null
}

// Lève une 422 si au moins un champ a une erreur. `regles` : { champ: codeOuNull }.
export function exigerChamps(regles) {
  const champs = Object.fromEntries(Object.entries(regles).filter(([, code]) => code))
  if (Object.keys(champs).length) throw erreurValidation(champs)
}

export function corps(req) {
  return req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}
}
