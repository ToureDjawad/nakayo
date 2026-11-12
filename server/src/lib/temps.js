// Calendrier des campagnes à l'heure du Bénin (UTC+1, sans heure d'été).
const DECALAGE_BENIN_MS = 60 * 60 * 1000
export const JOUR_MS = 24 * 60 * 60 * 1000

// Date « AAAA-MM-JJ » au Bénin pour un instant donné.
export function jourBenin(instant) {
  return new Date(new Date(instant).getTime() + DECALAGE_BENIN_MS).toISOString().slice(0, 10)
}

// Instant du début (minuit) d'un jour du Bénin.
export function debutJourBenin(jour) {
  return new Date(Date.parse(`${jour}T00:00:00Z`) - DECALAGE_BENIN_MS)
}

export function ajouterJours(jour, nombre) {
  return new Date(Date.parse(`${jour}T00:00:00Z`) + nombre * JOUR_MS).toISOString().slice(0, 10)
}

// Nombre de jours entre deux dates « AAAA-MM-JJ » (b - a).
export function ecartJours(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / JOUR_MS)
}
