// API simulée : intercepte fetch() pour les routes décrites dans routes.js.
// Les routes absentes (ex. /api/health) partent vers le vrai serveur.
import { connecter, reinitialiser } from './base.js'
import { RESEAU_COUPE } from './http.js'
import { routes } from './routes.js'

const attendre = (ms) => new Promise((r) => setTimeout(r, ms))

function versRegex(chemin) {
  const motif = chemin.replace(/:([a-zA-Z]+)/g, '(?<$1>[^/]+)')
  return new RegExp(`^${motif}$`)
}

const table = routes.map((r) => ({ ...r, regex: versRegex(r.chemin) }))

function trouver(methode, chemin) {
  for (const route of table) {
    if (route.methode !== methode) continue
    const m = chemin.match(route.regex)
    if (m) return { route, params: m.groups ?? {} }
  }
  return null
}

export function installerMocks({ delai = 600 } = {}) {
  const fetchReel = window.fetch.bind(window)

  window.fetch = async (entree, options = {}) => {
    const url = new URL(typeof entree === 'string' ? entree : entree.url, window.location.origin)
    const methode = (options.method ?? 'GET').toUpperCase()
    const trouve = url.origin === window.location.origin ? trouver(methode, url.pathname) : null
    if (!trouve) return fetchReel(entree, options)

    await attendre(delai)
    if (options.signal?.aborted) throw new DOMException('Requête annulée', 'AbortError')

    let corps
    if (typeof options.body === 'string') {
      try {
        corps = JSON.parse(options.body)
      } catch {
        corps = undefined
      }
    } else {
      corps = options.body
    }

    const reponse = trouve.route.traiter({ corps, params: trouve.params, query: url.searchParams })
    if (reponse === RESEAU_COUPE) throw new TypeError('Failed to fetch')

    const entetes = { ...reponse.entetes }
    if (reponse.brut) return new Response(reponse.brut, { status: reponse.statut, headers: entetes })
    if (reponse.corps !== null) entetes['Content-Type'] = 'application/json'
    return new Response(reponse.corps === null ? null : JSON.stringify(reponse.corps), {
      status: reponse.statut,
      headers: entetes,
    })
  }

  window.nakayoMocks = { reinitialiser, connecter }
  console.info('[mocks] API simulée active (client/src/mocks/README.md). Remise à zéro : nakayoMocks.reinitialiser()')
}
