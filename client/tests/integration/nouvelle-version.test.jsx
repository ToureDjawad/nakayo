import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { NouvelleVersion } from '../../src/pages/apps/NouvelleVersion.jsx'
import { simulerApi } from './outils.jsx'

// US-44 : annoncer une nouvelle version aux testeurs.
const V = { numero: '1.0.3', changements: 'Le panier ne se vide plus.', annonceeLe: '2026-11-14T09:00:00.000Z', jourCampagne: 3, testeursSurVersion: 0 }

describe('Nouvelle version (US-44)', () => {
  it('annonce une version et l’ajoute à l’historique', async () => {
    const user = userEvent.setup()
    const serveur = simulerApi({
      'GET /api/apps/7/campagne/versions': { corps: { versions: [] } },
      'POST /api/apps/7/campagne/versions': [
        { statut: 409, corps: { erreur: { code: 'conflit', message: 'Valeur déjà utilisée.', champs: { numero: 'deja_utilise' } } } },
        { statut: 201, corps: { versions: [V] } },
      ],
    })
    render(<NouvelleVersion appId="7" enCours />)
    await user.click(await screen.findByRole('button', { name: 'Annoncer la version' }))
    expect(screen.getByText('Indiquez le numéro de la version.')).toBeInTheDocument()

    await user.type(screen.getByLabelText(/Numéro de version/), '1.0.3')
    await user.type(screen.getByLabelText(/Ce qui a changé/), 'Le panier ne se vide plus.')
    await user.click(screen.getByRole('button', { name: 'Annoncer la version' }))
    expect(await screen.findByText('Cette version est déjà annoncée.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Annoncer la version' }))
    expect(await screen.findByText(/Version 1.0.3 annoncée/)).toBeInTheDocument()
    expect(screen.getByText(/jour 3, le 14 nov\. 2026/)).toBeInTheDocument()
    expect(serveur.appelsVers('POST', '/api/apps/7/campagne/versions')[1].corps).toEqual({ numero: '1.0.3', changements: 'Le panier ne se vide plus.' })
  })

  it('après le test : historique seul, sans formulaire', async () => {
    simulerApi({ 'GET /api/apps/7/campagne/versions': { corps: { versions: [V] } } })
    render(<NouvelleVersion appId="7" enCours={false} />)
    expect(await screen.findByText('Le panier ne se vide plus.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Annoncer la version' })).not.toBeInTheDocument()
  })
})
