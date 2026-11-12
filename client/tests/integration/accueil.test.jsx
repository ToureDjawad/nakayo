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
    expect(screen.getByRole('heading', { name: 'Nos offres' })).toBeInTheDocument()
    expect(screen.getAllByText(/17\s400 FCFA/).length).toBeGreaterThan(0)
    const offres = within(screen.getByRole('heading', { name: 'Nos offres' }).parentElement).getAllByRole('listitem', { name: /Standard|Pro|Lancement Afrique/ })
    expect(offres.map((o) => o.getAttribute('aria-labelledby'))).toEqual(['offre-standard', 'offre-pro', 'offre-afrique'])
    expect(within(offres[0]).getByRole('link', { name: /Commencer/ })).toHaveAttribute('href', '/inscription')
    for (const offre of offres.slice(1)) {
      expect(within(offre).getByText('Bientôt disponible')).toBeInTheDocument()
      expect(within(offre).queryByRole('link')).not.toBeInTheDocument()
    }
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
