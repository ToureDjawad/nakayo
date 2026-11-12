import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { rendreA, simulerFetch } from './outils.jsx'

describe('Accueil', () => {
  it('présente la règle, le fonctionnement, l’offre et la FAQ, sans bloc de développement', () => {
    simulerFetch()
    rendreA('/')
    expect(screen.getByRole('heading', { level: 1, name: /12 testeurs pendant 14 jours/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Comment ça marche' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Une seule offre, tout compris' })).toBeInTheDocument()
    expect(screen.getAllByText(/17\s500 FCFA/).length).toBeGreaterThan(0)
    expect(screen.queryByText('Environnement de développement')).not.toBeInTheDocument()
    const legal = screen.getByRole('navigation', { name: 'Informations légales' })
    expect(within(legal).getByRole('link', { name: 'Conditions d’utilisation' })).toHaveAttribute('href', '/conditions-utilisation')
    expect(within(legal).getByRole('link', { name: 'Politique de confidentialité' })).toHaveAttribute('href', '/confidentialite')
  })

  it('déplie une réponse de la FAQ', async () => {
    simulerFetch()
    const user = userEvent.setup()
    rendreA('/')
    const question = screen.getByText('Comment payer ?')
    const details = question.closest('details')
    expect(details).not.toHaveAttribute('open')
    await user.click(question)
    expect(details).toHaveAttribute('open')
  })
})
