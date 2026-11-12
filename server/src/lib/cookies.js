import { DUREE_SESSION_MS, NOM_COOKIE } from '../services/sessions.js'

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

export function optionsCookie(config) {
  return { httpOnly: true, sameSite: 'lax', secure: config.cookieSecurise, path: '/' }
}

// Pose le cookie de session web : 30 jours, renouvelés quand la session est prolongée.
export function poserCookieSession(res, config, jeton) {
  res.cookie(NOM_COOKIE, jeton, { ...optionsCookie(config), maxAge: DUREE_SESSION_MS })
}
