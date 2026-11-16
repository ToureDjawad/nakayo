import { texte } from './validation.js'

// Règles du test quotidien (US-18, US-19, docs/api-sprint3.md §2).
export const LIMITES_RAPPORT = {
  actionsMin: 10,
  actionsMax: 500,
  commentaireMin: 10,
  commentaireMax: 1000,
  retourMin: 100,
  retourMax: 2000,
  versionMax: 50,
}
// Jours de la campagne où l'app demande un retour écrit détaillé (formulaire Google).
export const JOURS_RETOUR_DETAILLE = [3, 7, 12]
// Un jour de test compte à partir de 2 minutes dans l'app testée.
export const USAGE_MINIMUM_SECONDES = 120
// Paquet du Play Store : une app installée depuis un APK a une autre source.
export const SOURCE_PLAY_STORE = 'com.android.vending'
export const USAGES_MAX_PAR_ENVOI = 100

const RE_JOUR = /^\d{4}-\d{2}-\d{2}$/

function longueur(valeur, min, max) {
  if (!valeur) return 'requis'
  if (valeur.length < min) return 'trop_court'
  if (valeur.length > max) return 'trop_long'
  return null
}

const nombre = (v) => typeof v === 'number' && Number.isFinite(v)

// Position arrondie à 2 décimales (environ 1 km) avant tout enregistrement.
export function lirePosition(valeur) {
  if (!valeur || typeof valeur !== 'object') return { erreur: 'requis' }
  const { latitude, longitude } = valeur
  if (!nombre(latitude) || !nombre(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return { erreur: 'format_invalide' }
  }
  return { position: { latitude: Math.round(latitude * 100) / 100, longitude: Math.round(longitude * 100) / 100 } }
}

// Corps du rapport du jour. `fonctionnalites` : la liste du développeur (US-11) ;
// `retourAttendu` : vrai les jours 3, 7 et 12.
export function lireRapport(corps, { fonctionnalites, retourAttendu }) {
  const actions = texte(corps.actions)
  const commentaireBug = texte(corps.commentaireBug)
  const retourDetaille = texte(corps.retourDetaille)
  const versionApp = texte(corps.versionApp)
  const { position, erreur: erreurPosition } = lirePosition(corps.position)
  const L = LIMITES_RAPPORT

  let erreurFonctionnalites = null
  const choisies = Array.isArray(corps.fonctionnalites) ? [...new Set(corps.fonctionnalites)] : null
  if (!choisies || !choisies.length) erreurFonctionnalites = 'requis'
  else if (choisies.some((f) => !fonctionnalites.includes(f))) erreurFonctionnalites = 'valeur_inconnue'

  const erreurs = {
    actions: longueur(actions, L.actionsMin, L.actionsMax),
    note: Number.isInteger(corps.note) && corps.note >= 1 && corps.note <= 5 ? null : corps.note === undefined ? 'requis' : 'format_invalide',
    bug: typeof corps.bug === 'boolean' ? null : 'requis',
    commentaireBug: corps.bug === true ? longueur(commentaireBug, L.commentaireMin, L.commentaireMax) : null,
    fonctionnalites: erreurFonctionnalites,
    versionApp: longueur(versionApp, 1, L.versionMax),
    position: erreurPosition ?? null,
    retourDetaille: retourAttendu || retourDetaille ? longueur(retourDetaille, L.retourMin, L.retourMax) : null,
    // US-16 : facultatif, vrai si le téléphone envoie le rapport en Wi-Fi.
    wifi: corps.wifi === undefined || typeof corps.wifi === 'boolean' ? null : 'format_invalide',
  }
  return {
    erreurs,
    valeurs: {
      actions,
      note: corps.note,
      bug: corps.bug,
      commentaireBug: corps.bug === true ? commentaireBug : null,
      // Dans l'ordre de la liste du développeur.
      fonctionnalites: fonctionnalites.filter((f) => choisies?.includes(f)),
      versionApp,
      position,
      retourDetaille: retourDetaille || null,
      wifi: corps.wifi === true,
    },
  }
}

// Corps { usages: [{ package, jour, secondes }] } envoyé par l'app compagnon.
export function lireUsages(corps) {
  const { usages } = corps
  if (!Array.isArray(usages) || !usages.length) return { erreur: 'requis' }
  if (usages.length > USAGES_MAX_PAR_ENVOI) return { erreur: 'trop_nombreux' }
  const valides = usages.every(
    (u) =>
      u &&
      typeof u.package === 'string' &&
      u.package.length > 0 &&
      u.package.length <= 150 &&
      typeof u.jour === 'string' &&
      RE_JOUR.test(u.jour) &&
      Number.isInteger(u.secondes) &&
      u.secondes >= 0 &&
      u.secondes <= 86400,
  )
  return valides ? { usages } : { erreur: 'format_invalide' }
}
