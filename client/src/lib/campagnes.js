// Aides d'affichage des campagnes de test (docs/api-sprint3.md §1).

// Fichier CSV des Gmail des testeurs : la méthode de secours d'US-13.
export function csvGmails(testeurs) {
  return ['gmail', ...testeurs.map((t) => t.gmail)].join('\n') + '\n'
}

// Propose le fichier au téléchargement dans le navigateur.
export function telechargerTexte(contenu, nomFichier, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([contenu], { type }))
  const lien = document.createElement('a')
  lien.href = url
  lien.download = nomFichier
  document.body.append(lien)
  lien.click()
  lien.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// « 12 nov. 2026 » à l'heure du Bénin.
const formatDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Porto-Novo' })
export function dateCourte(iso) {
  return iso ? formatDate.format(new Date(iso)) : ''
}

// 9120 secondes -> « 2 h 32 min » ; 95 -> « 1 min » ; 0 -> « 0 min ».
export function duree(secondes) {
  const minutes = Math.floor(secondes / 60)
  if (minutes < 60) return `${minutes} min`
  const heures = Math.floor(minutes / 60)
  const reste = minutes % 60
  return reste ? `${heures} h ${String(reste).padStart(2, '0')} min` : `${heures} h`
}

// « 2026-11-12 » -> « 12 nov. » (date du Bénin, sans heure).
const formatJour = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })
export function jourCourt(jour) {
  return jour ? formatJour.format(new Date(`${jour}T00:00:00Z`)) : ''
}

// « 2026-11-25 » -> « 25 nov. 2026 ».
const formatJourLong = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
export function jourLong(jour) {
  return jour ? formatJourLong.format(new Date(`${jour}T00:00:00Z`)) : ''
}

// 0.857 -> « 86 % » (espace insécable avant le signe).
export function pourcentage(part) {
  return `${Math.round(part * 100)} %`
}
