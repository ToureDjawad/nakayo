import { ErreurApi, ErreurReseau } from '../api/client.js'
import { LIMITES, LIMITES_APP } from './validation.js'

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
  confirmation: {
    requis: 'Saisissez à nouveau le mot de passe.',
    different: 'Les deux mots de passe ne correspondent pas.',
  },
  motif: {
    requis: 'Indiquez le motif du refus. Il sera envoyé à la personne.',
    trop_court: `Le motif doit contenir au moins ${LIMITES.motifRefusMin} caractères.`,
    trop_long: `Le motif ne doit pas dépasser ${LIMITES.motifRefusMax} caractères.`,
  },
  sujet: {
    requis: 'Indiquez le sujet de votre message.',
    trop_court: `Le sujet doit contenir au moins ${LIMITES.sujetMin} caractères.`,
    trop_long: `Le sujet ne doit pas dépasser ${LIMITES.sujetMax} caractères.`,
  },
  message: {
    requis: 'Écrivez votre message.',
    trop_court: `Le message doit contenir au moins ${LIMITES.messageMin} caractères.`,
    trop_long: `Le message ne doit pas dépasser ${LIMITES.messageMax} caractères.`,
  },
  whatsapp: {
    requis: 'Saisissez le numéro WhatsApp du support.',
    format_invalide: 'Saisissez le numéro au format international, avec l’indicatif. Exemple : +229 01 97 00 00 00',
  },
  nomApp: {
    requis: 'Saisissez le nom de votre app.',
    trop_court: `Le nom doit contenir au moins ${LIMITES_APP.nomMin} caractères.`,
    trop_long: `Le nom ne doit pas dépasser ${LIMITES_APP.nomMax} caractères.`,
  },
  package: {
    requis: 'Saisissez le nom du package de votre app.',
    format_invalide: 'Le package doit ressembler à com.exemple.app : des mots séparés par des points, sans espace ni tiret.',
    trop_long: `Le package ne doit pas dépasser ${LIMITES_APP.packageMax} caractères.`,
    deja_utilise: 'Ce package est déjà inscrit sur Nakayo. Si c’est bien votre app, écrivez à l’équipe.',
  },
  lienTestFerme: {
    requis: 'Collez le lien d’inscription à votre test fermé.',
    format_invalide: 'Le lien doit commencer par https://play.google.com/apps/testing/ suivi du package.',
    trop_long: `Le lien ne doit pas dépasser ${LIMITES_APP.lienMax} caractères.`,
    ne_correspond_pas: 'Ce lien vise une autre app : le package à la fin du lien doit être celui saisi plus haut.',
  },
  description: {
    requis: 'Décrivez votre app en quelques phrases.',
    trop_court: `La description doit contenir au moins ${LIMITES_APP.texteMin} caractères.`,
    trop_long: `La description ne doit pas dépasser ${LIMITES_APP.texteMax} caractères.`,
  },
  instructions: {
    requis: 'Indiquez ce que les testeurs doivent faire chaque jour.',
    trop_court: `Les instructions doivent contenir au moins ${LIMITES_APP.texteMin} caractères.`,
    trop_long: `Les instructions ne doivent pas dépasser ${LIMITES_APP.texteMax} caractères.`,
  },
  fonctionnalites: {
    requis: `Indiquez au moins ${LIMITES_APP.fonctionnalitesMin} fonctionnalités à tester.`,
    trop_peu: `Indiquez au moins ${LIMITES_APP.fonctionnalitesMin} fonctionnalités à tester.`,
    trop_nombreuses: `Indiquez ${LIMITES_APP.fonctionnalitesMax} fonctionnalités au plus.`,
    element_trop_court: `Chaque fonctionnalité doit contenir au moins ${LIMITES_APP.fonctionnaliteMin} caractères.`,
    element_trop_long: `Chaque fonctionnalité doit tenir en ${LIMITES_APP.fonctionnaliteMax} caractères.`,
    doublon: 'Deux fonctionnalités sont identiques.',
  },
  connexionRequise: { requis: 'Indiquez si votre app demande une connexion.' },
  identifiantsTest: {
    requis: 'Donnez un compte de test : les testeurs doivent pouvoir se connecter.',
    trop_court: `Les identifiants doivent contenir au moins ${LIMITES_APP.identifiantsMin} caractères.`,
    trop_long: `Les identifiants ne doivent pas dépasser ${LIMITES_APP.identifiantsMax} caractères.`,
  },
  comptePlay: {
    requis: 'Indiquez le type de votre compte développeur Google Play.',
    valeur_inconnue: 'Choisissez une des réponses proposées.',
  },
  moyen: {
    requis: 'Choisissez un moyen de paiement.',
    valeur_inconnue: 'Choisissez un des moyens de paiement proposés.',
  },
  numeroMomo: {
    requis: 'Saisissez le numéro Mobile Money qui va payer.',
    format_invalide: 'Saisissez le numéro au format international, avec l’indicatif. Exemple : +229 01 97 00 00 00',
  },
  du: { format_invalide: 'Date invalide.' },
  au: {
    format_invalide: 'Date invalide.',
    avant_debut: 'La date de fin doit être après la date de début.',
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
