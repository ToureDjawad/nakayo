// Résumé d'une ligne des contrôles automatiques, affiché en tête de carte.
export function resumeControles(controles) {
  const liste = controles?.liste ?? []
  const echecs = liste.filter((c) => c.resultat === 'echec').length
  const alertes = liste.filter((c) => c.resultat === 'alerte').length
  if (controles?.etat === 'en_cours') return { texte: 'Contrôles en cours', ton: 'discret' }
  if (!liste.length) return { texte: 'Aucun contrôle', ton: 'discret' }
  const morceaux = []
  if (echecs) morceaux.push(`${echecs} ${echecs > 1 ? 'échecs' : 'échec'}`)
  if (alertes) morceaux.push(`${alertes} à vérifier`)
  if (!morceaux.length) return { texte: 'Contrôles conformes', ton: 'succes' }
  return { texte: morceaux.join(', '), ton: echecs ? 'erreur' : 'alerte' }
}
