// Limites partagées avec l'API (docs/api-sprint1.md §1.4). Le serveur reste la référence.
export const LIMITES = {
  email: 254,
  motDePasseMin: 10,
  motDePasseMax: 128,
  nomMin: 2,
  nomMax: 80,
  lienFiche: 300,
  motifRefusMin: 10,
  motifRefusMax: 500,
  sujetMin: 3,
  sujetMax: 120,
  messageMin: 10,
  messageMax: 2000,
}

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RE_FICHE_PLAY = /^https:\/\/play\.google\.com\/store\/apps\/(dev|developer)\?id=[^\s&#]+(&[^\s#]*)?$/

export function validerEmail(valeur) {
  const v = valeur.trim()
  if (!v) return 'requis'
  if (v.length > LIMITES.email) return 'trop_long'
  if (!RE_EMAIL.test(v)) return 'format_invalide'
  return null
}

export function validerMotDePasse(valeur) {
  if (!valeur) return 'requis'
  if (valeur.length < LIMITES.motDePasseMin) return 'trop_court'
  if (valeur.length > LIMITES.motDePasseMax) return 'trop_long'
  return null
}

export function validerNom(valeur) {
  const v = valeur.trim()
  if (!v) return 'requis'
  if (v.length < LIMITES.nomMin) return 'trop_court'
  if (v.length > LIMITES.nomMax) return 'trop_long'
  return null
}

// Accepte un lien collé sans « https:// » ou en « http:// », et le remet en forme.
export function normaliserLienFiche(valeur) {
  const v = valeur.trim()
  if (!v) return v
  if (/^http:\/\//i.test(v)) return v.replace(/^http:\/\//i, 'https://')
  if (/^play\.google\.com\//i.test(v)) return `https://${v}`
  return v
}

export function validerLienFiche(valeur) {
  const v = normaliserLienFiche(valeur)
  if (!v) return 'requis'
  if (v.length > LIMITES.lienFiche) return 'trop_long'
  if (!RE_FICHE_PLAY.test(v)) return 'format_invalide'
  return null
}

export function validerRequis(valeur) {
  return valeur ? null : 'requis'
}

export function validerCoche(valeur) {
  return valeur === true ? null : 'doit_etre_accepte'
}

export function validerMotifRefus(valeur) {
  const v = valeur.trim()
  if (!v) return 'requis'
  if (v.length < LIMITES.motifRefusMin) return 'trop_court'
  if (v.length > LIMITES.motifRefusMax) return 'trop_long'
  return null
}

const RE_DATE = /^\d{4}-\d{2}-\d{2}$/

// Période de filtre : les deux dates sont facultatives, mais « du » ne peut pas suivre « au ».
export function validerPeriode(du, au) {
  if (du && !RE_DATE.test(du)) return { du: 'format_invalide' }
  if (au && !RE_DATE.test(au)) return { au: 'format_invalide' }
  if (du && au && du > au) return { au: 'avant_debut' }
  return {}
}

// Confirmation du nouveau mot de passe (réinitialisation).
export function validerConfirmation(valeur, valeurs) {
  if (!valeur) return 'requis'
  return valeur === valeurs.motDePasse ? null : 'different'
}

// Numéro WhatsApp du support, au format international (même règle que le serveur, §11).
export function normaliserWhatsapp(valeur) {
  const v = (valeur ?? '').trim().replace(/[\s.()-]/g, '')
  return v.startsWith('00') ? `+${v.slice(2)}` : v
}

export function validerWhatsapp(valeur) {
  const v = normaliserWhatsapp(valeur)
  if (!v) return 'requis'
  if (!/^\+[1-9]\d{7,14}$/.test(v)) return 'format_invalide'
  return null
}

// Message au support (§12.1). Longueurs en caractères, comme le serveur.
function validerLongueur(valeur, min, max) {
  const v = (valeur ?? '').trim()
  if (!v) return 'requis'
  if ([...v].length < min) return 'trop_court'
  if ([...v].length > max) return 'trop_long'
  return null
}

export function validerSujet(valeur) {
  return validerLongueur((valeur ?? '').replace(/\s+/g, ' '), LIMITES.sujetMin, LIMITES.sujetMax)
}

export function validerMessage(valeur) {
  return validerLongueur(valeur, LIMITES.messageMin, LIMITES.messageMax)
}

// App soumise par un développeur (docs/api-sprint2.md §1.2). Mêmes règles que le serveur.
export const LIMITES_APP = {
  nomMin: 2,
  nomMax: 50,
  packageMax: 150,
  lienMax: 300,
  texteMin: 20,
  texteMax: 2000,
  fonctionnalitesMin: 3,
  fonctionnalitesMax: 10,
  fonctionnaliteMin: 3,
  fonctionnaliteMax: 120,
  identifiantsMin: 5,
  identifiantsMax: 500,
}
export const COMPTES_PLAY = ['personnel_recent', 'personnel_ancien', 'organisation']

const RE_PACKAGE = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/
const RE_LIEN_TEST = /^https:\/\/play\.google\.com\/apps\/testing\/([A-Za-z0-9_.]+)\/?$/

const uneLigne = (valeur) => (valeur ?? '').trim().replace(/\s+/g, ' ')

export function validerNomApp(valeur) {
  return validerLongueur(uneLigne(valeur), LIMITES_APP.nomMin, LIMITES_APP.nomMax)
}

export function validerPackage(valeur) {
  const v = (valeur ?? '').trim()
  if (!v) return 'requis'
  if (v.length > LIMITES_APP.packageMax) return 'trop_long'
  return RE_PACKAGE.test(v) ? null : 'format_invalide'
}

// Le lien d'inscription au test fermé : https:// ajouté s'il manque, comme pour la fiche développeur.
export const normaliserLienTest = normaliserLienFiche

export function lienTestAttendu(pkg) {
  const v = (pkg ?? '').trim()
  return validerPackage(v) ? null : `https://play.google.com/apps/testing/${v}`
}

// Le package du lien doit être celui de l'app (comparé seulement si le package est valide).
export function validerLienTest(valeur, valeurs = {}) {
  const v = normaliserLienTest(valeur ?? '')
  if (!v) return 'requis'
  if (v.length > LIMITES_APP.lienMax) return 'trop_long'
  const trouve = v.match(RE_LIEN_TEST)
  if (!trouve) return 'format_invalide'
  const pkg = (valeurs.package ?? '').trim()
  if (pkg && !validerPackage(pkg) && trouve[1].toLowerCase() !== pkg.toLowerCase()) return 'ne_correspond_pas'
  return null
}

export function validerTexteApp(valeur) {
  return validerLongueur(valeur, LIMITES_APP.texteMin, LIMITES_APP.texteMax)
}

// Liste des fonctionnalités clés : les lignes vides sont ignorées.
export function nettoyerFonctionnalites(liste) {
  return (liste ?? []).map(uneLigne).filter(Boolean)
}

export function validerFonctionnalites(liste) {
  const valeurs = nettoyerFonctionnalites(liste)
  if (!valeurs.length) return 'requis'
  if (valeurs.length < LIMITES_APP.fonctionnalitesMin) return 'trop_peu'
  if (valeurs.length > LIMITES_APP.fonctionnalitesMax) return 'trop_nombreuses'
  for (const v of valeurs) {
    const erreur = validerLongueur(v, LIMITES_APP.fonctionnaliteMin, LIMITES_APP.fonctionnaliteMax)
    if (erreur) return `element_${erreur}`
  }
  return new Set(valeurs.map((v) => v.toLowerCase())).size === valeurs.length ? null : 'doublon'
}

// « oui » ou « non » dans le formulaire, booléen dans l'API.
export function validerChoix(valeur) {
  return valeur ? null : 'requis'
}

export function validerIdentifiants(valeur, valeurs = {}) {
  if (valeurs.connexionRequise !== 'oui') return null
  return validerLongueur(valeur, LIMITES_APP.identifiantsMin, LIMITES_APP.identifiantsMax)
}

export function validerComptePlay(valeur) {
  if (!valeur) return 'requis'
  return COMPTES_PLAY.includes(valeur) ? null : 'valeur_inconnue'
}
