import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { rendreA, simulerApi } from './outils.jsx'

const DEV = { id: '2', role: 'developpeur', statut: 'valide', email: 'awa@studio.bj', emailVerifie: true, nom: 'Studio Awa', pays: 'BJ' }
const APP = { id: '7', nom: 'Marché Facile', package: 'bj.studioawa.marche', statut: 'brouillon', comptePlay: 'personnel_recent' }
const OFFRE = {
  code: 'standard',
  nom: 'Offre Standard',
  description: '15 testeurs vérifiés pendant 14 jours, rapports quotidiens et brouillon pour Google.',
  prix: { carte: { montant: 2900, devise: 'USD' }, mobile_money: { montant: 17400, devise: 'XOF' } },
  garantie: 'Si Google refuse l’accès à la production à cause d’un manque d’engagement des testeurs, nous relançons une nouvelle campagne sans frais.',
}
const PAIEMENT = {
  reference: 'PAY-0123456789ABCDEF',
  appId: '7',
  appNom: 'Marché Facile',
  offre: 'standard',
  moyen: 'carte',
  montant: 2900,
  devise: 'USD',
  montantLisible: '29,00 $ US',
  statut: 'en_attente',
  facture: null,
  creeLe: '2026-11-12T09:00:00.000Z',
  confirmeLe: null,
  rembourseLe: null,
}
const REUSSI = { ...PAIEMENT, statut: 'reussi', facture: 'NKY-2026-00001', confirmeLe: '2026-11-12T09:01:00.000Z' }
const BASE = {
  'GET /api/auth/moi': { corps: { utilisateur: DEV } },
  'GET /api/support': { corps: { support: { whatsapp: null } } },
}
const PAGE_PAIEMENT = {
  ...BASE,
  'GET /api/apps/:id': { corps: { app: APP } },
  'GET /api/offres': { corps: { offres: [OFFRE] } },
}

afterEach(() => vi.unstubAllGlobals())

// Les montants sont séparés par des espaces insécables : « 29,00 $ US », « 17 400 FCFA ».
const CARTE = /29,00\s\$\sUS/
const MOMO = /17\s400\sFCFA/
const bouton = (montant) => new RegExp(`^Payer ${montant.source}$`)

describe('Payer l’offre d’une app (US-12)', () => {
  it('le brouillon propose de payer l’offre', async () => {
    simulerApi({ ...BASE, 'GET /api/apps': { corps: { apps: [APP] } } })
    rendreA('/mon-compte')
    const carte = (await screen.findByText('Marché Facile', { selector: 'p' })).closest('li')
    expect(within(carte).getByRole('link', { name: 'Payer l’offre pour Marché Facile' })).toHaveAttribute('href', '/mon-compte/apps/7/paiement')
    expect(screen.queryByRole('link', { name: 'Vos paiements et factures' })).not.toBeInTheDocument()
  })

  it('une app payée est en vérification et le compte mène aux factures', async () => {
    simulerApi({ ...BASE, 'GET /api/apps': { corps: { apps: [{ ...APP, statut: 'en_verification' }] } } })
    rendreA('/mon-compte')
    expect(await screen.findByText(/Offre payée. L’équipe vérifie votre app/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Payer l’offre/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Vos paiements et factures' })).toHaveAttribute('href', '/mon-compte/paiements')
  })

  it('affiche l’offre, la garantie et les deux prix, puis paie par carte et suit la redirection', async () => {
    const user = userEvent.setup()
    const serveur = simulerApi({
      ...PAGE_PAIEMENT,
      'POST /api/apps/:id/paiements': { statut: 201, corps: { paiement: PAIEMENT, redirection: '/paiement/simulation/PAY-0123456789ABCDEF' } },
      'GET /api/paiements/:reference': { corps: { paiement: PAIEMENT } },
    })
    const { routeur } = rendreA('/mon-compte/apps/7/paiement')
    expect(await screen.findByRole('heading', { name: 'Offre Standard' })).toBeInTheDocument()
    expect(screen.getByText(/nous relançons une nouvelle campagne sans frais/)).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: new RegExp(`Carte bancaire : ${CARTE.source}`) })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: new RegExp(`Mobile Money : ${MOMO.source}`) })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Payer' }))
    expect(await screen.findByText('Choisissez un moyen de paiement.')).toBeInTheDocument()
    expect(serveur.appelsVers('POST', '/api/apps/7/paiements')).toHaveLength(0)

    await user.click(screen.getByRole('radio', { name: /Carte bancaire/ }))
    expect(screen.queryByLabelText('Numéro Mobile Money')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: bouton(CARTE) }))

    await waitFor(() => expect(routeur.state.location.pathname).toBe('/paiement/simulation/PAY-0123456789ABCDEF'))
    expect(serveur.appelsVers('POST', '/api/apps/7/paiements')[0].corps).toEqual({ moyen: 'carte' })
    expect(await screen.findByText('Environnement de test')).toBeInTheDocument()
  })

  it('par Mobile Money : demande le numéro, le vérifie et l’envoie au format international', async () => {
    const user = userEvent.setup()
    const serveur = simulerApi({
      ...PAGE_PAIEMENT,
      'POST /api/apps/:id/paiements': { statut: 201, corps: { paiement: { ...PAIEMENT, moyen: 'mobile_money' }, redirection: '/paiement/simulation/PAY-0123456789ABCDEF' } },
      'GET /api/paiements/:reference': { corps: { paiement: PAIEMENT } },
    })
    rendreA('/mon-compte/apps/7/paiement')
    await user.click(await screen.findByRole('radio', { name: /Mobile Money/ }))
    await user.type(screen.getByLabelText('Numéro Mobile Money'), '0197')
    await user.click(screen.getByRole('button', { name: bouton(MOMO) }))
    expect(await screen.findByText(/Saisissez le numéro au format international/)).toBeInTheDocument()
    expect(screen.getByLabelText('Numéro Mobile Money')).toHaveFocus()

    await user.clear(screen.getByLabelText('Numéro Mobile Money'))
    await user.type(screen.getByLabelText('Numéro Mobile Money'), '+229 01 97 00 00 00')
    await user.click(screen.getByRole('button', { name: bouton(MOMO) }))
    await waitFor(() => expect(serveur.appelsVers('POST', '/api/apps/7/paiements')).toHaveLength(1))
    expect(serveur.appelsVers('POST', '/api/apps/7/paiements')[0].corps).toEqual({ moyen: 'mobile_money', numeroMomo: '+2290197000000' })
  })

  it('paiement fermé (503) : message clair, le développeur reste sur la page', async () => {
    const user = userEvent.setup()
    simulerApi({
      ...PAGE_PAIEMENT,
      'POST /api/apps/:id/paiements': { statut: 503, corps: { erreur: { code: 'paiement_indisponible', message: 'fermé' } } },
    })
    rendreA('/mon-compte/apps/7/paiement')
    await user.click(await screen.findByRole('radio', { name: /Carte bancaire/ }))
    await user.click(screen.getByRole('button', { name: bouton(CARTE) }))
    const alerte = await screen.findByText(/Le paiement en ligne n’est pas encore ouvert/)
    expect(alerte.closest('[role="alert"]')).toHaveFocus()
  })

  it('une app déjà payée n’affiche pas le formulaire', async () => {
    simulerApi({ ...PAGE_PAIEMENT, 'GET /api/apps/:id': { corps: { app: { ...APP, statut: 'en_verification' } } } })
    rendreA('/mon-compte/apps/7/paiement')
    expect(await screen.findByText('L’offre de cette app est déjà payée.')).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })
})

describe('Simulation et retour de paiement (US-12)', () => {
  it('confirmer la simulation mène à la page de succès, avec la facture', async () => {
    const user = userEvent.setup()
    const serveur = simulerApi({
      ...BASE,
      'GET /api/paiements/:reference': { corps: { paiement: PAIEMENT } },
      'POST /api/paiements/:reference/simulation': { corps: { paiement: REUSSI } },
    })
    const { routeur } = rendreA('/paiement/simulation/PAY-0123456789ABCDEF')
    expect(await screen.findByText('29,00 $ US')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirmer le paiement' }))
    expect(await screen.findByRole('heading', { name: 'Paiement reçu, merci' })).toBeInTheDocument()
    expect(routeur.state.location.pathname).toBe('/mon-compte/paiements/PAY-0123456789ABCDEF')
    expect(serveur.appelsVers('POST', '/api/paiements/PAY-0123456789ABCDEF/simulation')[0].corps).toEqual({ resultat: 'reussi' })
    expect(screen.getByRole('button', { name: 'Télécharger la facture NKY-2026-00001' })).toBeInTheDocument()
  })

  it('un refus laisse l’app en brouillon et propose de réessayer', async () => {
    const user = userEvent.setup()
    simulerApi({
      ...BASE,
      'GET /api/paiements/:reference': { corps: { paiement: PAIEMENT } },
      'POST /api/paiements/:reference/simulation': { corps: { paiement: { ...PAIEMENT, statut: 'echoue' } } },
    })
    rendreA('/paiement/simulation/PAY-0123456789ABCDEF')
    await user.click(await screen.findByRole('button', { name: 'Refuser le paiement' }))
    expect(await screen.findByRole('heading', { name: 'Le paiement n’a pas abouti' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Réessayer le paiement' })).toHaveAttribute('href', '/mon-compte/apps/7/paiement')
  })

  it('au retour du prestataire, la page attend la confirmation puis affiche le succès', async () => {
    const serveur = simulerApi({
      ...BASE,
      'GET /api/paiements/:reference': [{ corps: { paiement: PAIEMENT } }, { corps: { paiement: PAIEMENT } }, { corps: { paiement: REUSSI } }],
    })
    rendreA('/mon-compte/paiements/PAY-0123456789ABCDEF')
    expect(await screen.findByText(/Nous attendons la confirmation de votre paiement de 29,00 \$ US/)).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Paiement reçu, merci' }, { timeout: 3000 })).toBeInTheDocument()
    expect(serveur.appelsVers('GET', '/api/paiements/PAY-0123456789ABCDEF')).toHaveLength(3)
  })

  it('un paiement déjà traité ne repasse pas par la simulation', async () => {
    simulerApi({ ...BASE, 'GET /api/paiements/:reference': { corps: { paiement: REUSSI } } })
    rendreA('/paiement/simulation/PAY-0123456789ABCDEF')
    expect(await screen.findByRole('heading', { name: 'Paiement reçu, merci' })).toBeInTheDocument()
  })

  it('un second paiement confirmé est annoncé comme remboursé', async () => {
    simulerApi({ ...BASE, 'GET /api/paiements/:reference': { corps: { paiement: { ...PAIEMENT, statut: 'doublon' } } } })
    rendreA('/mon-compte/paiements/PAY-0123456789ABCDEF')
    expect(await screen.findByText(/vous sera remboursé/)).toBeInTheDocument()
  })
})

describe('Historique des paiements et factures (US-15)', () => {
  it('liste les paiements et télécharge la facture PDF', async () => {
    const user = userEvent.setup()
    const creerUrl = vi.fn(() => 'blob:facture')
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: creerUrl, revokeObjectURL: vi.fn() }))
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    simulerApi({
      ...BASE,
      'GET /api/paiements': {
        corps: { paiements: [REUSSI, { ...PAIEMENT, reference: 'PAY-FFFF000000000000', statut: 'echoue', moyen: 'mobile_money', montant: 17400, devise: 'XOF' }] },
      },
      'GET /api/factures/:numero': { corps: {} },
    })
    rendreA('/mon-compte/paiements')
    await screen.findByText('1 paiement réussi.')
    const lignes = screen.getAllByRole('listitem').filter((li) => li.textContent.includes('PAY-'))
    expect(lignes).toHaveLength(2)
    expect(within(lignes[0]).getByText('Payé')).toBeInTheDocument()
    expect(within(lignes[1]).getByText('Échoué')).toBeInTheDocument()
    expect(within(lignes[1]).getByText('17 400 FCFA')).toBeInTheDocument()
    expect(within(lignes[1]).queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('1 paiement réussi.')).toBeInTheDocument()

    await user.click(within(lignes[0]).getByRole('button', { name: 'Télécharger la facture NKY-2026-00001' }))
    await waitFor(() => expect(clic).toHaveBeenCalled())
    expect(creerUrl).toHaveBeenCalled()
    clic.mockRestore()
  })

  it('une facture introuvable affiche une erreur sous le bouton', async () => {
    const user = userEvent.setup()
    simulerApi({
      ...BASE,
      'GET /api/paiements': { corps: { paiements: [REUSSI] } },
      'GET /api/factures/:numero': { statut: 500, corps: { erreur: { code: 'erreur_interne' } } },
    })
    rendreA('/mon-compte/paiements')
    await user.click(await screen.findByRole('button', { name: 'Télécharger la facture NKY-2026-00001' }))
    expect(await screen.findByText(/Le service ne répond pas pour le moment/)).toBeInTheDocument()
  })

  it('sans paiement, le dit simplement', async () => {
    simulerApi({ ...BASE, 'GET /api/paiements': { corps: { paiements: [] } } })
    rendreA('/mon-compte/paiements')
    expect(await screen.findByText('Vous n’avez encore effectué aucun paiement.')).toBeInTheDocument()
  })
})
