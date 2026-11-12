import { texte } from './validation.js'

// Règles des champs d'une app (docs/api-sprint2.md §1.2), identiques à celles du front.
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
export const STATUTS_APP = ['brouillon', 'en_verification', 'validee', 'refusee']

// Identifiant d'application Android : au moins deux segments, chacun commence par une lettre.
const RE_PACKAGE = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/
const RE_LIEN_TEST = /^https:\/\/play\.google\.com\/apps\/testing\/([A-Za-z0-9_.]+)\/?$/

// Longueur en caractères (comme char_length de PostgreSQL), pas en unités UTF-16.
const longueur = (v) => [...v].length

function validerLongueur(valeur, min, max) {
  if (!valeur) return 'requis'
  if (longueur(valeur) < min) return 'trop_court'
  if (longueur(valeur) > max) return 'trop_long'
  return null
}

const ligne = (v) => texte(v).replace(/\s+/g, ' ')
// Texte long : garde les retours à la ligne, sans lignes vides en trop.
const paragraphe = (v) => texte(v).replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n')

// Accepte un lien collé sans « https:// » ou en « http:// », comme pour la fiche développeur.
export function normaliserLienTest(valeur) {
  const v = texte(valeur)
  if (/^http:\/\//i.test(v)) return v.replace(/^http:\/\//i, 'https://')
  if (/^play\.google\.com\//i.test(v)) return `https://${v}`
  return v
}

export function validerPackage(valeur) {
  if (!valeur) return 'requis'
  if (valeur.length > LIMITES_APP.packageMax) return 'trop_long'
  return RE_PACKAGE.test(valeur) ? null : 'format_invalide'
}

// Le lien d'inscription au test fermé doit viser le même package que l'app.
export function validerLienTest(lien, pkg) {
  if (!lien) return 'requis'
  if (lien.length > LIMITES_APP.lienMax) return 'trop_long'
  const trouve = lien.match(RE_LIEN_TEST)
  if (!trouve) return 'format_invalide'
  if (pkg && !validerPackage(pkg) && trouve[1].toLowerCase() !== pkg.toLowerCase()) return 'ne_correspond_pas'
  return null
}

function validerFonctionnalites(liste) {
  if (!Array.isArray(liste)) return { erreur: 'requis', valeurs: [] }
  const valeurs = liste.map(ligne).filter(Boolean)
  if (valeurs.length < LIMITES_APP.fonctionnalitesMin) return { erreur: valeurs.length ? 'trop_peu' : 'requis', valeurs }
  if (valeurs.length > LIMITES_APP.fonctionnalitesMax) return { erreur: 'trop_nombreuses', valeurs }
  const fautive = valeurs.map((v) => validerLongueur(v, LIMITES_APP.fonctionnaliteMin, LIMITES_APP.fonctionnaliteMax)).find(Boolean)
  if (fautive) return { erreur: `element_${fautive}`, valeurs }
  const uniques = new Set(valeurs.map((v) => v.toLowerCase()))
  return { erreur: uniques.size === valeurs.length ? null : 'doublon', valeurs }
}

// Lit et valide le corps d'une app. Renvoie les valeurs nettoyées et les erreurs par champ.
export function lireApp(donnees) {
  const pkg = texte(donnees.package)
  const lienTestFerme = normaliserLienTest(donnees.lienTestFerme)
  const connexionRequise = donnees.connexionRequise
  const identifiants = paragraphe(donnees.identifiantsTest)
  const fonctionnalites = validerFonctionnalites(donnees.fonctionnalites)
  const valeurs = {
    nom: ligne(donnees.nom),
    package: pkg,
    lienTestFerme,
    description: paragraphe(donnees.description),
    instructions: paragraphe(donnees.instructions),
    fonctionnalites: fonctionnalites.valeurs,
    connexionRequise: connexionRequise === true,
    // Sans connexion, les identifiants éventuellement saisis sont ignorés.
    identifiantsTest: connexionRequise === true ? identifiants : null,
    comptePlay: donnees.comptePlay,
  }
  return {
    valeurs,
    erreurs: {
      nom: validerLongueur(valeurs.nom, LIMITES_APP.nomMin, LIMITES_APP.nomMax),
      package: validerPackage(pkg),
      lienTestFerme: validerLienTest(lienTestFerme, pkg),
      description: validerLongueur(valeurs.description, LIMITES_APP.texteMin, LIMITES_APP.texteMax),
      instructions: validerLongueur(valeurs.instructions, LIMITES_APP.texteMin, LIMITES_APP.texteMax),
      fonctionnalites: fonctionnalites.erreur,
      connexionRequise: typeof connexionRequise === 'boolean' ? null : 'requis',
      identifiantsTest:
        connexionRequise === true ? validerLongueur(identifiants, LIMITES_APP.identifiantsMin, LIMITES_APP.identifiantsMax) : null,
      comptePlay: !donnees.comptePlay ? 'requis' : COMPTES_PLAY.includes(donnees.comptePlay) ? null : 'valeur_inconnue',
    },
  }
}
