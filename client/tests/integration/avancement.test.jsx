import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { rendreA, simulerApi } from './outils.jsx'

const DEV = { id: '2', role: 'developpeur', statut: 'valide', email: 'awa@studio.bj', emailVerifie: true, nom: 'Studio Awa', pays: 'BJ' }

const CAMPAGNE = {
  id: '30',
  app: { id: '7', nom: 'Marché Facile', package: 'bj.studioawa.marche' },
  statut: 'en_cours',
  jour: 3,
  joursCampagne: 16,
  joursExiges: 14,
  testeursVises: 15,
  groupeGoogle: 'testeurs@nakayo.test',
  demarreeLe: '2026-11-12T09:00:00.000Z',
  finPrevueLe: '2026-11-28T09:00:00.000Z',
  termineeLe: null,
  compteurs: { affectes: 15, inscritsConfirmes: 14, installes: 13 },
  alerteInscrits: false,
  remplacementPossible: false,
  testeurs: [],
}

function rapport(n, champs = {}) {
  return {
    id: String(n),
    jour: '2026-11-13',
    jourCampagne: 2,
    testeur: n,
    ville: 'Cotonou',
    actions: `J’ai cherché du riz, essai ${n}.`,
    note: 4,
    bug: false,
    commentaireBug: null,
    fonctionnalites: ['Panier'],
    versionApp: '1.0.3',
    retourDetaille: null,
    recuLe: '2026-11-13T18:00:00.000Z',
    ...champs,
  }
}

const AVANCEMENT = {
  campagneId: '30',
  statut: 'en_cours',
  jour: 3,
  joursExiges: 14,
  finPrevueLe: '2026-11-28T09:00:00.000Z',
  objectif: { atteint: false, testeursAtteints: 0, dateEstimee: '2026-11-25' },
  resume: { testeursActifs: 12, installes: 13, tempsTotalSecondes: 9120, rapports: 25, noteMoyenne: 4.2, bugs: 1, appareilsEntreeDeGamme: 1 },
  testeurs: [],
  parJour: [
    { jour: '2026-11-12', numero: 1, tempsSecondes: 3600, testeursAvecUsage: 12, rapports: 12, testeursValides: 11 },
    { jour: '2026-11-13', numero: 2, tempsSecondes: 4320, testeursAvecUsage: 13, rapports: 13, testeursValides: null },
    { jour: '2026-11-14', numero: 3, tempsSecondes: 1200, testeursAvecUsage: 5, rapports: 0, testeursValides: null },
  ],
  couverture: [
    { fonctionnalite: 'Recherche de produits', testeurs: 10, rapports: 20, part: 0.77 },
    { fonctionnalite: 'Suivi de livraison', testeurs: 0, rapports: 0, part: 0 },
  ],
  appareils: [
    { modele: 'Spark 20', versionAndroid: '14', testeurs: 3 },
    { modele: 'Redmi 13C', versionAndroid: '13', testeurs: 1, entreeDeGamme: true },
  ],
  rapports: [
    rapport(1, { bug: true, commentaireBug: 'Le panier se vide quand je quitte l’app.' }),
    rapport(2, { retourDetaille: 'Très pratique, mais le bouton du panier est difficile à trouver. '.repeat(2) }),
    ...Array.from({ length: 23 }, (_, i) => rapport(i + 3)),
  ],
}

afterEach(() => vi.unstubAllGlobals())

describe('Avancement de la campagne (US-21)', () => {
  it('résumé, temps par jour, couverture, téléphones et rapports filtrables', async () => {
    const user = userEvent.setup()
    simulerApi({
      'GET /api/auth/moi': { corps: { utilisateur: DEV } },
      'GET /api/apps/:id/campagne': { corps: { campagne: CAMPAGNE } },
      'GET /api/apps/:id/campagne/avancement': { corps: { avancement: AVANCEMENT } },
      'GET /api/apps/:id/campagne/rapport': { corps: { rapport: { pret: false, disponibleLe: '2026-11-25', bilan: null, brouillon: null, decisionGoogle: null } } },
    })
    rendreA('/mon-compte/apps/7/campagne')

    expect(await screen.findByRole('heading', { name: 'Où en est le test' })).toBeInTheDocument()
    expect(screen.getByText('testeurs actifs').previousElementSibling).toHaveTextContent('12 sur 13')
    expect(screen.getByText('de test au total').previousElementSibling).toHaveTextContent('2 h 32 min')
    expect(screen.getByText('Note moyenne 4,2 sur 5')).toBeInTheDocument()
    expect(screen.getByText('fin des 14 jours pour 12 testeurs').previousElementSibling).toHaveTextContent('25 nov.')

    const barres = within(screen.getByRole('list', { name: 'Temps de test par jour' })).getAllByRole('listitem')
    expect(barres).toHaveLength(3)
    expect(barres[1]).toHaveAccessibleName('Jour 2, 13 nov. : 1 h 12 min, 13 rapports')
    await user.click(screen.getByText('Voir le détail par jour'))
    const lignes = within(screen.getByRole('table')).getAllByRole('row')
    expect(lignes[1]).toHaveTextContent('1 · 12 nov.1 h121211')
    expect(lignes[2]).toHaveTextContent('Vérifié cette nuit')

    expect(screen.getByText(/77\s%/)).toBeInTheDocument()
    expect(screen.getByText('Spark 20')).toBeInTheDocument()
    expect(screen.getByText('· Android 13')).toBeInTheDocument()
    // US-35 : téléphones d'entrée de gamme.
    expect(screen.getByText('1 testeur a un téléphone d’entrée de gamme (3 Go de mémoire vive ou moins).')).toBeInTheDocument()
    expect(screen.getByText('· entrée de gamme')).toBeInTheDocument()

    const liste = () => screen.getByRole('heading', { name: 'Rapports des testeurs' }).parentElement
    expect(within(liste()).getAllByText(/^Note \d sur 5\.$/)).toHaveLength(20)
    await user.click(screen.getByRole('button', { name: 'Afficher plus de rapports' }))
    expect(within(liste()).getAllByText(/^Note \d sur 5\.$/)).toHaveLength(25)

    await user.click(screen.getByRole('button', { name: 'Problèmes signalés' }))
    expect(screen.getByRole('button', { name: 'Problèmes signalés' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(liste()).getAllByText(/^Note \d sur 5\.$/)).toHaveLength(1)
    expect(screen.getByText('Le panier se vide quand je quitte l’app.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Avis détaillés' }))
    expect(within(liste()).getByText('Avis détaillé :')).toBeInTheDocument()
    expect(screen.queryByText('Le panier se vide quand je quitte l’app.')).not.toBeInTheDocument()
  })

  it('au début : objectif à venir et aucun rapport ; erreur réseau puis nouvel essai', async () => {
    const user = userEvent.setup()
    const vide = {
      ...AVANCEMENT,
      objectif: { atteint: false, testeursAtteints: 0, dateEstimee: null },
      resume: { testeursActifs: 0, installes: 0, tempsTotalSecondes: 0, rapports: 0, noteMoyenne: null, bugs: 0 },
      parJour: [AVANCEMENT.parJour[0]],
      appareils: [],
      rapports: [],
    }
    simulerApi({
      'GET /api/auth/moi': { corps: { utilisateur: DEV } },
      'GET /api/apps/:id/campagne': { corps: { campagne: CAMPAGNE } },
      'GET /api/apps/:id/campagne/avancement': ['reseau', { corps: { avancement: vide } }],
      'GET /api/apps/:id/campagne/rapport': { corps: { rapport: { pret: false, disponibleLe: '2026-11-25', bilan: null, brouillon: null, decisionGoogle: null } } },
    })
    rendreA('/mon-compte/apps/7/campagne')
    await user.click(await screen.findByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByText('Estimée dès que 12 testeurs ont installé l’app.')).toBeInTheDocument()
    expect(screen.getByText('Aucun rapport pour l’instant. Les testeurs envoient le leur chaque jour.')).toBeInTheDocument()
    expect(screen.getByText('Aucun téléphone connu pour l’instant.')).toBeInTheDocument()
    expect(screen.queryByText(/Note moyenne/)).not.toBeInTheDocument()
  })
})
