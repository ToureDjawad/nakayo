import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { rendreA, simulerApi } from './outils.jsx'

// US-31 : fiche d'un testeur.
const ADMIN = { id: '1', role: 'admin', statut: 'valide', email: 'admin@nakayo.test', nom: 'Équipe' }
const HISTORIQUE = {
  testeur: {
    id: '77',
    nom: 'Koffi Agbo',
    telephone: '+2290197000000',
    statut: 'valide',
    motifSanction: null,
    ville: 'Cotonou',
    gmail: 'koffi.agbo@gmail.com',
    numeroMomo: '+2290196000000',
    operateurMomo: 'mtn',
    inscritLe: '2026-11-01T09:00:00.000Z',
    niveau: { code: 'argent', nom: 'Argent', campagnesTerminees: 1, bugsAcceptes: 0, assiduite: 67, suivant: null },
  },
  affectations: [
    { id: '31', campagneId: '3', app: 'Marché Facile', statut: 'active', campagneStatut: 'en_cours', affecteLe: '2026-11-12T09:00:00.000Z', inscritLe: null, joursValides: 1, joursExiges: 14, motifRemplacement: null },
    { id: '12', campagneId: '1', app: 'Taxi Moto', statut: 'terminee', campagneStatut: 'terminee', affecteLe: '2026-10-01T09:00:00.000Z', inscritLe: null, joursValides: 14, joursExiges: 14, motifRemplacement: null },
  ],
  affectation: '31',
  jours: [
    { jour: '2026-11-12', connexion: null, usageSecondes: 0, rapport: false, valide: false },
    { jour: '2026-11-13', connexion: { premiere: '2026-11-13T08:00:00.000Z', derniere: '2026-11-13T19:00:00.000Z', nombre: 3 }, usageSecondes: 420, rapport: true, valide: true },
  ],
  rapports: [
    { jour: '2026-11-13', actions: 'J’ai cherché du riz et payé.', note: 4, bug: null, fonctionnalites: ['Panier'], versionApp: '1.0.2', position: { latitude: 6.37, longitude: 2.42 }, retourDetaille: null, recuLe: '2026-11-13T19:00:00.000Z' },
  ],
  alertes: [{ id: '5', libelle: 'Rapport sans utilisation', statut: 'ouverte', detail: 'Rapport envoyé sans temps d’utilisation.', creeLe: '2026-11-14T00:10:00.000Z' }],
}

describe('Back-office : fiche testeur (US-31)', () => {
  it('affiche jours, connexions, positions, rapports et alertes, et change de campagne', async () => {
    const user = userEvent.setup()
    const serveur = simulerApi({ 'GET /api/auth/moi': { corps: { utilisateur: ADMIN } }, 'GET /api/admin/testeurs/77/historique': { corps: HISTORIQUE } })
    rendreA('/admin/testeurs/77')

    expect(await screen.findByRole('heading', { name: 'Koffi Agbo' })).toBeInTheDocument()
    expect(screen.getByText(/Argent · 1 campagne\(s\) menée\(s\), assiduité 67/)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Temps passé dans l’app testée, jour par jour' })).toBeInTheDocument()

    const lignes = within(screen.getByRole('table')).getAllByRole('row')
    expect(lignes[1]).toHaveTextContent('12 novembre 2026Aucune0 minNonNon validé')
    expect(lignes[2]).toHaveTextContent('3 (09:00 à 20:00)7 minEnvoyéValidé')
    expect(screen.getByRole('link', { name: /6\.37, 2\.42/ })).toHaveAttribute('href', expect.stringContaining('openstreetmap.org/?mlat=6.37&mlon=2.42'))
    expect(screen.getByText('J’ai cherché du riz et payé.')).toBeInTheDocument()
    expect(screen.getByText('Rapport sans utilisation')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Suspendre le compte de Koffi Agbo' })).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Campagne'), '12')
    await screen.findByRole('heading', { name: 'Koffi Agbo' })
    expect(serveur.appelsVers('GET', '/api/admin/testeurs/77/historique').at(-1).query.get('affectation')).toBe('12')
  })

  it('testeur introuvable', async () => {
    simulerApi({
      'GET /api/auth/moi': { corps: { utilisateur: ADMIN } },
      'GET /api/admin/testeurs/9/historique': { statut: 404, corps: { erreur: { code: 'introuvable', message: 'Testeur introuvable.' } } },
    })
    rendreA('/admin/testeurs/9')
    expect(await screen.findByText('Testeur introuvable.')).toBeInTheDocument()
  })
})
