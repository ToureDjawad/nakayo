// Client HTTP unique du front. Le format des erreurs suit docs/api-sprint1.md (§1.3).

export class ErreurApi extends Error {
  constructor({ statut, code, message, champs, retryAfter, details }) {
    super(message || code)
    this.name = 'ErreurApi'
    this.statut = statut
    this.code = code
    this.champs = champs ?? null
    this.retryAfter = retryAfter ?? null
    this.details = details ?? {}
  }
}

export class ErreurReseau extends Error {
  constructor() {
    super('Réseau injoignable')
    this.name = 'ErreurReseau'
  }
}

async function lireJson(reponse) {
  const texte = await reponse.text()
  if (!texte) return null
  try {
    return JSON.parse(texte)
  } catch {
    return null
  }
}

export async function requete(chemin, { methode = 'GET', corps, signal } = {}) {
  let reponse
  let donnees
  try {
    reponse = await fetch(`/api${chemin}`, {
      method: methode,
      headers: corps === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: corps === undefined ? undefined : JSON.stringify(corps),
      credentials: 'same-origin',
      signal,
    })
    donnees = reponse.status === 204 ? null : await lireJson(reponse)
  } catch (e) {
    if (e?.name === 'AbortError') throw e
    throw new ErreurReseau()
  }

  if (!reponse.ok) {
    const erreur = donnees && typeof donnees.erreur === 'object' ? donnees.erreur : {}
    const { code, message, champs, ...details } = erreur
    throw new ErreurApi({
      statut: reponse.status,
      code: code ?? 'erreur_inconnue',
      message,
      champs,
      retryAfter: Number(reponse.headers.get('Retry-After')) || null,
      details,
    })
  }
  return donnees
}
