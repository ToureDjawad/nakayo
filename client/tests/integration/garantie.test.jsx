import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Garantie } from '../../src/pages/apps/Garantie.jsx'
import { rendreA, simulerApi } from './outils.jsx'

// US-30 : garantie après un refus de Google.
const EMAIL = 'Votre demande d’accès à la production a été refusée : engagement des testeurs insuffisant.'
const GARANTIE = {
  id: '4',
  appId: '7',
  choix: 'nouvelle_campagne',
  motifGoogle: 'engagement_insuffisant',
  emailGoogle: EMAIL,
  statut: 'en_attente',
  motifRefus: null,
  decideLe: null,
  campagneOfferteDemarree: false,
  creeLe: '2026-11-20T09:00:00.000Z',
}

describe('Garantie côté développeur (US-30)', () => {
  it('rien tant que la garantie n’est pas possible', async () => {
    const serveur = simulerApi({ 'GET /api/apps/7/garantie': { corps: { garantie: null, possible: false, jusquau: null, raison: 'campagne_pas_terminee' } } })
    render(<Garantie appId="7" />)
    await vi.waitFor(() => expect(serveur.appelsVers('GET', '/api/apps/7/garantie')).toHaveLength(1))
    expect(screen.queryByRole('heading', { name: 'Garantie' })).not.toBeInTheDocument()
  })

  it('demande la garantie après un refus de Google', async () => {
    const user = userEvent.setup()
    const serveur = simulerApi({
      'GET /api/apps/7/garantie': { corps: { garantie: null, possible: true, jusquau: '2026-11-26', raison: null } },
      'POST /api/apps/7/garantie': { statut: 201, corps: { garantie: GARANTIE, possible: false, jusquau: null, raison: 'deja_demandee' } },
    })
    render(<Garantie appId="7" />)
    expect(await screen.findByText(/avant le 26 novembre 2026/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Demander la garantie' }))
    expect(screen.getByText('Collez l’email de refus de Google.')).toBeInTheDocument()
    expect(serveur.appelsVers('POST', '/api/apps/7/garantie')).toHaveLength(0)

    await user.click(screen.getByLabelText('Les testeurs n’ont pas assez utilisé l’app'))
    await user.type(screen.getByLabelText('Email de refus de Google'), EMAIL)
    await user.click(screen.getByLabelText('Une nouvelle campagne de 14 jours offerte'))
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Demander la garantie' }))

    expect(await screen.findByText(/Notre équipe l’examine/)).toBeInTheDocument()
    expect(serveur.appelsVers('POST', '/api/apps/7/garantie')[0].corps).toEqual({
      choix: 'nouvelle_campagne',
      motifGoogle: 'engagement_insuffisant',
      emailGoogle: EMAIL,
      engagement: true,
    })
  })

  it('acceptée : démarre la campagne offerte', async () => {
    const user = userEvent.setup()
    const demarree = vi.fn()
    const serveur = simulerApi({
      'GET /api/apps/7/garantie': { corps: { garantie: { ...GARANTIE, statut: 'acceptee' }, possible: false, jusquau: null, raison: 'deja_demandee' } },
      'POST /api/apps/7/campagne': { statut: 201, corps: { campagne: {} } },
    })
    render(<Garantie appId="7" onCampagneDemarree={demarree} />)
    await user.click(await screen.findByRole('button', { name: 'Démarrer la campagne offerte' }))
    await vi.waitFor(() => expect(demarree).toHaveBeenCalled())
    expect(serveur.appelsVers('POST', '/api/apps/7/campagne')).toHaveLength(1)
  })
})

describe('Garanties côté admin (US-30)', () => {
  it('refuse une demande avec un motif', async () => {
    const user = userEvent.setup()
    const enAttente = {
      ...GARANTIE,
      app: { id: '7', nom: 'Marché Facile', package: 'bj.studioawa.marche', offre: 'standard' },
      developpeur: { nom: 'Awa', email: 'awa@studio.bj' },
      campagne: { id: '3', demarreeLe: '2026-11-01T09:00:00.000Z', termineeLe: '2026-11-15T09:00:00.000Z', testeursAuBout: 9, preparationComplete: true },
    }
    const serveur = simulerApi({
      'GET /api/auth/moi': { corps: { utilisateur: { id: '1', role: 'admin', statut: 'valide', email: 'admin@nakayo.test', nom: 'Équipe' } } },
      'GET /api/admin/garanties': { corps: { garanties: [enAttente], total: 1, page: 1, parPage: 20 } },
      'POST /api/admin/garanties/4/decision': { corps: { garantie: { ...enAttente, statut: 'refusee' } } },
    })
    rendreA('/admin/garanties')
    expect(await screen.findByRole('heading', { name: 'Marché Facile' })).toBeInTheDocument()
    expect(screen.getByText('Engagement des testeurs insuffisant')).toBeInTheDocument()
    expect(screen.getByText(/9 testeurs au bout des 14 jours/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Refuser' }))
    await user.click(screen.getByRole('button', { name: 'Confirmer le refus' }))
    expect(screen.getByText('Indiquez le motif du refus.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Motif du refus'), 'Le refus de Google porte sur la politique de contenu.')
    await user.click(screen.getByRole('button', { name: 'Confirmer le refus' }))
    expect(await screen.findByText('Garantie refusée pour « Marché Facile ».')).toBeInTheDocument()
    expect(serveur.appelsVers('POST', '/api/admin/garanties/4/decision')[0].corps).toEqual({
      decision: 'refusee',
      motif: 'Le refus de Google porte sur la politique de contenu.',
    })
  })
})
