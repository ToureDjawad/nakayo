import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { vi } from 'vitest'
import { routes } from '../routes.jsx'

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
