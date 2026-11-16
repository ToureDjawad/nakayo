import { estEntreeDeGamme } from './offres.js'
import { assiduite, rangNiveau } from './niveaux.js'

export { assiduite }

// Règles d'affectation des testeurs aux campagnes (US-16, docs/api-sprint3.md §1.2).
export const TESTEURS_PAR_CAMPAGNE = 15
export const JOURS_EXIGES = 14
// 14 jours exigés par Google et 2 jours de marge.
export const JOURS_CAMPAGNE = 16
export const APPS_MAX_PAR_TESTEUR = 15
export const MEME_MODELE_MAX = 3
// Le remplacement manuel par l'admin n'a de sens qu'au début : après, le testeur remplaçant
// n'aurait plus le temps de faire ses 14 jours.
export const JOURS_REMPLACEMENT_MANUEL = 2
// Sous ce nombre d'inscrits confirmés, la marge au-dessus des 12 exigés est entamée.
export const SEUIL_ALERTE_INSCRITS = 13

const normaliser = (valeur) => (valeur ?? '').trim().toLowerCase()

// Choisit `nombre` testeurs parmi les candidats, du plus assidu au moins assidu.
// Règles strictes : 3 testeurs au plus avec le même modèle de téléphone, et jamais deux testeurs
// qui partagent un réseau Wi-Fi (US-16, candidat.reseaux : empreintes, docs/api-reseaux.md).
// Règles souples (premier passage seulement) : une ville ne dépasse pas la moitié de la campagne,
// un opérateur pas les deux tiers. `deja` : testeurs déjà dans la campagne (remplacement).
// candidat : { id, ville, operateur, modele, actives, terminees, remplacees, remises, bugsAcceptes }
// `confirmes` (offres Pro et Plus, US-32 et US-38) : les testeurs passent par niveau (Or, puis Argent,
// puis Bronze), quel que soit leur score ; les Bronze ne complètent que s'il en manque.
// `entreeDeGamme` (offre Pro, US-35) : nombre de téléphones de 3 Go de RAM ou moins à réunir
// en priorité (candidat.ram_mo) ; s'il en manque, la campagne part quand même avec ceux qui existent.
export function choisirTesteurs(candidats, { nombre, deja = [], confirmes = false, entreeDeGamme = 0 }) {
  const confirme = (c) => (confirmes ? rangNiveau(c) : 0)
  const tries = candidats
    .filter((c) => c.actives < APPS_MAX_PAR_TESTEUR)
    .map((c) => ({ ...c, score: assiduite(c) }))
    .sort((a, b) => confirme(b) - confirme(a) || b.score - a.score || a.actives - b.actives || Number(a.id) - Number(b.id))
  const total = deja.length + nombre
  const plafondVille = Math.ceil(total / 2)
  const plafondOperateur = Math.ceil((total * 2) / 3)
  const choisis = []
  const combien = (cle, valeur) => [...deja, ...choisis].filter((t) => normaliser(t[cle]) === normaliser(valeur)).length

  // US-16 : jamais deux testeurs d'un même réseau Wi-Fi dans une campagne (règle stricte).
  const partageReseau = (c) => (c.reseaux ?? []).some((r) => [...deja, ...choisis].some((t) => (t.reseaux ?? []).includes(r)))

  const accepte = (c, souple) => {
    if (c.modele && combien('modele', c.modele) >= MEME_MODELE_MAX) return false
    if (partageReseau(c)) return false
    if (!souple) return true
    return combien('ville', c.ville) < plafondVille && combien('operateur', c.operateur) < plafondOperateur
  }

  // Ajoute des candidats de `liste` jusqu'à `limite` choisis, règles souples puis strictes.
  const completer = (liste, limite) => {
    for (const souple of [true, false]) {
      for (const candidat of liste) {
        if (choisis.length >= limite) return
        if (!choisis.includes(candidat) && accepte(candidat, souple)) choisis.push(candidat)
      }
    }
  }

  // US-35 : d'abord les téléphones d'entrée de gamme qui manquent à la campagne, puis les autres.
  const petits = Math.max(0, entreeDeGamme - deja.filter((t) => estEntreeDeGamme(t.ram_mo)).length)
  if (petits) completer(tries.filter((c) => estEntreeDeGamme(c.ram_mo)), Math.min(nombre, petits))
  completer(tries, nombre)
  return choisis
}
