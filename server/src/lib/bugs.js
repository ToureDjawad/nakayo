import { texte } from './validation.js'

// Règles des rapports de bugs (US-33, docs/api-bugs.md).
export const GRAVITES = ['mineure', 'genante', 'bloquante']
export const CAPTURES_MAX = 5
export const LIMITES_BUG = {
  titre: [5, 120],
  etapes: [10, 2000],
  resultatAttendu: [5, 1000],
  resultatObtenu: [5, 1000],
  versionApp: [1, 50],
}

function longueur(valeur, [min, max]) {
  if (!valeur) return 'requis'
  if (valeur.length < min) return 'trop_court'
  if (valeur.length > max) return 'trop_long'
  return null
}

// Champs texte d'un rapport de bug (multipart : tout arrive en chaînes).
export function lireBug(corps) {
  const valeurs = Object.fromEntries(Object.keys(LIMITES_BUG).map((cle) => [cle, texte(corps[cle])]))
  valeurs.gravite = texte(corps.gravite)
  const erreurs = Object.fromEntries(Object.entries(LIMITES_BUG).map(([cle, bornes]) => [cle, longueur(valeurs[cle], bornes)]))
  erreurs.gravite = !valeurs.gravite ? 'requis' : GRAVITES.includes(valeurs.gravite) ? null : 'valeur_inconnue'
  return { valeurs, erreurs }
}
