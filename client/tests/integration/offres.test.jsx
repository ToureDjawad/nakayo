import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { rendreA, simulerApi } from './outils.jsx'

// Offres Standard et Pro, montée en gamme (US-32, docs/api-offres.md).
const DEV = { id: '2', role: 'developpeur', statut: 'valide', email: 'awa@studio.bj', emailVerifie: true, nom: 'Studio Awa', pays: 'BJ' }
const APP = { id: '7', nom: 'Marché Facile', package: 'bj.studioawa.marche', statut: 'brouillon', offre: 'standard', comptePlay: 'personnel_recent' }
const GARANTIE = 'Si Google refuse l’accès à la production, nous relançons une nouvelle campagne sans frais.'
const STANDARD = {
  code: 'standard',
  nom: 'Offre Standard',
  description: '15 testeurs vérifiés pendant 14 jours.',
  prix: { carte: { montant: 2900, devise: 'USD' }, mobile_money: { montant: 17400, devise: 'XOF' } },
  garantie: GARANTIE,
}
const PRO = {
  code: 'pro',
  nom: 'Offre Pro',
  description: 'Tout Standard, avec les testeurs les mieux notés.',
  prix: { carte: { montant: 5900, devise: 'USD' }, mobile_money: { montant: 35400, devise: 'XOF' } },
  garantie: GARANTIE,
  monteeEnGamme: { prix: { carte: { montant: 3000, devise: 'USD' }, mobile_money: { montant: 18000, devise: 'XOF' } } },
}
const PAIEMENT = {
  reference: 'PAY-0123456789ABCDEF',
  appId: '7',
  appNom: 'Marché Facile',
  offre: 'pro',
  nature: 'offre',
  moyen: 'carte',
  montant: 5900,
  devise: 'USD',
  statut: 'en_attente',
  facture: null,
  creeLe: '2026-11-13T09:00:00.000Z',
  confirmeLe: null,
}
const BASE = {
  'GET /api/auth/moi': { corps: { utilisateur: DEV } },
  'GET /api/support': { corps: { support: { whatsapp: null } } },
  'GET /api/offres': { corps: { offres: [STANDARD, PRO] } },
}
const REDIRECTION = { statut: 201, corps: { paiement: PAIEMENT, redirection: '/paiement/simulation/PAY-0123456789ABCDEF' } }

describe('Choisir l’offre au paiement (US-32)', () => {
  it('propose Standard et Pro ; choisir Pro change les prix et l’envoie au serveur', async () => {
    const user = userEvent.setup()
    const serveur = simulerApi({ ...BASE, 'GET /api/apps/:id': { corps: { app: APP } }, 'POST /api/apps/:id/paiements': REDIRECTION })
    const { routeur } = rendreA('/mon-compte/apps/7/paiement')
    expect(await screen.findByRole('heading', { name: 'Offre Standard' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /^Offre Standard/ })).toBeChecked()

    await user.click(screen.getByRole('radio', { name: /^Offre Pro/ }))
    expect(screen.getByRole('heading', { name: 'Offre Pro' })).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /Carte bancaire : 59,00/ }))
    await user.click(screen.getByRole('button', { name: /^Payer 59,00/ }))
    await waitFor(() => expect(routeur.state.location.pathname).toBe('/paiement/simulation/PAY-0123456789ABCDEF'))
    expect(serveur.appelsVers('POST', '/api/apps/7/paiements')[0].corps).toEqual({ offre: 'pro', moyen: 'carte' })
  })

  it('le lien « ?offre=pro » présélectionne Pro', async () => {
    simulerApi({ ...BASE, 'GET /api/apps/:id': { corps: { app: APP } } })
    rendreA('/mon-compte/apps/7/paiement?offre=pro')
    expect(await screen.findByRole('radio', { name: /^Offre Pro/ })).toBeChecked()
  })
})

describe('Passer une app payée à l’Offre Pro (US-32)', () => {
  const PAYEE = { ...APP, statut: 'validee', campagne: { id: '3', statut: 'en_cours', demarreeLe: '2026-11-10T08:00:00.000Z' } }

  it('la carte de l’app affiche l’offre et propose la montée en gamme', async () => {
    simulerApi({ ...BASE, 'GET /api/apps': { corps: { apps: [PAYEE] } } })
    rendreA('/mon-compte')
    const carte = (await screen.findByText('Marché Facile', { selector: 'p' })).closest('li')
    expect(within(carte).getByText('Offre Standard')).toBeInTheDocument()
    expect(within(carte).getByRole('link', { name: 'Passer Marché Facile à l’Offre Pro' })).toHaveAttribute(
      'href',
      '/mon-compte/apps/7/montee-en-gamme',
    )
  })

  it('une app déjà en Pro ou une campagne terminée ne la propose pas', async () => {
    simulerApi({
      ...BASE,
      'GET /api/apps': {
        corps: { apps: [{ ...PAYEE, offre: 'pro' }, { ...PAYEE, id: '8', nom: 'Autre', campagne: { ...PAYEE.campagne, statut: 'terminee' } }] },
      },
    })
    rendreA('/mon-compte')
    expect(await screen.findByText('Offre Pro')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /à l’Offre Pro/ })).not.toBeInTheDocument()
  })

  it('ne fait payer que la différence et appelle la montée en gamme', async () => {
    const user = userEvent.setup()
    const serveur = simulerApi({
      ...BASE,
      'GET /api/apps/:id': { corps: { app: PAYEE } },
      'POST /api/apps/:id/montee-en-gamme': REDIRECTION,
    })
    const { routeur } = rendreA('/mon-compte/apps/7/montee-en-gamme')
    expect(await screen.findByRole('heading', { name: 'Offre Pro' })).toBeInTheDocument()
    expect(screen.getByText(/vous ne réglez que la différence de prix/)).toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: /^Offre Standard/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /Mobile Money : 18\s000\sFCFA/ }))
    await user.type(screen.getByLabelText('Numéro Mobile Money'), '+229 01 97 00 00 00')
    await user.click(screen.getByRole('button', { name: /^Payer 18\s000\sFCFA$/ }))
    await waitFor(() => expect(routeur.state.location.pathname).toBe('/paiement/simulation/PAY-0123456789ABCDEF'))
    expect(serveur.appelsVers('POST', '/api/apps/7/montee-en-gamme')[0].corps).toEqual({
      offre: 'pro',
      moyen: 'mobile_money',
      numeroMomo: '+2290197000000',
    })
  })

  it('une app déjà en Pro : le dit simplement', async () => {
    simulerApi({ ...BASE, 'GET /api/apps/:id': { corps: { app: { ...PAYEE, offre: 'pro' } } } })
    rendreA('/mon-compte/apps/7/montee-en-gamme')
    expect(await screen.findByText('Votre app est déjà en Offre Pro.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Payer/ })).not.toBeInTheDocument()
  })

  it('le paiement de la différence apparaît dans l’historique', async () => {
    simulerApi({
      ...BASE,
      'GET /api/paiements': {
        corps: { paiements: [{ ...PAIEMENT, nature: 'montee_en_gamme', montant: 18000, devise: 'XOF', moyen: 'mobile_money', statut: 'reussi' }] },
      },
    })
    rendreA('/mon-compte/paiements')
    expect(await screen.findByText('Passage à l’Offre Pro (différence de prix)')).toBeInTheDocument()
  })
})
