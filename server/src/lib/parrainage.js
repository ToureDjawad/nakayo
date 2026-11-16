import { texte } from './validation.js'

// Parrainage entre testeurs (US-39, docs/api-parrainage.md).

// Prime versée au parrain quand son filleul mène sa première campagne au bout.
export const PRIME_PARRAINAGE = { montant: 500, devise: 'XOF' }

const FORMAT_CODE = /^[A-HJKMNP-Z2-9]{6}$/

// Code saisi à l'inscription : facultatif, sans espaces ni tirets, en majuscules.
// Renvoie { code } (null si absent) ou { erreur }.
export function lireCodeParrainage(valeur) {
  const code = texte(valeur).toUpperCase().replace(/[\s-]/g, '')
  if (!code) return { code: null }
  return FORMAT_CODE.test(code) ? { code } : { erreur: 'format_invalide' }
}

// « Afi Dossou » → « Afi D. » : le parrain reconnaît son filleul sans voir son nom complet.
export function nomCourt(nom) {
  const [prenom, ...reste] = texte(nom).split(/\s+/)
  const initiale = reste.length ? ` ${reste[reste.length - 1][0].toUpperCase()}.` : ''
  return `${prenom}${initiale}`
}
