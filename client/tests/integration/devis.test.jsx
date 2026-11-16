import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { rendreA, simulerApi } from './outils.jsx'

// Offre Plus sur devis (US-37, docs/api-offres.md §4).
const DEV = { id: '2', role: 'developpeur', statut: 'valide', email: 'awa@studio.bj', emailVerifie: true, nom: 'Studio Awa', pays: 'BJ' }
const ADMIN = { id: '1', role: 'admin', statut: 'valide', email: 'admin@nakayo.bj', nom: 'Équipe Nakayo' }
const APP = { id: '7', nom: 'Marché Facile', package: 'bj.studioawa.marche', statut: 'brouillon', offre: 'standard', comptePlay: 'personnel_recent', devis: null }
const GARANTIE = 'Nous relançons une nouvelle campagne sans frais.'
const STANDARD = {
  code: 'standard',
  nom: 'Offre Standard',
  description: '15 testeurs.',
  prix: { carte: { montant: 2900, devise: 'USD' }, mobile_money: { montant: 17400, devise: 'XOF' } },
  garantie: GARANTIE,
}
const AFRIQUE = {
  code: 'afrique',
  nom: 'Offre Plus',
  description: '20 testeurs, plusieurs villes.',
  prix: { carte: { montant: 9900, devise: 'USD' }, mobile_money: { montant: 59400, devise: 'XOF' } },
  surDevis: true,
  testeurs: 20,
  garantie: GARANTIE,
}
const BESOIN = {
  pays: ['BJ', 'TG'],
  langues: ['fr', 'fon'],
  profils: 'Commerçantes de marché, peu habituées aux applications.',
  scenarios: 'Créer un compte et payer par Mobile Money sur un réseau lent.',
}
const DEVIS = { id: '4', appId: '7', ...BESOIN, statut: 'demande', prix: null, message: null, demandeLe: '2026-11-13T09:00:00.000Z', reponduLe: null }
const PROPOSE = {
  ...DEVIS,
  statut: 'propose',
  message: 'Deux villes et le fon.',
  reponduLe: '2026-11-14T09:00:00.000Z',
  prix: {
    carte: { montant: 14900, devise: 'USD', montantLisible: '149,00 $ US' },
    mobile_money: { montant: 89400, devise: 'XOF', montantLisible: '89 400 FCFA' },
  },
}
const PRO = { ...STANDARD, code: 'pro', nom: 'Offre Pro', prix: { carte: { montant: 5900, devise: 'USD' }, mobile_money: { montant: 35400, devise: 'XOF' } } }
const BASE = {
  'GET /api/auth/moi': { corps: { utilisateur: DEV } },
  'GET /api/support': { corps: { support: { whatsapp: null } } },
  'GET /api/offres': { corps: { offres: [STANDARD, PRO, AFRIQUE] } },
  'GET /api/apps/:id': { corps: { app: APP } },
}

describe('Demander un devis Offre Plus (US-37)', () => {
  it('le développeur décrit pays, langues, profils et scénarios', async () => {
    const user = userEvent.setup()
    const serveur = simulerApi({ ...BASE, 'GET /api/apps/:id/devis': { corps: { devis: null } }, 'PUT /api/apps/:id/devis': { corps: { devis: DEVIS } } })
    rendreA('/mon-compte/apps/7/devis')
    await user.click(await screen.findByRole('button', { name: 'Demander un devis' }))
    expect(screen.getByText('Cochez au moins un pays.')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Bénin' })).toHaveFocus()

    await user.click(screen.getByRole('checkbox', { name: 'Bénin' }))
    await user.click(screen.getByRole('checkbox', { name: 'Togo' }))
    await user.click(screen.getByRole('checkbox', { name: 'Français' }))
    await user.click(screen.getByRole('checkbox', { name: 'Fon' }))
    await user.type(screen.getByLabelText('Profils de testeurs'), BESOIN.profils)
    await user.type(screen.getByLabelText('Scénarios à jouer'), BESOIN.scenarios)
    await user.click(screen.getByRole('button', { name: 'Demander un devis' }))

    expect(await screen.findByText('Votre besoin est envoyé. Nous vous répondons par email.')).toBeInTheDocument()
    expect(screen.getByText(/Notre équipe l’étudie/)).toBeInTheDocument()
    expect(serveur.appelsVers('PUT', '/api/apps/7/devis')[0].corps).toEqual(BESOIN)
  })

  it('un devis proposé affiche le prix et mène au paiement à ce prix', async () => {
    const user = userEvent.setup()
    const serveur = simulerApi({
      ...BASE,
      'GET /api/apps/:id/devis': { corps: { devis: PROPOSE } },
      'POST /api/apps/:id/paiements': { statut: 201, corps: { paiement: {}, redirection: '/paiement/simulation/PAY-0123456789ABCDEF' } },
    })
    const { routeur } = rendreA('/mon-compte/apps/7/devis')
    const proposition = await screen.findByRole('region', { name: 'Notre proposition' })
    expect(within(proposition).getByText('149,00 $ US')).toBeInTheDocument()
    expect(within(proposition).getByText(/Deux villes et le fon/)).toBeInTheDocument()
    await user.click(within(proposition).getByRole('link', { name: 'Payer ce devis' }))

    const afrique = await screen.findByRole('radio', { name: /Offre Plus \(votre devis\)/ })
    expect(afrique).toBeChecked()
    expect(afrique.closest('label')).toHaveTextContent('89 400 FCFA ou 149,00 $ US')
    await user.click(screen.getByRole('radio', { name: /Carte bancaire : 149,00/ }))
    await user.click(screen.getByRole('button', { name: /^Payer 149,00/ }))
    await waitFor(() => expect(routeur.state.location.pathname).toBe('/paiement/simulation/PAY-0123456789ABCDEF'))
    expect(serveur.appelsVers('POST', '/api/apps/7/paiements')[0].corps).toEqual({ offre: 'afrique', moyen: 'carte' })
  })

  it('sans devis proposé, le paiement renvoie vers la demande de devis', async () => {
    simulerApi({ ...BASE, 'GET /api/apps/:id/devis': { corps: { devis: DEVIS } } })
    rendreA('/mon-compte/apps/7/paiement?offre=afrique')
    expect(await screen.findByRole('radio', { name: /^Offre Standard/ })).toBeChecked()
    expect(screen.queryByRole('radio', { name: /Offre Plus/ })).not.toBeInTheDocument()
    expect(screen.getByText(/Votre demande est à l’étude/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voir votre demande de devis' })).toHaveAttribute('href', '/mon-compte/apps/7/devis')
  })
})

describe('Répondre aux devis (US-37, admin)', () => {
  const A_ETUDIER = {
    ...DEVIS,
    app: { id: '7', nom: 'Marché Facile', package: 'bj.studioawa.marche', statut: 'brouillon' },
    developpeur: { id: '2', nom: 'Studio Awa', email: 'awa@studio.bj', pays: 'BJ' },
  }
  const ADMIN_BASE = { 'GET /api/auth/moi': { corps: { utilisateur: ADMIN } }, 'GET /api/admin/devis': { corps: { devis: [A_ETUDIER] } } }

  it('l’admin lit le besoin et propose un prix en dollars et en FCFA', async () => {
    const user = userEvent.setup()
    const serveur = simulerApi({ ...ADMIN_BASE, 'POST /api/admin/devis/:id/proposition': { corps: { devis: { ...A_ETUDIER, ...PROPOSE } } } })
    rendreA('/admin/devis')
    const carte = await screen.findByRole('article', { name: 'Marché Facile' })
    expect(within(carte).getByText('Bénin, Togo')).toBeInTheDocument()
    expect(within(carte).getByText('Français, Fon')).toBeInTheDocument()

    const carteDollars = within(carte).getByLabelText('Prix par carte (en $)')
    await user.clear(carteDollars)
    await user.type(carteDollars, '50')
    await user.click(within(carte).getByRole('button', { name: 'Proposer ce prix : Marché Facile' }))
    expect(within(carte).getByText('Au moins 99 $.')).toBeInTheDocument()

    await user.clear(carteDollars)
    await user.type(carteDollars, '149,50')
    const fcfa = within(carte).getByLabelText('Prix par Mobile Money (en FCFA)')
    await user.clear(fcfa)
    await user.type(fcfa, '89 700')
    await user.type(within(carte).getByLabelText('Message au développeur (facultatif)'), 'Deux villes et le fon.')
    await user.click(within(carte).getByRole('button', { name: 'Proposer ce prix : Marché Facile' }))

    expect(await screen.findByText(/Prix proposé pour « Marché Facile »/)).toBeInTheDocument()
    expect(serveur.appelsVers('POST', '/api/admin/devis/4/proposition')[0].corps).toEqual({ prixCarte: 14950, prixMobileMoney: 89700, message: 'Deux villes et le fon.' })
  })

  it('un refus demande un message', async () => {
    const user = userEvent.setup()
    const serveur = simulerApi({ ...ADMIN_BASE, 'POST /api/admin/devis/:id/refus': { corps: { devis: { ...A_ETUDIER, statut: 'refuse' } } } })
    rendreA('/admin/devis')
    const carte = await screen.findByRole('article', { name: 'Marché Facile' })
    await user.click(within(carte).getByRole('button', { name: 'Refuser : Marché Facile' }))
    await user.click(within(carte).getByRole('button', { name: 'Confirmer le refus : Marché Facile' }))
    expect(within(carte).getByText('Expliquez au développeur pourquoi.')).toBeInTheDocument()
    await user.type(within(carte).getByLabelText('Pourquoi refuser'), 'Pas encore de testeurs au Togo.')
    await user.click(within(carte).getByRole('button', { name: 'Confirmer le refus : Marché Facile' }))
    expect(await screen.findByText(/Demande refusée pour « Marché Facile »/)).toBeInTheDocument()
    expect(serveur.appelsVers('POST', '/api/admin/devis/4/refus')[0].corps).toEqual({ message: 'Pas encore de testeurs au Togo.' })
  })
})
