import { ErreurHttp } from './erreurs.js'

// Limites de requêtes en mémoire (fenêtre glissante). Suffisant pour une seule instance
// de l'API ; à déplacer dans Redis ou PostgreSQL si on en lance plusieurs.
export function creerLimiteur({ max, fenetreMs, maintenant = () => Date.now() }) {
  const entrees = new Map()

  function recentes(cle) {
    const limite = maintenant() - fenetreMs
    const liste = (entrees.get(cle) ?? []).filter((t) => t > limite)
    if (liste.length) entrees.set(cle, liste)
    else entrees.delete(cle)
    return liste
  }

  return {
    // Lève une erreur 429 si la limite est atteinte, sinon compte la tentative.
    consommer(cle) {
      const liste = recentes(cle)
      if (liste.length >= max) {
        const retryAfter = Math.max(1, Math.ceil((liste[0] + fenetreMs - maintenant()) / 1000))
        throw new ErreurHttp(429, 'trop_de_requetes', { message: 'Trop de tentatives.', retryAfter })
      }
      entrees.set(cle, [...liste, maintenant()])
    },
    // Vérifie sans compter (pour ne compter que les échecs, ex. connexion).
    verifier(cle) {
      const liste = recentes(cle)
      if (liste.length >= max) {
        const retryAfter = Math.max(1, Math.ceil((liste[0] + fenetreMs - maintenant()) / 1000))
        throw new ErreurHttp(429, 'trop_de_requetes', { message: 'Trop de tentatives.', retryAfter })
      }
    },
    compter(cle) {
      entrees.set(cle, [...recentes(cle), maintenant()])
    },
    effacer(cle) {
      entrees.delete(cle)
    },
    vider() {
      entrees.clear()
    },
  }
}
