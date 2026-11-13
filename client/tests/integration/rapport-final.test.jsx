import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RapportFinal } from '../../src/pages/apps/RapportFinal.jsx'
import { simulerApi } from './outils.jsx'

const BROUILLON = {
  parties: [
    {
      titre: 'À propos de votre test fermé',
      questions: [{ id: 'engagement', question: 'Décrivez l’engagement des testeurs pendant votre test fermé.', reponse: 'Sur 14 jours de test, les testeurs ont utilisé l’app 6 h 10 min au total.' }],
    },
    {
      titre: 'À propos de votre application',
      questions: [{ id: 'public', question: 'Qui est le public cible de votre application ?', reponse: '[À compléter : décrivez les personnes à qui s’adresse l’app.]' }],
    },
  ],
}
const PRET = { pret: true, disponibleLe: '2026-11-25', bilan: {}, brouillon: BROUILLON, decisionGoogle: null }
const URL_RAPPORT = 'GET /api/apps/7/campagne/rapport'

beforeEach(() => localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

describe('Rapport de fin (US-36)', () => {
  it('avant le 14e jour : la date de disponibilité', async () => {
    simulerApi({ [URL_RAPPORT]: { corps: { rapport: { pret: false, disponibleLe: '2026-11-25', bilan: null, brouillon: null, decisionGoogle: null } } } })
    render(<RapportFinal appId="7" />)
    expect(await screen.findByText('Disponible le 25 novembre 2026, au 14e jour du test. Nous vous prévenons par email.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Télécharger le rapport PDF' })).not.toBeInTheDocument()
  })

  it('brouillon modifiable, gardé dans le navigateur, avec les réponses à compléter signalées', async () => {
    const user = userEvent.setup()
    simulerApi({ [URL_RAPPORT]: { corps: { rapport: PRET } } })
    const { unmount } = render(<RapportFinal appId="7" />)
    const publicCible = await screen.findByLabelText('Qui est le public cible de votre application ?')
    expect(screen.getByRole('heading', { name: '1. À propos de votre test fermé' })).toBeInTheDocument()
    expect(screen.getByText(/1 réponse à compléter/)).toBeInTheDocument()
    expect(screen.getByText('À compléter avant l’envoi')).toBeInTheDocument()

    await user.clear(publicCible)
    await user.type(publicCible, 'Les familles de Cotonou qui font leurs courses au marché.')
    expect(screen.getByText(/Toutes les réponses sont complétées/)).toBeInTheDocument()
    expect(screen.queryByText('À compléter avant l’envoi')).not.toBeInTheDocument()

    unmount()
    render(<RapportFinal appId="7" />)
    expect(await screen.findByLabelText('Qui est le public cible de votre application ?')).toHaveValue('Les familles de Cotonou qui font leurs courses au marché.')
    await user.click(screen.getByRole('button', { name: 'Revenir au brouillon proposé : Qui est le public cible de votre application ?' }))
    expect(screen.getByLabelText('Qui est le public cible de votre application ?')).toHaveValue('[À compléter : décrivez les personnes à qui s’adresse l’app.]')
  })

  it('enregistre la réponse de Google', async () => {
    const user = userEvent.setup()
    const serveur = simulerApi({
      [URL_RAPPORT]: { corps: { rapport: PRET } },
      'PUT /api/apps/7/campagne/decision-google': [
        { statut: 422, corps: { erreur: { code: 'validation', message: 'Certains champs sont invalides.', champs: { le: 'format_invalide' } } } },
        { corps: { decisionGoogle: { decision: 'acceptee', le: '2026-11-27', saisieLe: '2026-11-28T09:00:00.000Z' } } },
      ],
    })
    render(<RapportFinal appId="7" />)
    const formulaire = await screen.findByRole('form', { name: 'Réponse de Google' })
    await user.click(within(formulaire).getByRole('button', { name: 'Enregistrer la réponse' }))
    expect(within(formulaire).getByText('Choisissez la réponse de Google.')).toBeInTheDocument()

    await user.click(within(formulaire).getByLabelText('Accès à la production accepté'))
    await user.type(within(formulaire).getByLabelText(/Date de la réponse/), '2027-01-01')
    await user.click(within(formulaire).getByRole('button', { name: 'Enregistrer la réponse' }))
    expect(await within(formulaire).findByText('Indiquez une date passée ou aujourd’hui.')).toBeInTheDocument()

    await user.click(within(formulaire).getByRole('button', { name: 'Enregistrer la réponse' }))
    expect(await within(formulaire).findByText('Merci, réponse enregistrée : accès accepté le 27 novembre 2026.')).toBeInTheDocument()
    await waitFor(() => expect(serveur.appelsVers('PUT', '/api/apps/7/campagne/decision-google')).toHaveLength(2))
    expect(serveur.appelsVers('PUT', '/api/apps/7/campagne/decision-google')[0].corps).toEqual({ decision: 'acceptee', le: '2027-01-01' })
  })

  it('erreur réseau puis nouvel essai', async () => {
    const user = userEvent.setup()
    simulerApi({ [URL_RAPPORT]: ['reseau', { corps: { rapport: PRET } }] })
    render(<RapportFinal appId="7" />)
    await screen.findByRole('alert')
    await user.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByRole('button', { name: 'Télécharger le rapport PDF' })).toBeInTheDocument()
  })
})
