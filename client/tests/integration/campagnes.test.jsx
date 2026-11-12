import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { rendreA, simulerApi } from './outils.jsx'

const DEV = { id: '2', role: 'developpeur', statut: 'valide', email: 'awa@studio.bj', emailVerifie: true, nom: 'Studio Awa', pays: 'BJ' }
const ADMIN = { id: '1', role: 'admin', statut: 'valide', email: 'admin@nakayo.bj', nom: 'Équipe Nakayo' }
const TOUT = ['testeurs_ajoutes', 'fiche_complete', 'version_publiee', 'pays_coches', 'pas_de_test_interne', 'mises_a_jour_prevues']
const COMPLETE = { elements: TOUT, complete: true, completeLe: '2026-11-12T09:00:00.000Z' }
const APP = { id: '7', nom: 'Marché Facile', package: 'bj.studioawa.marche', statut: 'validee', preparation: COMPLETE, campagne: null }

function testeur(n, champs = {}) {
  return {
    id: String(100 + n),
    statut: 'active',
    ville: n % 2 ? 'Cotonou' : 'Parakou',
    gmail: `testeur${n}@gmail.com`,
    inscriptionConfirmee: false,
    installationConfirmee: false,
    joursValides: 0,
    numero: n,
    ...champs,
  }
}

function campagne(champs = {}) {
  const testeurs = champs.testeurs ?? Array.from({ length: 15 }, (_, i) => testeur(i + 1))
  const actifs = testeurs.filter((t) => t.statut !== 'remplacee')
  return {
    id: '30',
    app: { id: '7', nom: 'Marché Facile', package: 'bj.studioawa.marche' },
    statut: 'en_cours',
    jour: 1,
    joursCampagne: 16,
    joursExiges: 14,
    testeursVises: 15,
    groupeGoogle: 'testeurs@nakayo.test',
    demarreeLe: '2026-11-12T09:00:00.000Z',
    finPrevueLe: '2026-11-28T09:00:00.000Z',
    termineeLe: null,
    compteurs: {
      affectes: actifs.length,
      inscritsConfirmes: actifs.filter((t) => t.inscriptionConfirmee).length,
      installes: actifs.filter((t) => t.installationConfirmee).length,
    },
    alerteInscrits: false,
    remplacementPossible: false,
    testeurs,
    ...champs,
  }
}

function membreAdmin(n, champs = {}) {
  return {
    ...testeur(n),
    numero: undefined,
    testeurId: String(500 + n),
    nom: `Koffi ${n}`,
    telephone: `+2290197000${String(n).padStart(3, '0')}`,
    modele: 'Tecno Spark 10',
    nombreRemises: 0,
    remplaceeLe: null,
    motifRemplacement: null,
    ...champs,
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('Démarrer et suivre une campagne (US-13, US-16)', () => {
  it('le développeur démarre la campagne depuis la préparation et arrive sur le suivi', async () => {
    const user = userEvent.setup()
    const serveur = simulerApi({
      'GET /api/auth/moi': { corps: { utilisateur: DEV } },
      'GET /api/apps/:id': { corps: { app: APP } },
      'GET /api/apps/:id/preparation': { corps: { preparation: COMPLETE, elements: TOUT, groupeTesteurs: 'testeurs@nakayo.test' } },
      'POST /api/apps/:id/campagne': { statut: 201, corps: { campagne: campagne() } },
      'GET /api/apps/:id/campagne': { corps: { campagne: campagne() } },
    })
    rendreA('/mon-compte/apps/7/preparation')
    await user.click(await screen.findByRole('button', { name: 'Démarrer la campagne' }))
    expect(await screen.findByText('La campagne a démarré')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Jour 1 sur 16' })).toBeInTheDocument()
    expect(serveur.appelsVers('POST', '/api/apps/7/campagne')).toHaveLength(1)
    expect(screen.getAllByRole('listitem').filter((li) => /Testeur \d+/.test(li.textContent))).toHaveLength(15)
  })

  it('explique quand les testeurs disponibles manquent', async () => {
    const user = userEvent.setup()
    simulerApi({
      'GET /api/auth/moi': { corps: { utilisateur: DEV } },
      'GET /api/apps/:id': { corps: { app: APP } },
      'GET /api/apps/:id/preparation': { corps: { preparation: COMPLETE, elements: TOUT, groupeTesteurs: 'testeurs@nakayo.test' } },
      'POST /api/apps/:id/campagne': { statut: 409, corps: { erreur: { code: 'testeurs_insuffisants' } } },
    })
    rendreA('/mon-compte/apps/7/preparation')
    await user.click(await screen.findByRole('button', { name: 'Démarrer la campagne' }))
    expect(await screen.findByText(/Pas assez de testeurs disponibles/)).toBeInTheDocument()
  })

  it('le suivi alerte quand moins de 13 testeurs sont inscrits', async () => {
    const testeurs = Array.from({ length: 15 }, (_, i) => testeur(i + 1, { inscriptionConfirmee: i < 10 }))
    simulerApi({
      'GET /api/auth/moi': { corps: { utilisateur: DEV } },
      'GET /api/apps/:id/campagne': { corps: { campagne: campagne({ jour: 3, testeurs, alerteInscrits: true }) } },
    })
    rendreA('/mon-compte/apps/7/campagne')
    expect(await screen.findByText('Moins de 13 inscriptions confirmées')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Jour 3 sur 16' })).toBeInTheDocument()
    expect(screen.getByText('inscriptions confirmées').previousElementSibling).toHaveTextContent('10 sur 15')
    expect(screen.queryByText('La campagne a démarré')).not.toBeInTheDocument()
  })

  it('sans campagne, renvoie vers la préparation', async () => {
    simulerApi({
      'GET /api/auth/moi': { corps: { utilisateur: DEV } },
      'GET /api/apps/:id/campagne': { corps: { campagne: null } },
    })
    rendreA('/mon-compte/apps/7/campagne')
    expect(await screen.findByText('La campagne de cette app n’a pas encore démarré.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Préparer le lancement' })).toHaveAttribute('href', '/mon-compte/apps/7/preparation')
  })

  it('Mes apps mène au suivi une fois la campagne démarrée', async () => {
    simulerApi({
      'GET /api/auth/moi': { corps: { utilisateur: DEV } },
      'GET /api/apps': { corps: { apps: [{ ...APP, campagne: { id: '30', statut: 'en_cours', demarreeLe: '2026-11-12T09:00:00.000Z' } }] } },
    })
    rendreA('/mon-compte')
    expect(await screen.findByRole('link', { name: 'Suivre la campagne de Marché Facile' })).toHaveAttribute('href', '/mon-compte/apps/7/campagne')
    expect(screen.getByText(/Campagne en cours depuis le 12 nov\. 2026/)).toBeInTheDocument()
  })
})

describe('Campagnes côté admin (US-16, US-43)', () => {
  const RESUME = (() => {
    const { testeurs: _t, ...r } = campagne({ developpeur: { id: '2', nom: 'Studio Awa', email: 'awa@studio.bj' }, jour: 2, remplacementPossible: true })
    return r
  })()

  it('liste les campagnes, ouvre le détail et remplace un testeur', async () => {
    const user = userEvent.setup()
    const membres = Array.from({ length: 15 }, (_, i) => membreAdmin(i + 1))
    const detail = { ...RESUME, testeurs: membres }
    const apres = {
      ...detail,
      testeurs: [
        { ...membres[0], statut: 'remplacee', remplaceeLe: '2026-11-13T10:00:00.000Z', motifRemplacement: 'Ne s’est pas inscrit au test.' },
        ...membres.slice(1),
        membreAdmin(16),
      ],
    }
    const serveur = simulerApi({
      'GET /api/auth/moi': { corps: { utilisateur: ADMIN } },
      'GET /api/admin/campagnes': { corps: { campagnes: [RESUME], total: 1, page: 1, parPage: 20 } },
      'GET /api/admin/campagnes/:id': { corps: { campagne: detail } },
      'POST /api/admin/campagnes/:id/affectations/:affectationId/remplacement': { corps: { campagne: apres } },
    })
    rendreA('/admin/campagnes')
    expect(await screen.findByRole('heading', { name: '1 campagne en cours' })).toBeInTheDocument()
    const carte = screen.getByRole('article', { name: 'Marché Facile' })
    expect(within(carte).getByText('Jour 2 sur 16')).toBeInTheDocument()
    expect(within(carte).getByText(/Studio Awa · awa@studio\.bj/)).toBeInTheDocument()

    await user.click(within(carte).getByRole('button', { name: 'Voir les testeurs' }))
    await user.click(await within(carte).findByRole('button', { name: 'Remplacer Koffi 1' }))
    const formulaire = within(carte).getByRole('form', { name: 'Remplacer Koffi 1' })
    await user.click(within(formulaire).getByRole('button', { name: 'Remplacer le testeur' }))
    expect(within(formulaire).getByText('Indiquez pourquoi ce testeur est remplacé.')).toBeInTheDocument()
    expect(serveur.appelsVers('POST', '/api/admin/campagnes/30/affectations/101/remplacement')).toHaveLength(0)

    await user.type(within(formulaire).getByLabelText('Motif du remplacement'), 'Ne s’est pas inscrit au test.')
    await user.click(within(formulaire).getByRole('button', { name: 'Remplacer le testeur' }))
    expect(await within(carte).findByText('Koffi 1 est remplacé. Le nouveau testeur est prévenu par SMS.')).toBeInTheDocument()
    expect(serveur.appelsVers('POST', '/api/admin/campagnes/30/affectations/101/remplacement')[0].corps).toEqual({ motif: 'Ne s’est pas inscrit au test.' })
    expect(within(carte).getByText('Koffi 16')).toBeInTheDocument()
    expect(within(carte).queryByRole('button', { name: 'Remplacer Koffi 1' })).not.toBeInTheDocument()
  })

  it('après le 2e jour, le remplacement n’est plus proposé', async () => {
    const user = userEvent.setup()
    const resume = { ...RESUME, jour: 5, remplacementPossible: false }
    simulerApi({
      'GET /api/auth/moi': { corps: { utilisateur: ADMIN } },
      'GET /api/admin/campagnes': { corps: { campagnes: [resume], total: 1, page: 1, parPage: 20 } },
      'GET /api/admin/campagnes/:id': { corps: { campagne: { ...resume, testeurs: [membreAdmin(1)] } } },
    })
    rendreA('/admin/campagnes')
    await user.click(await screen.findByRole('button', { name: 'Voir les testeurs' }))
    expect(await screen.findByText('Le remplacement manuel n’est plus possible après le 2e jour.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Remplacer/ })).not.toBeInTheDocument()
  })

  it('annonce le délai dépassé renvoyé par le serveur', async () => {
    const user = userEvent.setup()
    simulerApi({
      'GET /api/auth/moi': { corps: { utilisateur: ADMIN } },
      'GET /api/admin/campagnes': { corps: { campagnes: [RESUME], total: 1, page: 1, parPage: 20 } },
      'GET /api/admin/campagnes/:id': { corps: { campagne: { ...RESUME, testeurs: [membreAdmin(1)] } } },
      'POST /api/admin/campagnes/:id/affectations/:affectationId/remplacement': { statut: 409, corps: { erreur: { code: 'delai_depasse' } } },
    })
    rendreA('/admin/campagnes')
    await user.click(await screen.findByRole('button', { name: 'Voir les testeurs' }))
    await user.click(await screen.findByRole('button', { name: 'Remplacer Koffi 1' }))
    await user.type(screen.getByLabelText('Motif du remplacement'), 'Testeur injoignable depuis hier.')
    await user.click(screen.getByRole('button', { name: 'Remplacer le testeur' }))
    expect(await screen.findByText(/n’est possible que pendant les 2 premiers jours/)).toBeInTheDocument()
  })

  it('l’onglet Terminées interroge le bon statut', async () => {
    const user = userEvent.setup()
    const serveur = simulerApi({
      'GET /api/auth/moi': { corps: { utilisateur: ADMIN } },
      'GET /api/admin/campagnes': (r) => ({ corps: { campagnes: r.query.get('statut') ? [] : [RESUME], total: r.query.get('statut') ? 0 : 1, page: 1, parPage: 20 } }),
    })
    rendreA('/admin/campagnes')
    await screen.findByRole('heading', { name: '1 campagne en cours' })
    await user.click(screen.getByRole('button', { name: 'Terminées' }))
    expect(await screen.findByRole('heading', { name: 'Aucune campagne terminée' })).toBeInTheDocument()
    await waitFor(() => expect(serveur.appelsVers('GET', '/api/admin/campagnes').at(-1).query.get('statut')).toBe('terminee'))
  })
})
