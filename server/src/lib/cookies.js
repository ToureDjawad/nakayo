// Lecture d'un cookie sans dépendance supplémentaire.
export function lireCookie(req, nom) {
  const entete = req.headers.cookie
  if (!entete) return null
  for (const morceau of entete.split(';')) {
    const egal = morceau.indexOf('=')
    if (egal === -1) continue
    if (morceau.slice(0, egal).trim() === nom) {
      try {
        return decodeURIComponent(morceau.slice(egal + 1).trim())
      } catch {
        return null
      }
    }
  }
  return null
}
