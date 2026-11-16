import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { rendreA, simulerApi } from './outils.jsx'

const ADMIN = { id: '1', role: 'admin', statut: 'valide', email: 'admin@nakayo.test', nom: 'Équipe' }
const ALERTE = {
  id: '7',
  code: 'meme_reseau',
  libelle: 'Même Wi-Fi dans une campagne',
  detail: '2 testeurs de la campagne envoient leurs rapports depuis le même Wi-Fi.',
  statut: 'ouverte',
  creeLe: '2026-11-16T23:10:00.000Z',
  testeurs: [
    { id: '4', nom: 'Afi Dossou', telephone: '+2290197000004', statut: 'valide' },
    { id: '5', nom: 'Koffi Agbo', telephone: '+2290197000005', statut: 'suspendu' },
  ],
  campagne: { id: '3', appNom: 'Marché Facile' },
  traiteeLe: null,
  note: null,
}

function api(table) {
  return simulerApi({ 'GET /api/auth/moi': { corps: { utilisateur: ADMIN } }, ...table })
}

describe('Back-office : alertes de fraude (US-28)', () => {
  it('liste les alertes à examiner et en écarte une avec une note', async () => {
    const user = userEvent.setup()
    const serveur = api({
      'GET /api/admin/alertes': { corps: { alertes: [ALERTE], total: 1, page: 1, parPage: 20 } },
      'POST /api/admin/alertes/7/decision': { corps: { alerte: { ...ALERTE, statut: 'ecartee', traiteeLe: '2026-11-17T08:00:00.000Z', note: 'Colocataires.' } } },
    })
    rendreA('/admin/alertes')

    const carte = (await screen.findByRole('heading', { name: 'Même Wi-Fi dans une campagne' })).closest('article')
    expect(screen.getByRole('heading', { name: '1 alerte à examiner' })).toBeInTheDocument()
    expect(within(carte).getByText('Campagne : Marché Facile')).toBeInTheDocument()
    expect(within(carte).getByText(/Koffi Agbo/).closest('li')).toHaveTextContent('compte suspendu')
    await user.type(within(carte).getByLabelText('Note (facultative)'), 'Colocataires.')
    await user.click(within(carte).getByRole('button', { name: 'Écarter' }))

    expect(await screen.findByText('Alerte écartée.')).toBeInTheDocument()
    expect(serveur.appelsVers('POST', '/api/admin/alertes/7/decision')[0].corps).toEqual({ decision: 'ecartee', note: 'Colocataires.' })
    expect(screen.queryByRole('heading', { name: 'Même Wi-Fi dans une campagne' })).not.toBeInTheDocument()
  })

  it('affiche les alertes confirmées avec leur note', async () => {
    const user = userEvent.setup()
    const confirmee = { ...ALERTE, statut: 'confirmee', traiteeLe: '2026-11-17T08:00:00.000Z', note: 'Deux comptes, une seule personne.' }
    api({ 'GET /api/admin/alertes': [{ corps: { alertes: [], total: 0, page: 1, parPage: 20 } }, { corps: { alertes: [confirmee], total: 1, page: 1, parPage: 20 } }] })
    rendreA('/admin/alertes')

    expect(await screen.findByRole('heading', { name: 'Aucune alerte' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirmées' }))
    expect(await screen.findByText('Deux comptes, une seule personne.')).toBeInTheDocument()
    expect(screen.getByText(/Fraude confirmée le/)).toBeInTheDocument()
  })
})
