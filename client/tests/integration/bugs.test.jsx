import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { rendreA, simulerApi } from './outils.jsx'

// Bugs signalés côté développeur (US-34, docs/api-bugs.md §2).
const DEV = { id: '2', role: 'developpeur', statut: 'valide', email: 'awa@studio.bj', emailVerifie: true, nom: 'Studio Awa', pays: 'BJ' }
const BUG = {
  id: '8',
  titre: 'Le panier se vide',
  etapes: '1. Ajouter du riz.\n2. Quitter l’app.',
  resultatAttendu: 'Le riz reste dans le panier.',
  resultatObtenu: 'Le panier est vide.',
  gravite: 'bloquante',
  versionApp: '1.0.3',
  captures: ['/api/apps/7/bugs/8/captures/1'],
  statut: 'nouveau',
  motifRefus: null,
  signaleLe: '2026-11-13T09:00:00.000Z',
  decideLe: null,
  testeur: { numero: 3, modele: 'Spark 20', versionAndroid: '14' },
  decidable: true,
}
const MINEUR = { ...BUG, id: '9', titre: 'Texte coupé', gravite: 'mineure', captures: [], testeur: { numero: 5, modele: null, versionAndroid: null } }
const BASE = {
  'GET /api/auth/moi': { corps: { utilisateur: DEV } },
  'GET /api/support': { corps: { support: { whatsapp: null } } },
}
const LISTE = { 'GET /api/apps/:id/bugs': { corps: { bugs: [BUG, MINEUR], rapportsDeBugs: true } } }

describe('Bugs signalés (US-34)', () => {
  it('liste les bugs avec testeur, captures et filtre par gravité', async () => {
    const user = userEvent.setup()
    simulerApi({ ...BASE, ...LISTE })
    rendreA('/mon-compte/apps/7/bugs')
    expect(await screen.findByText(/2 bugs signalés : 2 à examiner, 0 accepté, 0 refusé/)).toBeInTheDocument()
    const carte = screen.getByRole('heading', { name: 'Le panier se vide' }).closest('li')
    expect(within(carte).getByText(/Testeur 3 · Spark 20, Android 14 · version 1\.0\.3/)).toBeInTheDocument()
    expect(within(carte).getByText('Bloquante')).toBeInTheDocument()
    expect(within(carte).getByRole('img', { name: 'Capture 1 du bug « Le panier se vide »' })).toHaveAttribute('src', '/api/apps/7/bugs/8/captures/1')

    await user.click(screen.getByRole('button', { name: 'Mineures' }))
    expect(screen.getByRole('button', { name: 'Mineures' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('heading', { name: 'Le panier se vide' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Texte coupé' })).toBeInTheDocument()
  })

  it('accepter met le bug à jour sans recharger la page', async () => {
    const user = userEvent.setup()
    const serveur = simulerApi({
      ...BASE,
      ...LISTE,
      'POST /api/apps/:id/bugs/:bugId/decision': { corps: { bug: { ...BUG, statut: 'accepte', decidable: false } } },
    })
    rendreA('/mon-compte/apps/7/bugs')
    await user.click(await screen.findByRole('button', { name: 'Accepter le bug « Le panier se vide »' }))
    await waitFor(() => expect(screen.getByText(/1 à examiner, 1 accepté, 0 refusé/)).toBeInTheDocument())
    expect(serveur.appelsVers('POST', '/api/apps/7/bugs/8/decision')[0].corps).toEqual({ decision: 'accepte' })
    expect(screen.queryByRole('button', { name: 'Accepter le bug « Le panier se vide »' })).not.toBeInTheDocument()
  })

  it('refuser demande un motif, puis l’envoie', async () => {
    const user = userEvent.setup()
    const serveur = simulerApi({
      ...BASE,
      ...LISTE,
      'POST /api/apps/:id/bugs/:bugId/decision': {
        corps: { bug: { ...MINEUR, statut: 'refuse', motifRefus: 'Comportement voulu.', decidable: false } },
      },
    })
    rendreA('/mon-compte/apps/7/bugs')
    await user.click(await screen.findByRole('button', { name: 'Refuser le bug « Texte coupé »' }))
    const motif = screen.getByLabelText('Motif du refus, vu par le testeur')
    expect(motif).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Confirmer le refus' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Expliquez le refus au testeur')
    expect(serveur.appelsVers('POST', '/api/apps/7/bugs/9/decision')).toHaveLength(0)

    await user.type(motif, 'Comportement voulu.')
    await user.click(screen.getByRole('button', { name: 'Confirmer le refus' }))
    expect(await screen.findByText('Comportement voulu.')).toBeInTheDocument()
    expect(serveur.appelsVers('POST', '/api/apps/7/bugs/9/decision')[0].corps).toEqual({ decision: 'refuse', motif: 'Comportement voulu.' })
  })

  it('offre Standard : propose de passer à Pro', async () => {
    simulerApi({ ...BASE, 'GET /api/apps/:id/bugs': { corps: { bugs: [], rapportsDeBugs: false } } })
    rendreA('/mon-compte/apps/7/bugs')
    expect(await screen.findByText('Les rapports de bugs avec captures font partie de l’Offre Pro.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Passer à l’Offre Pro' })).toHaveAttribute('href', '/mon-compte/apps/7/montee-en-gamme')
  })

  it('la carte d’une app Pro en campagne mène aux bugs', async () => {
    simulerApi({
      ...BASE,
      'GET /api/apps': {
        corps: {
          apps: [
            {
              id: '7',
              nom: 'Marché Facile',
              package: 'bj.studioawa.marche',
              statut: 'validee',
              offre: 'pro',
              campagne: { id: '3', statut: 'en_cours', demarreeLe: '2026-11-10T08:00:00.000Z' },
            },
          ],
        },
      },
    })
    rendreA('/mon-compte')
    expect(await screen.findByRole('link', { name: 'Bugs signalés pour Marché Facile' })).toHaveAttribute('href', '/mon-compte/apps/7/bugs')
  })
})
