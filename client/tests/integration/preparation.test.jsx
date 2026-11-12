import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { rendreA, simulerApi } from './outils.jsx'

const DEV = { id: '2', role: 'developpeur', statut: 'valide', email: 'awa@studio.bj', emailVerifie: true, nom: 'Studio Awa', pays: 'BJ' }
const TOUT = ['testeurs_ajoutes', 'fiche_complete', 'version_publiee', 'pays_coches', 'pas_de_test_interne', 'mises_a_jour_prevues']
const VIDE = { elements: [], complete: false, completeLe: null }
const APP = { id: '7', nom: 'Marché Facile', package: 'bj.studioawa.marche', statut: 'validee', preparation: VIDE }
const BASE = {
  'GET /api/auth/moi': { corps: { utilisateur: DEV } },
  'GET /api/apps/:id': { corps: { app: APP } },
  'GET /api/apps/:id/preparation': { corps: { preparation: VIDE, elements: TOUT, groupeTesteurs: 'testeurs@nakayo.test' } },
}

afterEach(() => vi.unstubAllGlobals())

describe('Préparer le lancement (US-42, US-13)', () => {
  it('montre les six points, le groupe des testeurs et l’avancement', async () => {
    simulerApi(BASE)
    rendreA('/mon-compte/apps/7/preparation')
    expect(await screen.findByText('0 sur 6 points vérifiés')).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox')).toHaveLength(6)
    expect(screen.getByText('testeurs@nakayo.test')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Le Bénin est coché dans les pays du test fermé' })).toHaveAccessibleDescription(/Pays\/régions/)
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
  })

  it('enregistre les points cochés et annonce ce qui reste', async () => {
    const user = userEvent.setup()
    const serveur = simulerApi({
      ...BASE,
      'PUT /api/apps/:id/preparation': (r) => ({
        corps: { app: { ...APP, preparation: { elements: r.corps.elements, complete: r.corps.elements.length === 6, completeLe: null } } },
      }),
    })
    rendreA('/mon-compte/apps/7/preparation')
    await user.click(await screen.findByRole('checkbox', { name: /La fiche Play Store est complète/ }))
    await user.click(screen.getByRole('checkbox', { name: /Le groupe des testeurs Nakayo/ }))
    expect(screen.getByText('2 sur 6 points vérifiés')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByText(/Il reste 4 points à vérifier/)).toBeInTheDocument()
    expect(serveur.appelsVers('PUT', '/api/apps/7/preparation')[0].corps).toEqual({ elements: ['testeurs_ajoutes', 'fiche_complete'] })
  })

  it('tout coché sur une app validée : la campagne peut démarrer', async () => {
    const user = userEvent.setup()
    simulerApi({
      ...BASE,
      'PUT /api/apps/:id/preparation': { corps: { app: { ...APP, preparation: { elements: TOUT, complete: true, completeLe: '2026-11-12T09:00:00.000Z' } } } },
    })
    rendreA('/mon-compte/apps/7/preparation')
    await screen.findByText('0 sur 6 points vérifiés')
    for (const caseACocher of screen.getAllByRole('checkbox')) await user.click(caseACocher)
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByText('Votre app est validée et prête : la campagne peut démarrer.')).toBeInTheDocument()
  })

  it('sans groupe configuré, explique que l’adresse arrive par email', async () => {
    simulerApi({ ...BASE, 'GET /api/apps/:id/preparation': { corps: { preparation: VIDE, elements: TOUT, groupeTesteurs: null } } })
    rendreA('/mon-compte/apps/7/preparation')
    expect(await screen.findByText(/L’équipe vous envoie l’adresse du groupe par email/)).toBeInTheDocument()
  })

  it('un brouillon renvoie d’abord au paiement', async () => {
    simulerApi({ ...BASE, 'GET /api/apps/:id': { corps: { app: { ...APP, statut: 'brouillon' } } } })
    rendreA('/mon-compte/apps/7/preparation')
    expect(await screen.findByText('La préparation commence une fois l’offre payée.')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('erreur à l’enregistrement : message et cases conservées', async () => {
    const user = userEvent.setup()
    simulerApi({ ...BASE, 'PUT /api/apps/:id/preparation': 'reseau' })
    rendreA('/mon-compte/apps/7/preparation')
    await user.click(await screen.findByRole('checkbox', { name: /La fiche Play Store est complète/ }))
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByText(/Impossible de joindre le serveur/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('checkbox', { name: /La fiche Play Store est complète/ })).toBeChecked())
  })
})
