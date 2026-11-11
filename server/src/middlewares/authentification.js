import { lireCookie } from '../lib/cookies.js'
import { interdit, nonAuthentifie } from '../lib/erreurs.js'
import { lireSession, NOM_COOKIE } from '../services/sessions.js'

// Jeton de la requête : en-tête Bearer (app Android) ou cookie (site web).
export function jetonDeLaRequete(req) {
  const autorisation = req.headers.authorization
  if (autorisation?.startsWith('Bearer ')) return autorisation.slice(7).trim() || null
  return lireCookie(req, NOM_COOKIE)
}

// Charge la session si elle existe : req.session = { sessionId, client, utilisateur } ou null.
export function chargerSession({ pool, maintenant }) {
  return async (req, _res, next) => {
    try {
      const jeton = jetonDeLaRequete(req)
      req.session = jeton ? await lireSession(pool, { jeton, maintenant: maintenant() }) : null
      next()
    } catch (erreur) {
      next(erreur)
    }
  }
}

export function exigerSession(req, _res, next) {
  next(req.session ? undefined : nonAuthentifie())
}

export function exigerRole(...roles) {
  return (req, _res, next) => {
    if (!req.session) return next(nonAuthentifie())
    next(roles.includes(req.session.utilisateur.role) ? undefined : interdit())
  }
}
