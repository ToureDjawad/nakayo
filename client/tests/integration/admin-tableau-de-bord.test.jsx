import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { rendreA, simulerApi } from './outils.jsx'

const ADMIN = { id: '1', role: 'admin', statut: 'valide', email: 'admin@nakayo.bj', nom: 'Équipe Nakayo' }
const VERSEMENT = {
  reference: 'VER-0A1B2C3D4E5F6071',
  campagneId: '4',
  appNom: 'Marché Facile',
  montant: 500,
  devise: 'XOF',
  montantLisible: '500 FCFA',
  operateur: 'mtn',
  numeroMasque: '•••• 12',
  statut: 'echoue',
  tentatives: 4,
  prochaineTentativeLe: null,
  dernierMotif: 'compte_inconnu',
  creeLe: '2026-11-28T00:05:00.000Z',
  verseLe: null,
  testeur: { id: '9', nom: 'Koffi Agbo', telephone: '+2290197000012', numeroMomo: '+2290196000012' },
  referenceFournisseur: null,
  alerteLe: '2026-11-29T06:05:00.000Z',
}
const TABLEAU = {
  aujourdhui: '2026-11-29',
  campagnes: {
    enCours: 2,
    terminees: 4,
    annulees: 0,
    enRetard: 1,
    retards: [{ campagneId: '5', appNom: 'Zem Express', jour: 10, testeursEnBonneVoie: 9 }],
    decisionsGoogle: { acceptees: 3, refusees: 1, tauxReussite: 0.75 },
  },
  testeurs: { valides: 48, actifs: 27, affectations: 45, remplaces: 3, tauxAbandon: 3 / 45, avecRemise: 6 },
  finances: {
    devise: 'XOF',
    tauxUsdFcfa: 600,
    chiffreAffaires: 52200,
    chiffreAffairesLisible: '52 200 FCFA',
    versesTesteurs: 6000,
    versesTesteursLisible: '6 000 FCFA',
    dusTesteurs: 500,
    dusTesteursLisible: '500 FCFA',
    marge: 45700,
    margeLisible: '45 700 FCFA',
    parApp: [
      { campagneId: '5', appNom: 'Zem Express', developpeur: 'Studio Awa', statut: 'en_cours', demarreeLe: '2026-11-20T09:00:00.000Z', encaisse: 17400, versesTesteurs: 0, dusTesteurs: 0, marge: 9900, margeDefinitive: false },
      { campagneId: '4', appNom: 'Marché Facile', developpeur: 'Studio Awa', statut: 'terminee', demarreeLe: '2026-11-12T09:00:00.000Z', encaisse: 17400, versesTesteurs: 6000, dusTesteurs: 500, marge: 10900, margeDefinitive: true },
    ],
  },
  versementsEchoues: [VERSEMENT],
  nombreVersementsEchoues: 1,
}
const BASE = { 'GET /api/auth/moi': { corps: { utilisateur: ADMIN } } }

afterEach(() => vi.unstubAllGlobals())

describe('Tableau de bord admin (US-24)', () => {
  it('/admin ouvre le tableau de bord : campagnes, testeurs, finances et versements échoués', async () => {
    simulerApi({ ...BASE, 'GET /api/admin/tableau-de-bord': { corps: { tableauDeBord: TABLEAU } } })
    const { routeur } = rendreA('/admin')
    expect(await screen.findByRole('heading', { name: 'Campagnes' })).toBeInTheDocument()
    expect(routeur.state.location.pathname).toBe('/admin/tableau-de-bord')
    expect(screen.getByRole('link', { name: 'Tableau de bord' })).toHaveAttribute('aria-current', 'page')

    const campagnes = screen.getByRole('region', { name: 'Campagnes' })
    expect(within(campagnes).getByText('en retard')).toBeInTheDocument()
    expect(within(campagnes).getByText('Jour 10 · 9 testeurs sur 12 en bonne voie')).toBeInTheDocument()
    expect(within(campagnes).getByText('Google : 3 acceptées, 1 refusée (75 % de réussite).')).toBeInTheDocument()

    const testeurs = screen.getByRole('region', { name: 'Testeurs' })
    expect(within(testeurs).getByText('7 %')).toBeInTheDocument()
    expect(within(testeurs).getByText('3 testeurs remplacés sur 45 affectations.')).toBeInTheDocument()

    const finances = screen.getByRole('region', { name: 'Finances' })
    expect(within(finances).getByText('52 200 FCFA')).toBeInTheDocument()
    const lignes = within(within(finances).getByRole('table', { name: 'Marge par app' })).getAllByRole('row')
    expect(lignes).toHaveLength(3)
    expect(lignes[1]).toHaveTextContent('Zem Express')
    expect(lignes[1]).toHaveTextContent('estimée')
    expect(lignes[2]).toHaveTextContent('10 900 FCFA')

    const versements = screen.getByRole('region', { name: 'Versements MoMo échoués' })
    expect(within(versements).getByText('Koffi Agbo · 500 FCFA')).toBeInTheDocument()
    expect(within(versements).getByText('MTN +229 01 96 00 00 12 · app « Marché Facile »')).toBeInTheDocument()
  })

  it('relance un versement échoué puis relit le tableau', async () => {
    const user = userEvent.setup()
    const serveur = simulerApi({
      ...BASE,
      'GET /api/admin/tableau-de-bord': { corps: { tableauDeBord: TABLEAU } },
      'POST /api/admin/versements/VER-0A1B2C3D4E5F6071/relance': { corps: { versement: { ...VERSEMENT, statut: 'verse', tentatives: 1 } } },
    })
    rendreA('/admin/tableau-de-bord')
    await user.click(await screen.findByRole('button', { name: 'Relancer le versement à Koffi Agbo' }))
    expect(await screen.findByText('500 FCFA versés à Koffi Agbo. Le testeur est prévenu par SMS.')).toBeInTheDocument()
    await waitFor(() => expect(serveur.appels.filter((a) => a.methode === 'GET' && a.chemin === '/api/admin/tableau-de-bord')).toHaveLength(2))
  })

  it('sans versement échoué ni campagne, et erreur réseau puis nouvel essai', async () => {
    const user = userEvent.setup()
    const vide = {
      ...TABLEAU,
      campagnes: { enCours: 0, terminees: 0, annulees: 0, enRetard: 0, retards: [] },
      finances: { ...TABLEAU.finances, parApp: [] },
      versementsEchoues: [],
      nombreVersementsEchoues: 0,
    }
    simulerApi({ ...BASE, 'GET /api/admin/tableau-de-bord': ['reseau', { corps: { tableauDeBord: vide } }] })
    rendreA('/admin/tableau-de-bord')
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByText('Aucun versement en échec.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
