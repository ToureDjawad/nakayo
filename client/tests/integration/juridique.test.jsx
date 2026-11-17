import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { rendreA, simulerApi } from './outils.jsx'

// US-04 : CGU et politique de confidentialité, publiques.
const BASE = { 'GET /api/auth/moi': { statut: 401, corps: { erreur: { code: 'non_connecte' } } } }

describe('textes juridiques (US-04)', () => {
  it('les CGU contiennent les engagements des testeurs et des développeurs', async () => {
    simulerApi(BASE)
    rendreA('/conditions-utilisation')
    expect(await screen.findByRole('heading', { level: 1, name: 'Conditions générales d’utilisation' })).toBeInTheDocument()
    expect(screen.getByText(/ne publier aucune note ni aucun avis public/)).toBeInTheDocument()
    expect(screen.getByText(/ne pas vous désinscrire du test fermé avant la clôture/)).toBeInTheDocument()
    expect(screen.getByText(/ne demande jamais l’accès à votre Play Console ni à vos clés de signature/)).toBeInTheDocument()
    expect(screen.getByText(/Nakayo ne peut pas garantir la décision de Google/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Fraude et sanctions' })).toHaveAttribute('href', '#sanctions')
  })

  it('la politique de confidentialité explique le suivi du temps et de la position', async () => {
    simulerApi(BASE)
    rendreA('/confidentialite')
    expect(await screen.findByRole('heading', { level: 1, name: 'Politique de confidentialité' })).toBeInTheDocument()
    expect(screen.getByText(/le temps passé dans les apps que vous testez, et seulement celles-là/)).toBeInTheDocument()
    expect(screen.getByText(/Elle n’est jamais suivie en arrière-plan/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'conditions générales d’utilisation' })).toHaveAttribute('href', '/conditions-utilisation')
  })
})
