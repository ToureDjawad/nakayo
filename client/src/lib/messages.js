import { ErreurApi, ErreurReseau } from '../api/client.js'
import { LIMITES } from './validation.js'

// Messages par champ et par code (docs/api-sprint1.md §1.3). Les codes absents
// d'un champ retombent sur GENERIQUES.
const PAR_CHAMP = {
  email: {
    requis: 'Saisissez votre adresse email.',
    format_invalide: 'Cette adresse email n’est pas valide. Exemple : nom@domaine.com',
    trop_long: `L’adresse email ne doit pas dépasser ${LIMITES.email} caractères.`,
    deja_utilise: 'Un compte existe déjà avec cette adresse email.',
  },
  motDePasse: {
    requis: 'Choisissez un mot de passe.',
    trop_court: `Le mot de passe doit contenir au moins ${LIMITES.motDePasseMin} caractères.`,
    trop_long: `Le mot de passe ne doit pas dépasser ${LIMITES.motDePasseMax} caractères.`,
  },
  nom: {
    requis: 'Saisissez votre nom de développeur.',
    trop_court: `Le nom doit contenir au moins ${LIMITES.nomMin} caractères.`,
    trop_long: `Le nom ne doit pas dépasser ${LIMITES.nomMax} caractères.`,
  },
  pays: {
    requis: 'Choisissez votre pays.',
    valeur_inconnue: 'Choisissez un pays dans la liste.',
    format_invalide: 'Choisissez un pays dans la liste.',
  },
  lienFicheDeveloppeur: {
    requis: 'Collez le lien de votre fiche développeur Google Play.',
    format_invalide:
      'Le lien doit commencer par https://play.google.com/store/apps/dev?id= ou https://play.google.com/store/apps/developer?id=',
    trop_long: `Le lien ne doit pas dépasser ${LIMITES.lienFiche} caractères.`,
    deja_utilise: 'Cette fiche développeur est déjà liée à un autre compte.',
  },
  accepteConditions: {
    requis: 'Vous devez accepter les conditions d’utilisation pour créer un compte.',
    doit_etre_accepte: 'Vous devez accepter les conditions d’utilisation pour créer un compte.',
  },
}

const GENERIQUES = {
  requis: 'Ce champ est obligatoire.',
  trop_court: 'Cette valeur est trop courte.',
  trop_long: 'Cette valeur est trop longue.',
  format_invalide: 'Le format n’est pas valide.',
  deja_utilise: 'Cette valeur est déjà utilisée.',
  valeur_inconnue: 'Cette valeur n’est pas acceptée.',
  doit_etre_accepte: 'Cette case doit être cochée.',
}

export function messageChamp(champ, code) {
  if (!code) return null
  return PAR_CHAMP[champ]?.[code] ?? GENERIQUES[code] ?? 'Cette valeur n’est pas valide.'
}

export function dureeLisible(secondes) {
  if (!secondes || secondes < 60) return 'quelques secondes'
  const minutes = Math.ceil(secondes / 60)
  return minutes === 1 ? '1 minute' : `${minutes} minutes`
}

// Message global pour une erreur qui ne concerne pas un champ précis.
export function messageErreurGlobale(erreur) {
  if (erreur instanceof ErreurReseau) {
    return 'Impossible de joindre le serveur. Vérifiez votre connexion internet, puis réessayez.'
  }
  if (erreur instanceof ErreurApi) {
    if (erreur.statut === 429) {
      return `Trop de tentatives. Réessayez dans ${dureeLisible(erreur.retryAfter)}.`
    }
    if (erreur.statut >= 500) {
      return 'Le service ne répond pas pour le moment. Réessayez dans quelques minutes.'
    }
    if (erreur.champs) return 'Certains champs sont à corriger.'
  }
  return 'Une erreur inattendue s’est produite. Réessayez.'
}
