import { texte } from './validation.js'

// Questionnaire terrain de l'offre Lancement Afrique (US-37, docs/api-offres.md §4.5).
export const JOUR_TERRAIN = 7
export const CONNEXIONS = ['wifi', '4g', '3g', '2g']
export const TENUES = ['fluide', 'lent', 'inutilisable']
export const LANGUES_TERRAIN = ['fr', 'en']
export const COMMENTAIRE_TERRAIN = [10, 1000]

const choix = (valeur, connus) => (valeur == null || valeur === '' ? 'requis' : connus.includes(valeur) ? null : 'valeur_inconnue')

// Corps de POST /api/testeur/apps/:id/terrain. Renvoie { valeurs, erreurs }.
export function lireRetourTerrain(corps) {
  const valeurs = {
    connexion: texte(corps.connexion),
    reseau: texte(corps.reseau),
    telephone: texte(corps.telephone),
    langue: texte(corps.langue),
    comprehension: corps.comprehension,
    commentaire: texte(corps.commentaire) || null,
  }
  const [min, max] = COMMENTAIRE_TERRAIN
  const erreurs = {
    connexion: choix(valeurs.connexion, CONNEXIONS),
    reseau: choix(valeurs.reseau, TENUES),
    telephone: choix(valeurs.telephone, TENUES),
    langue: choix(valeurs.langue, LANGUES_TERRAIN),
    comprehension:
      valeurs.comprehension == null ? 'requis' : Number.isInteger(valeurs.comprehension) && valeurs.comprehension >= 1 && valeurs.comprehension <= 5 ? null : 'format_invalide',
    commentaire: !valeurs.commentaire ? null : valeurs.commentaire.length < min ? 'trop_court' : valeurs.commentaire.length > max ? 'trop_long' : null,
  }
  return { valeurs, erreurs }
}
