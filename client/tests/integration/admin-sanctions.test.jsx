import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { rendreA, simulerApi } from './outils.jsx'

// US-29 : suspendre, bannir, réactiver un compte et journal des actions.
const ADMIN = { id: '1', role: 'admin', statut: 'valide', email: 'admin@nakayo.test', nom: 'Équipe' }
const TESTEUR = {
  id: '77',
  role: 'testeur',
  statut: 'valide',
  motifSanction: null,
  nom: 'Koffi Agbo',
  creeLe: '2026-11-09T09:00:00.000Z',
  developpeur: null,
  testeur: {
    telephone: '+2290197000000',
    ville: 'Cotonou',
    gmail: 'koffi.agbo@gmail.com',
    numeroMomo: '+2290196000000',
    operateurMomo: 'mtn',
    appareil: { fabricant: 'Tecno', modele: 'Spark 20', versionAndroid: '14', niveauApi: 34 },
  },
  controles: { etat: 'termine', liste: [] },
}
const MOTIF = 'Rapports recopiés d’une app à l’autre.'
const liste = (comptes) => ({ corps: { comptes, total: comptes.length, page: 1, parPage: 20 } })

describe('Back-office : sanctions (US-29)', () => {
  it('suspend un compte validé avec un motif obligatoire', async () => {
    const user = userEvent.setup()
    const serveur = simulerApi({
      'GET /api/auth/moi': { corps: { utilisateur: ADMIN } },
      'GET /api/admin/comptes': (r) => liste(r.query.get('statut') === 'valide' ? [TESTEUR] : []),
      'POST /api/admin/comptes/77/sanction': { corps: { compte: { ...TESTEUR, statut: 'suspendu', motifSanction: MOTIF } } },
    })
    rendreA('/admin/comptes')

    expect(await screen.findByRole('heading', { name: 'Aucun compte en attente' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Validés' }))
    expect(await screen.findByRole('heading', { name: '1 compte validé' })).toBeInTheDocument()
    const carte = screen.getByRole('heading', { name: 'Koffi Agbo' }).closest('article')
    expect(within(carte).queryByRole('button', { name: 'Réactiver le compte de Koffi Agbo' })).not.toBeInTheDocument()

    await user.click(within(carte).getByRole('button', { name: 'Suspendre le compte de Koffi Agbo' }))
    await user.click(within(carte).getByRole('button', { name: 'Confirmer la suspension' }))
    expect(serveur.appelsVers('POST', '/api/admin/comptes/77/sanction')).toHaveLength(0)
    expect(within(carte).getByLabelText('Motif')).toHaveAttribute('aria-invalid', 'true')

    await user.type(within(carte).getByLabelText('Motif'), MOTIF)
    await user.click(within(carte).getByRole('button', { name: 'Confirmer la suspension' }))
    expect(await screen.findByText('Compte de Koffi Agbo suspendu. La personne est prévenue par SMS.')).toBeInTheDocument()
    expect(serveur.appelsVers('POST', '/api/admin/comptes/77/sanction')[0].corps).toEqual({ action: 'suspension', motif: MOTIF })
    expect(screen.queryByRole('heading', { name: 'Koffi Agbo' })).not.toBeInTheDocument()
  })

  it('réactive un compte suspendu sans motif et montre le motif de la sanction', async () => {
    const user = userEvent.setup()
    const suspendu = { ...TESTEUR, statut: 'suspendu', motifSanction: MOTIF }
    const serveur = simulerApi({
      'GET /api/auth/moi': { corps: { utilisateur: ADMIN } },
      'GET /api/admin/comptes': liste([suspendu]),
      'POST /api/admin/comptes/77/sanction': { corps: { compte: { ...TESTEUR } } },
    })
    rendreA('/admin/comptes?statut=suspendu')

    const carte = (await screen.findByRole('heading', { name: 'Koffi Agbo' })).closest('article')
    expect(within(carte).getByText(MOTIF)).toBeInTheDocument()
    await user.click(within(carte).getByRole('button', { name: 'Réactiver le compte de Koffi Agbo' }))
    await user.click(within(carte).getByRole('button', { name: 'Confirmer la réactivation' }))
    expect(await screen.findByText(/Compte de Koffi Agbo réactivé/)).toBeInTheDocument()
    expect(serveur.appelsVers('POST', '/api/admin/comptes/77/sanction')[0].corps).toEqual({ action: 'reactivation' })
  })

  it('affiche le journal des actions', async () => {
    simulerApi({
      'GET /api/auth/moi': { corps: { utilisateur: ADMIN } },
      'GET /api/admin/journal': {
        corps: {
          actions: [
            { id: '2', action: 'compte_suspendu', libelle: 'Compte suspendu', cible: { type: 'compte', id: '77' }, detail: MOTIF, admin: { id: '1', nom: 'Équipe' }, le: '2026-11-17T08:00:00.000Z' },
          ],
          total: 1,
          page: 1,
          parPage: 30,
        },
      },
    })
    rendreA('/admin/journal')
    expect(await screen.findByText('Compte suspendu')).toBeInTheDocument()
    expect(screen.getByText(/Compte n° 77/)).toBeInTheDocument()
    expect(screen.getByText('Par Équipe')).toBeInTheDocument()
    expect(screen.getByText(MOTIF)).toBeInTheDocument()
  })
})
