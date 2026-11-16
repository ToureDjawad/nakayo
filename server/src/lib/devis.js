import { texte } from './validation.js'

// Besoin du développeur pour l'offre Lancement Afrique (US-37, docs/api-offres.md §4).
// Pays d'Afrique de l'Ouest proposés (codes ISO) et langues de test souhaitées.
export const PAYS_DEVIS = ['BJ', 'TG', 'CI', 'SN', 'BF', 'NG', 'NE', 'ML', 'GH']
export const LANGUES_DEVIS = ['fr', 'en', 'fon', 'yo']
export const LIMITES_DEVIS = { profils: [10, 1000], scenarios: [10, 2000], message: [1, 1000] }

function longueur(valeur, [min, max]) {
  if (!valeur) return 'requis'
  if (valeur.length < min) return 'trop_court'
  if (valeur.length > max) return 'trop_long'
  return null
}

function liste(valeur, connus, max) {
  if (!Array.isArray(valeur)) return { erreur: valeur == null ? 'requis' : 'format_invalide' }
  if (valeur.some((v) => typeof v !== 'string')) return { erreur: 'format_invalide' }
  const codes = [...new Set(valeur.map((v) => v.trim()))]
  if (!codes.length) return { erreur: 'requis' }
  if (codes.length > max) return { erreur: 'trop_nombreux' }
  if (codes.some((c) => !connus.includes(c))) return { erreur: 'valeur_inconnue' }
  return { codes }
}

// Corps de PUT /api/apps/:id/devis. Renvoie { valeurs, erreurs }.
export function lireBesoin(corps) {
  const pays = liste(corps.pays, PAYS_DEVIS, 6)
  const langues = liste(corps.langues, LANGUES_DEVIS, 4)
  const valeurs = { pays: pays.codes, langues: langues.codes, profils: texte(corps.profils), scenarios: texte(corps.scenarios) }
  const erreurs = {
    pays: pays.erreur ?? null,
    langues: langues.erreur ?? null,
    profils: longueur(valeurs.profils, LIMITES_DEVIS.profils),
    scenarios: longueur(valeurs.scenarios, LIMITES_DEVIS.scenarios),
  }
  return { valeurs, erreurs }
}

// Prix proposé par l'admin : entier, au moins le prix de départ, au plus `max`.
export function validerPrix(valeur, min, max) {
  if (valeur == null || valeur === '') return 'requis'
  if (!Number.isInteger(valeur)) return 'format_invalide'
  if (valeur < min) return 'trop_petit'
  if (valeur > max) return 'trop_grand'
  return null
}

export const validerMessage = (valeur, requis) => (valeur ? longueur(valeur, LIMITES_DEVIS.message) : requis ? 'requis' : null)
