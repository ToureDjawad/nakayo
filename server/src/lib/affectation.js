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

// Assiduité : part des affectations menées au bout, lissée pour qu'un nouveau testeur parte à 0,5.
export function assiduite({ terminees = 0, remplacees = 0, remises = 0 }) {
  return (terminees + 1) / (terminees + remplacees + remises + 2)
}

const normaliser = (valeur) => (valeur ?? '').trim().toLowerCase()

// Choisit `nombre` testeurs parmi les candidats, du plus assidu au moins assidu.
// Règle stricte : 3 testeurs au plus avec le même modèle de téléphone.
// Règles souples (premier passage seulement) : une ville ne dépasse pas la moitié de la campagne,
// un opérateur pas les deux tiers. `deja` : testeurs déjà dans la campagne (remplacement).
// candidat : { id, ville, operateur, modele, actives, terminees, remplacees, remises }
export function choisirTesteurs(candidats, { nombre, deja = [] }) {
  const tries = candidats
    .filter((c) => c.actives < APPS_MAX_PAR_TESTEUR)
    .map((c) => ({ ...c, score: assiduite(c) }))
    .sort((a, b) => b.score - a.score || a.actives - b.actives || Number(a.id) - Number(b.id))
  const total = deja.length + nombre
  const plafondVille = Math.ceil(total / 2)
  const plafondOperateur = Math.ceil((total * 2) / 3)
  const choisis = []
  const combien = (cle, valeur) => [...deja, ...choisis].filter((t) => normaliser(t[cle]) === normaliser(valeur)).length

  const accepte = (c, souple) => {
    if (c.modele && combien('modele', c.modele) >= MEME_MODELE_MAX) return false
    if (!souple) return true
    return combien('ville', c.ville) < plafondVille && combien('operateur', c.operateur) < plafondOperateur
  }

  for (const souple of [true, false]) {
    for (const candidat of tries) {
      if (choisis.length === nombre) return choisis
      if (!choisis.includes(candidat) && accepte(candidat, souple)) choisis.push(candidat)
    }
  }
  return choisis
}
