import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { rendreA, simulerFetch } from './outils.jsx'

describe('Navigation', () => {
  it('mène de l’accueil à l’inscription', async () => {
    simulerFetch({ corps: { api: 'ok', base: 'ok' } })
    const user = userEvent.setup()
    rendreA('/')

    await user.click(screen.getByRole('link', { name: 'Créer un compte développeur' }))
    expect(screen.getByRole('heading', { name: 'Créer un compte développeur' })).toBeInTheDocument()
  })

  it('affiche une page introuvable pour une adresse inconnue', () => {
    simulerFetch()
    rendreA('/nimporte-quoi')
    expect(screen.getByRole('heading', { name: 'Page introuvable' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Retour à l’accueil' })).toHaveAttribute('href', '/')
  })

  it('ouvre les textes juridiques dans un nouvel onglet pour ne pas perdre la saisie', () => {
    simulerFetch()
    rendreA('/inscription')
    const cgu = screen.getByRole('link', { name: /conditions d’utilisation/ })
    expect(cgu).toHaveAttribute('target', '_blank')
    expect(cgu).toHaveAccessibleName('conditions d’utilisation (s’ouvre dans un nouvel onglet)')
  })

  it('relie chaque champ à son libellé et à son aide', () => {
    simulerFetch()
    rendreA('/inscription')
    expect(screen.getByLabelText('Nom de développeur Google Play')).toHaveAccessibleDescription(
      'Tel qu’il apparaît sur votre fiche Google Play.',
    )
    expect(screen.getByRole('button', { name: 'Afficher' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('affiche ou masque le mot de passe', async () => {
    simulerFetch()
    const user = userEvent.setup()
    rendreA('/inscription')
    const champ = screen.getByLabelText('Mot de passe')
    expect(champ).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'Afficher' }))
    expect(champ).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Masquer' })).toHaveAttribute('aria-pressed', 'true')
  })
})
