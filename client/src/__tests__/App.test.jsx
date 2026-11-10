import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../App.jsx'

function mockFetch(reponse) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(reponse)
}

describe('App', () => {
  it("affiche ok quand l'API et la base répondent", async () => {
    mockFetch(async () => ({ json: async () => ({ api: 'ok', base: 'ok' }) }))
    render(<App />)
    expect(await screen.findAllByText('ok')).toHaveLength(2)
  })

  it("signale une API injoignable quand l'appel échoue", async () => {
    mockFetch(async () => {
      throw new Error('réseau coupé')
    })
    render(<App />)
    expect(await screen.findByText('injoignable')).toBeInTheDocument()
    expect(screen.getByText('inconnue')).toBeInTheDocument()
  })
})
