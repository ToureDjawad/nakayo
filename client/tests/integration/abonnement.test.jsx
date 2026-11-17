import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { rendreA, simulerApi } from './outils.jsx'

// US-45 : abonnement mensuel (docs/abonnement.md).
const DEV = { id: '2', role: 'developpeur', statut: 'valide', email: 'awa@studio.bj', emailVerifie: true, nom: 'Studio Awa', pays: 'BJ' }
const APP = { id: '7', nom: 'Marché Facile', package: 'bj.studioawa.marche', statut: 'brouillon', comptePlay: 'personnel_recent' }
const OFFRE = {
  code: 'agence',
  nom: 'Abonnement Agence',
  description: '3 campagnes Standard par mois, sans repayer à chaque app.',
  campagnes: 3,
  graceJours: 3,
  prix: { carte: { montant: 6900, devise: 'USD' }, mobile_money: { montant: 41400, devise: 'XOF' } },
}
const ACTIF = {
  statut: 'actif',
  periodeDebut: '2026-11-12T09:00:00.000Z',
  periodeFin: '2026-12-12T09:00:00.000Z',
  echeance: '2026-12-12T09:00:00.000Z',
  finGrace: '2026-12-15T09:00:00.000Z',
  campagnesIncluses: 3,
  campagnesUtilisees: 1,
  campagnesRestantes: 2,
  renouvelable: false,
  telephoneRappels: '+2290161000000',
}
const BASE = {
  'GET /api/auth/moi': { corps: { utilisateur: DEV } },
  'GET /api/support': { corps: { support: { whatsapp: null } } },
}

describe('Abonnement Agence (US-45)', () => {
  it('sans abonnement : souscription par Mobile Money', async () => {
    const serveur = simulerApi({
      ...BASE,
      'GET /api/abonnement': { corps: { abonnement: null, offre: OFFRE } },
      'POST /api/abonnement/paiements': { statut: 201, corps: { paiement: { reference: 'PAY-1' }, redirection: '/paiement/simulation/PAY-1' } },
    })
    rendreA('/mon-compte/abonnement')
    await userEvent.click(await screen.findByRole('radio', { name: /Mobile Money : 41\s400\sFCFA par mois/ }))
    await userEvent.type(screen.getByLabelText('Numéro Mobile Money'), '+229 01 62 00 00 00')
    await userEvent.click(screen.getByRole('button', { name: 'Payer le premier mois' }))
    expect(serveur.appelsVers('POST', '/api/abonnement/paiements')[0].corps).toEqual({ moyen: 'mobile_money', numeroMomo: '+2290162000000' })
  })

  it('abonnement actif : échéance, campagnes restantes, renouvellement pas encore ouvert', async () => {
    simulerApi({ ...BASE, 'GET /api/abonnement': { corps: { abonnement: ACTIF, offre: OFFRE } } })
    rendreA('/mon-compte/abonnement')
    const etat = (await screen.findByRole('heading', { name: 'Votre abonnement' })).closest('section')
    expect(within(etat).getByText('Actif')).toBeInTheDocument()
    expect(within(etat).getByText('12 décembre 2026')).toBeInTheDocument()
    expect(within(etat).getByText(/2 sur 3 disponibles/)).toBeInTheDocument()
    expect(screen.getByText(/Le renouvellement s’ouvre 7 jours avant l’échéance/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Renouveler/ })).not.toBeInTheDocument()
  })

  it('suspendu : prévient et propose de renouveler', async () => {
    simulerApi({ ...BASE, 'GET /api/abonnement': { corps: { abonnement: { ...ACTIF, statut: 'suspendu', campagnesRestantes: 0, renouvelable: true }, offre: OFFRE } } })
    rendreA('/mon-compte/abonnement')
    expect(await screen.findByText(/Votre abonnement est suspendu/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Renouveler pour un mois' })).toBeInTheDocument()
  })

  it('au paiement d’une app : la campagne se lance sur l’abonnement', async () => {
    const serveur = simulerApi({
      ...BASE,
      'GET /api/apps/:id': { corps: { app: APP } },
      'GET /api/offres': {
        corps: {
          offres: [{ code: 'standard', nom: 'Offre Standard', description: '15 testeurs.', garantie: 'Garantie.', prix: { carte: { montant: 2900, devise: 'USD' }, mobile_money: { montant: 17400, devise: 'XOF' } } }],
        },
      },
      'GET /api/abonnement': { corps: { abonnement: ACTIF, offre: OFFRE } },
      'POST /api/apps/:id/abonnement': { corps: { app: { ...APP, statut: 'en_verification' } } },
      'GET /api/apps': { corps: { apps: [{ ...APP, statut: 'en_verification' }] } },
    })
    rendreA('/mon-compte/apps/7/paiement')
    expect(await screen.findByText(/Il vous reste 2 campagnes Standard ce mois-ci/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Utiliser mon abonnement' }))
    expect(serveur.appelsVers('POST', '/api/apps/7/abonnement')).toHaveLength(1)
  })

  it('les mois d’abonnement apparaissent dans les paiements', async () => {
    simulerApi({
      ...BASE,
      'GET /api/paiements': {
        corps: {
          paiements: [
            { reference: 'PAY-2', appId: null, appNom: null, nature: 'abonnement', offre: 'standard', moyen: 'carte', montant: 6900, devise: 'USD', statut: 'reussi', facture: 'NKY-2026-00002', creeLe: '2026-11-12T09:00:00.000Z', confirmeLe: '2026-11-12T09:01:00.000Z', rembourseLe: null },
          ],
        },
      },
    })
    rendreA('/mon-compte/paiements')
    expect(await screen.findByText('Abonnement Agence')).toBeInTheDocument()
    expect(screen.getByText('Un mois, 3 campagnes Standard')).toBeInTheDocument()
  })
})
