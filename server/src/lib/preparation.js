// Liste de vérification avant le lancement (US-42) ; le premier point couvre US-13.
// Ce sont les causes de refus Google les plus fréquentes.
export const ELEMENTS_PREPARATION = [
  'testeurs_ajoutes',
  'fiche_complete',
  'version_publiee',
  'pays_coches',
  'pas_de_test_interne',
  'mises_a_jour_prevues',
]

// Une préparation n'a de sens qu'une fois l'offre payée, et avant le refus de l'app.
export const STATUTS_PREPARATION = ['en_verification', 'validee']

// Corps { elements: [...] } : liste de codes connus, sans doublon (l'ordre n'importe pas).
export function lirePreparation(corps) {
  const { elements } = corps
  if (!Array.isArray(elements)) return { erreur: 'requis' }
  if (elements.some((e) => typeof e !== 'string' || !ELEMENTS_PREPARATION.includes(e))) return { erreur: 'valeur_inconnue' }
  return { valeurs: ELEMENTS_PREPARATION.filter((e) => elements.includes(e)) }
}
