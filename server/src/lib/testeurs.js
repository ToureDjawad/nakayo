// Règles propres aux testeurs (docs/api-sprint1.md §1.4 et §4).
import { texte } from './validation.js'

export const LANGUES = ['fr', 'en', 'fon', 'yo', 'guw', 'bba', 'dee', 'ajg', 'gej']
export const OPERATEURS = ['mtn', 'moov']

const RE_TELEPHONE_BENIN = /^\+22901\d{8}$/

// Accepte « 01 97 00 00 00 », « 229 0197000000 » ou « +2290197000000 ».
export function normaliserTelephone(valeur) {
  const v = texte(valeur).replace(/[\s.\-()]/g, '')
  if (/^01\d{8}$/.test(v)) return `+229${v}`
  if (/^22901\d{8}$/.test(v)) return `+${v}`
  if (/^0022901\d{8}$/.test(v)) return `+${v.slice(2)}`
  return v
}

export function validerTelephone(valeur) {
  if (!valeur) return 'requis'
  return RE_TELEPHONE_BENIN.test(valeur) ? null : 'format_invalide'
}

export function validerVille(valeur) {
  if (!valeur) return 'requis'
  if (valeur.length < 2) return 'trop_court'
  if (valeur.length > 60) return 'trop_long'
  return null
}

export function validerGmail(valeur) {
  if (!valeur) return 'requis'
  if (valeur.length > 254) return 'trop_long'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valeur)) return 'format_invalide'
  if (!valeur.endsWith('@gmail.com')) return 'non_gmail'
  if (!/^[a-z0-9.+]+@gmail\.com$/.test(valeur)) return 'format_invalide'
  return null
}

// Gmail ignore les points et ce qui suit « + » : k.offi+test@gmail.com = koffi@gmail.com.
export function normaliserGmail(gmail) {
  const [local, domaine] = gmail.toLowerCase().split('@')
  return `${local.split('+')[0].replaceAll('.', '')}@${domaine}`
}

export function validerOperateur(valeur) {
  if (!valeur) return 'requis'
  return OPERATEURS.includes(valeur) ? null : 'valeur_inconnue'
}

export function validerCodeSms(valeur) {
  if (!valeur) return 'requis'
  return /^\d{6}$/.test(valeur) ? null : 'format_invalide'
}

// Appareil envoyé par l'app (§4.2). Renvoie { appareil } ou { erreur }.
export function lireAppareil(valeur) {
  let brut = valeur
  if (typeof brut === 'string') {
    try {
      brut = JSON.parse(brut)
    } catch {
      return { erreur: 'format_invalide' }
    }
  }
  if (brut === undefined || brut === null || brut === '') return { erreur: 'requis' }
  if (typeof brut !== 'object' || Array.isArray(brut)) return { erreur: 'format_invalide' }
  const appareil = {
    fabricant: texte(brut.fabricant) || null,
    modele: texte(brut.modele),
    versionAndroid: texte(String(brut.versionAndroid ?? '')),
    niveauApi: brut.niveauApi,
    identifiant: texte(brut.identifiant),
  }
  const valide =
    (appareil.fabricant === null || appareil.fabricant.length <= 60) &&
    appareil.modele.length >= 1 &&
    appareil.modele.length <= 80 &&
    appareil.versionAndroid.length >= 1 &&
    appareil.versionAndroid.length <= 20 &&
    Number.isInteger(appareil.niveauApi) &&
    appareil.niveauApi >= 1 &&
    appareil.niveauApi <= 100 &&
    appareil.identifiant.length >= 8 &&
    appareil.identifiant.length <= 128
  return valide ? { appareil } : { erreur: 'format_invalide' }
}

// Type réel d'une image d'après ses premiers octets (le type annoncé par le client ne suffit pas).
export function typeImage(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (buffer.length >= 8 && png.every((octet, i) => buffer[i] === octet)) return 'image/png'
  return null
}

// Langues parlées (§4.4) : 1 à 10 codes connus, sans doublon. Renvoie { langues } ou { erreur }.
export function lireLangues(valeur) {
  if (!Array.isArray(valeur) || valeur.some((l) => typeof l !== 'string')) return { erreur: 'format_invalide' }
  const langues = [...new Set(valeur.map((l) => l.trim().toLowerCase()))]
  if (!langues.length) return { erreur: 'requis' }
  if (langues.length > 10) return { erreur: 'trop_long' }
  if (langues.some((l) => !LANGUES.includes(l))) return { erreur: 'valeur_inconnue' }
  return { langues }
}

export function validerMotifMomo(valeur) {
  if (!valeur) return 'requis'
  if (valeur.length < 10) return 'trop_court'
  if (valeur.length > 300) return 'trop_long'
  return null
}
