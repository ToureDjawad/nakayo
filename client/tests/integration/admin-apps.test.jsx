import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { rendreA, simulerApi } from './outils.jsx'

const ADMIN = { id: '1', role: 'admin', statut: 'valide', email: 'admin@nakayo.bj', nom: 'Équipe Nakayo' }
const APP = {
  id: '7',
  nom: 'Marché Facile',
  package: 'bj.studioawa.marche',
  lienTestFerme: 'https://play.google.com/apps/testing/bj.studioawa.marche',
  description: 'Une app pour commander au marché de Dantokpa et se faire livrer.',
  instructions: 'Chaque jour, ouvrez l’app, cherchez un produit et ajoutez-le au panier.',
  fonctionnalites: ['Recherche de produits', 'Panier', 'Suivi de livraison'],
  connexionRequise: true,
  identifiantsTest: 'Compte : test@marche.bj\nMot de passe : marche2026',
  comptePlay: 'personnel_recent',
  testObligatoire: true,
  statut: 'en_verification',
  motifRefus: null,
  creeLe: '2026-11-12T09:00:00.000Z',
  modifieLe: '2026-11-12T09:01:00.000Z',
  decideLe: null,
  developpeur: { id: '2', nom: 'Studio Awa', email: 'awa@studio.bj', pays: 'BJ', lienFicheDeveloppeur: 'https://play.google.com/store/apps/dev?id=123' },
  paiement: {
    reference: 'PAY-0123456789ABCDEF',
    moyen: 'carte',
    montant: 2900,
    devise: 'USD',
    montantLisible: '29,00 $ US',
    statut: 'reussi',
    facture: 'NKY-2026-00001',
    confirmeLe: '2026-11-12T09:01:00.000Z',
    rembourseLe: null,
  },
}
const LISTE = { apps: [APP], total: 1, page: 1, parPage: 20 }
const BASE = { 'GET /api/auth/moi': { corps: { utilisateur: ADMIN } } }

afterEach(() => vi.unstubAllGlobals())

describe('Apps à vérifier (US-14)', () => {
  it('affiche tout ce qu’il faut contrôler', async () => {
    simulerApi({ ...BASE, 'GET /api/admin/apps': { corps: LISTE } })
    rendreA('/admin/apps')
    expect(await screen.findByRole('heading', { name: '1 app à vérifier' })).toBeInTheDocument()
    const carte = screen.getByRole('article', { name: 'Marché Facile' })
    expect(within(carte).getByRole('link', { name: APP.lienTestFerme })).toHaveAttribute('href', APP.lienTestFerme)
    expect(within(carte).getByText(/Studio Awa · awa@studio.bj/)).toBeInTheDocument()
    expect(within(carte).getByText(/test@marche.bj/)).toBeInTheDocument()
    expect(within(carte).getByText(/29,00 \$ US par carte · facture NKY-2026-00001/)).toBeInTheDocument()
    expect(within(carte).getByText('Suivi de livraison')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Apps à vérifier' })).toHaveAttribute('aria-current', 'page')
  })

  it('valider retire l’app de la file et l’annonce', async () => {
    const user = userEvent.setup()
    const serveur = simulerApi({
      ...BASE,
      'GET /api/admin/apps': { corps: LISTE },
      'POST /api/admin/apps/:id/validation': { corps: { app: { ...APP, statut: 'validee' }, historique: [] } },
    })
    rendreA('/admin/apps')
    await user.click(await screen.findByRole('button', { name: 'Valider Marché Facile' }))
    expect(await screen.findByText('« Marché Facile » est validée. Le développeur est prévenu par email.')).toBeInTheDocument()
    expect(screen.queryByRole('article', { name: 'Marché Facile' })).not.toBeInTheDocument()
    expect(serveur.appelsVers('POST', '/api/admin/apps/7/validation')).toHaveLength(1)
  })

  it('refuser demande un motif, puis l’envoie', async () => {
    const user = userEvent.setup()
    const serveur = simulerApi({
      ...BASE,
      'GET /api/admin/apps': { corps: LISTE },
      'POST /api/admin/apps/:id/refus': { corps: { app: { ...APP, statut: 'refusee' }, historique: [] } },
    })
    rendreA('/admin/apps')
    await user.click(await screen.findByRole('button', { name: 'Refuser Marché Facile' }))
    const motif = screen.getByLabelText('Motif du refus')
    expect(motif).toHaveFocus()
    expect(screen.getByText(/avec le remboursement de 29,00 \$ US/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Refuser et rembourser' }))
    expect(serveur.appelsVers('POST', '/api/admin/apps/7/refus')).toHaveLength(0)
    await user.type(motif, '  Le lien du test fermé ne s’ouvre pas.  ')
    await user.click(screen.getByRole('button', { name: 'Refuser et rembourser' }))
    expect(await screen.findByText(/est refusée. Le développeur est prévenu et remboursé/)).toBeInTheDocument()
    expect(serveur.appelsVers('POST', '/api/admin/apps/7/refus')[0].corps).toEqual({ motif: 'Le lien du test fermé ne s’ouvre pas.' })
  })

  it('une app déjà traitée par un autre admin est retirée avec un message', async () => {
    const user = userEvent.setup()
    simulerApi({
      ...BASE,
      'GET /api/admin/apps': { corps: LISTE },
      'POST /api/admin/apps/:id/validation': { statut: 409, corps: { erreur: { code: 'statut_incompatible', statut: 'refusee' } } },
    })
    rendreA('/admin/apps')
    await user.click(await screen.findByRole('button', { name: 'Valider Marché Facile' }))
    expect(await screen.findByText('« Marché Facile » avait déjà été traitée par un autre admin.')).toBeInTheDocument()
  })

  it('l’onglet Refusées montre le motif et le remboursement', async () => {
    const user = userEvent.setup()
    const refusee = {
      ...APP,
      statut: 'refusee',
      motifRefus: 'App interdite par nos conditions.',
      decideLe: '2026-11-12T10:00:00.000Z',
      paiement: { ...APP.paiement, statut: 'rembourse', rembourseLe: '2026-11-12T10:00:00.000Z' },
    }
    const serveur = simulerApi({
      ...BASE,
      'GET /api/admin/apps': (r) => ({ corps: r.query.get('statut') === 'refusee' ? { ...LISTE, apps: [refusee] } : LISTE }),
    })
    rendreA('/admin/apps')
    await user.click(await screen.findByRole('button', { name: 'Refusées' }))
    expect(await screen.findByRole('heading', { name: '1 app refusée' })).toBeInTheDocument()
    expect(screen.getByText('App interdite par nos conditions.')).toBeInTheDocument()
    expect(screen.getByText(/remboursé le/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Valider/ })).not.toBeInTheDocument()
    await waitFor(() => expect(serveur.appels.some((a) => a.query.get('statut') === 'refusee')).toBe(true))
  })

  it('file vide', async () => {
    simulerApi({ ...BASE, 'GET /api/admin/apps': { corps: { apps: [], total: 0, page: 1, parPage: 20 } } })
    rendreA('/admin/apps')
    expect(await screen.findByRole('heading', { name: 'Aucune app à vérifier' })).toBeInTheDocument()
  })
})

describe('Décision vue par le développeur (US-14)', () => {
  const DEV = { id: '2', role: 'developpeur', statut: 'valide', email: 'awa@studio.bj', emailVerifie: true, nom: 'Studio Awa', pays: 'BJ' }
  const base = { 'GET /api/auth/moi': { corps: { utilisateur: DEV } }, 'GET /api/support': { corps: { support: { whatsapp: null } } } }

  it('une app refusée montre le motif et le remboursement', async () => {
    simulerApi({ ...base, 'GET /api/apps': { corps: { apps: [{ ...APP, statut: 'refusee', motifRefus: 'Le lien du test fermé ne s’ouvre pas.' }] } } })
    rendreA('/mon-compte')
    const carte = (await screen.findByText('Marché Facile', { selector: 'p' })).closest('li')
    expect(within(carte).getByText('Refusée')).toBeInTheDocument()
    expect(within(carte).getByText('Le lien du test fermé ne s’ouvre pas.')).toBeInTheDocument()
    expect(within(carte).getByText(/Votre paiement vous est remboursé/)).toBeInTheDocument()
  })

  it('une app validée annonce la campagne', async () => {
    simulerApi({ ...base, 'GET /api/apps': { corps: { apps: [{ ...APP, statut: 'validee' }] } } })
    rendreA('/mon-compte')
    expect(await screen.findByText('Votre app est validée : la campagne de test démarre bientôt.')).toBeInTheDocument()
  })
})
