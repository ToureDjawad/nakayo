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
