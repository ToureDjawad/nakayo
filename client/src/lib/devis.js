// Devis de l'offre Lancement Afrique (US-37).
// Mêmes listes que le serveur (docs/api-offres.md §4.1).
export const PAYS_DEVIS = [
  ["BJ", "Bénin"],
  ["TG", "Togo"],
  ["CI", "Côte d’Ivoire"],
  ["SN", "Sénégal"],
  ["BF", "Burkina Faso"],
  ["NG", "Nigeria"],
  ["NE", "Niger"],
  ["ML", "Mali"],
  ["GH", "Ghana"],
];
export const LANGUES_DEVIS = [
  ["fr", "Français"],
  ["en", "Anglais"],
  ["fon", "Fon"],
  ["yo", "Yoruba"],
];

// « BJ, TG » → « Bénin, Togo ».
export const nomsDe = (liste, codes) =>
  codes.map((c) => liste.find(([code]) => code === c)?.[1] ?? c).join(", ");
