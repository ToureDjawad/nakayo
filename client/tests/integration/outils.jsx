import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { routes } from '../../src/routes.jsx'

// Rend l'application à une adresse donnée, avec le vrai routeur.
export function rendreA(adresse, etat) {
  const routeur = createMemoryRouter(routes, { initialEntries: [{ pathname: adresse.split('?')[0], search: adresse.includes('?') ? `?${adresse.split('?')[1]}` : '', state: etat }] })
  return { routeur, ...render(<RouterProvider router={routeur} />) }
}

// Remplace fetch par une file de réponses : chaque élément est
// { statut, corps, entetes } ou 'reseau' pour simuler une coupure.
export function simulerFetch(...reponses) {
  const file = [...reponses]
  const espion = vi.fn(async () => {
    const r = file.shift()
    if (!r) throw new Error('Appel fetch inattendu')
    if (r === 'reseau') throw new TypeError('Failed to fetch')
    return new Response(r.corps === undefined ? null : JSON.stringify(r.corps), {
      status: r.statut ?? 200,
      headers: { 'Content-Type': 'application/json', ...(r.entetes ?? {}) },
    })
  })
  vi.stubGlobal('fetch', espion)
  return espion
}

export function corpsEnvoye(espion, appel = 0) {
  return JSON.parse(espion.mock.calls[appel][1].body)
}

// Faux serveur routé : { 'GET /api/auth/moi': reponse | (requete) => reponse | [reponses successives] }.
// Une réponse est { statut, corps, entetes } ou 'reseau'. Les appels sont gardés dans `appels`.
export function simulerApi(table) {
  const appels = []
  const sequences = new Map()
  const espion = vi.fn(async (url, options = {}) => {
    const adresse = new URL(url, 'http://localhost')
    const methode = (options.method ?? 'GET').toUpperCase()
    const corps = typeof options.body === 'string' ? JSON.parse(options.body) : undefined
    const requete = { methode, chemin: adresse.pathname, query: adresse.searchParams, corps }
    appels.push(requete)

    const cle = Object.keys(table).find((motif) => {
      const [m, chemin] = motif.split(' ')
      const regex = new RegExp(`^${chemin.replace(/:[a-zA-Z]+/g, '[^/]+')}$`)
      return m === methode && regex.test(adresse.pathname)
    })
    if (!cle) throw new Error(`Appel non prévu : ${methode} ${adresse.pathname}`)

    let r = table[cle]
    if (Array.isArray(r)) {
      const rang = sequences.get(cle) ?? 0
      sequences.set(cle, rang + 1)
      r = r[Math.min(rang, r.length - 1)]
    }
    if (typeof r === 'function') r = r(requete)
    if (r === 'reseau') throw new TypeError('Failed to fetch')
    const statut = r.statut ?? 200
    return new Response(statut === 204 || r.corps === undefined ? null : JSON.stringify(r.corps), {
      status: statut,
      headers: { 'Content-Type': 'application/json', ...(r.entetes ?? {}) },
    })
  })
  vi.stubGlobal('fetch', espion)
  return {
    espion,
    appels,
    appelsVers: (methode, chemin) => appels.filter((a) => a.methode === methode && a.chemin === chemin),
  }
}
