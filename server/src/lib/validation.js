import { erreurValidation } from './erreurs.js'
import { CODES_PAYS } from './pays.js'

// Règles des champs (docs/api-sprint1.md §1.4), identiques à celles du front.
export const LIMITES = {
  email: 254,
  motDePasseMin: 10,
  motDePasseMax: 128,
  nomMin: 2,
  nomMax: 80,
  lienFiche: 300,
}

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RE_FICHE_PLAY = /^https:\/\/play\.google\.com\/store\/apps\/(dev|developer)\?id=[^\s&#]+(&[^\s#]*)?$/

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

export function validerNom(valeur) {
  if (!valeur) return 'requis'
  if (valeur.length < LIMITES.nomMin) return 'trop_court'
  if (valeur.length > LIMITES.nomMax) return 'trop_long'
  return null
}

export function validerPays(valeur) {
  if (!valeur) return 'requis'
  return CODES_PAYS.has(valeur) ? null : 'valeur_inconnue'
}

// Accepte un lien collé sans « https:// » ou en « http:// », comme le front.
export function normaliserLienFiche(valeur) {
  const v = texte(valeur)
  if (/^http:\/\//i.test(v)) return v.replace(/^http:\/\//i, 'https://')
  if (/^play\.google\.com\//i.test(v)) return `https://${v}`
  return v
}

export function validerLienFiche(valeur) {
  if (!valeur) return 'requis'
  if (valeur.length > LIMITES.lienFiche) return 'trop_long'
  if (!RE_FICHE_PLAY.test(valeur)) return 'format_invalide'
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
