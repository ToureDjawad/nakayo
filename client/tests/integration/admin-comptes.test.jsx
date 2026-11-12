import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { rendreA, simulerApi } from './outils.jsx'

const ADMIN = { id: '1', role: 'admin', statut: 'valide', email: 'admin@nakayo.test', nom: 'Équipe' }

const developpeur = {
  id: '42',
  role: 'developpeur',
  statut: 'en_attente',
  nom: 'Studio Awa',
  creeLe: '2026-11-10T09:00:00.000Z',
  developpeur: { email: 'awa@studio.bj', pays: 'BJ', lienFicheDeveloppeur: 'https://play.google.com/store/apps/dev?id=1' },
  testeur: null,
  controles: {
    etat: 'termine',
    liste: [
      { code: 'fiche_play_accessible', libelle: 'Fiche Google Play accessible', resultat: 'ok', detail: null },
      { code: 'email_jetable', libelle: 'Adresse email non jetable', resultat: 'alerte', detail: 'Domaine jetable' },
    ],
  },
}

const testeur = {
  id: '77',
  role: 'testeur',
  statut: 'en_attente',
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
  controles: { etat: 'en_cours', liste: [] },
}

function liste(comptes, extra = {}) {
  return { corps: { comptes, total: comptes.length, page: 1, parPage: 20, ...extra } }
}

function api(table = {}) {
  return simulerApi({
    'GET /api/auth/moi': { corps: { utilisateur: ADMIN } },
    'GET /api/admin/comptes': liste([developpeur, testeur]),
    ...table,
  })
}

async function attendreListe() {
  return screen.findByRole('heading', { name: /comptes? en attente/ })
}

describe('Back-office : comptes en attente (US-08)', () => {
  it('affiche les comptes avec leurs informations et leurs contrôles', async () => {
    const serveur = api()
    rendreA('/admin/comptes')

    expect(await attendreListe()).toHaveTextContent('2 comptes en attente')
    const carteDev = screen.getByRole('article', { name: 'Studio Awa' })
    expect(within(carteDev).getByText('awa@studio.bj')).toBeInTheDocument()
    expect(within(carteDev).getByText('Bénin')).toBeInTheDocument()
    expect(within(carteDev).getByText('1 à vérifier')).toBeInTheDocument()
    expect(within(carteDev).getByText('Domaine jetable')).toBeInTheDocument()

    const carteTesteur = screen.getByRole('article', { name: 'Koffi Agbo' })
    expect(within(carteTesteur).getByText('+229 01 97 00 00 00')).toBeInTheDocument()
    expect(within(carteTesteur).getByText('+229 01 96 00 00 00 (MTN)')).toBeInTheDocument()
    expect(within(carteTesteur).getByText('Tecno Spark 20, Android 14')).toBeInTheDocument()
    expect(within(carteTesteur).getByText(/Contrôles en cours : les résultats peuvent être incomplets/)).toBeInTheDocument()

    expect(serveur.appelsVers('GET', '/api/admin/comptes')[0].query.toString()).toBe('statut=en_attente')
  })

  it('filtre par rôle et par ordre, et garde les filtres dans l’adresse', async () => {
    const serveur = api()
    const user = userEvent.setup()
    const { routeur } = rendreA('/admin/comptes')
    await attendreListe()

    await user.selectOptions(screen.getByLabelText('Rôle'), 'testeur')
    await waitFor(() => expect(serveur.appelsVers('GET', '/api/admin/comptes')).toHaveLength(2))
    expect(serveur.appelsVers('GET', '/api/admin/comptes')[1].query.get('role')).toBe('testeur')
    expect(routeur.state.location.search).toBe('?role=testeur')

    await user.selectOptions(screen.getByLabelText('Ordre'), 'recent')
    await waitFor(() => expect(serveur.appelsVers('GET', '/api/admin/comptes')).toHaveLength(3))
    expect(serveur.appelsVers('GET', '/api/admin/comptes')[2].query.get('tri')).toBe('recent')

    await user.click(screen.getByRole('button', { name: 'Effacer les filtres' }))
    expect(routeur.state.location.search).toBe('')
  })

  it('reprend les filtres présents dans l’adresse', async () => {
    const serveur = api()
    rendreA('/admin/comptes?role=developpeur&du=2026-11-01&au=2026-11-10')
    await attendreListe()
    const query = serveur.appelsVers('GET', '/api/admin/comptes')[0].query
    expect(query.get('role')).toBe('developpeur')
    expect(query.get('du')).toBe('2026-11-01')
    expect(query.get('au')).toBe('2026-11-10')
    expect(screen.getByLabelText('Rôle')).toHaveValue('developpeur')
  })

  it('refuse une période inversée sans appeler l’API', async () => {
    const serveur = api()
    rendreA('/admin/comptes?du=2026-11-10&au=2026-11-01')
    expect(await screen.findByText('La date de fin doit être après la date de début.')).toBeInTheDocument()
    expect(screen.getByLabelText('Inscrit jusqu’au')).toHaveAttribute('aria-invalid', 'true')
    expect(serveur.appelsVers('GET', '/api/admin/comptes')).toHaveLength(0)
  })

  it('distingue la liste vide et l’absence de résultat pour des filtres', async () => {
    api({ 'GET /api/admin/comptes': liste([]) })
    const { unmount } = rendreA('/admin/comptes')
    expect(await screen.findByRole('heading', { name: 'Aucun compte en attente' })).toBeInTheDocument()
    expect(screen.getByText(/Les nouvelles inscriptions apparaîtront ici/)).toBeInTheDocument()
    unmount()

    api({ 'GET /api/admin/comptes': liste([]) })
    rendreA('/admin/comptes?role=testeur')
    expect(await screen.findByText(/Aucun compte ne correspond à ces filtres/)).toBeInTheDocument()
  })

  it('valide un compte : appel API, retrait de la liste, annonce', async () => {
    const serveur = api({ 'POST /api/admin/comptes/:id/validation': { corps: { compte: { ...developpeur, statut: 'valide' } } } })
    const user = userEvent.setup()
    rendreA('/admin/comptes')
    await attendreListe()

    await user.click(screen.getByRole('button', { name: 'Valider le compte de Studio Awa' }))

    expect(await screen.findByText('Compte de Studio Awa validé. La personne est prévenue par email.')).toBeInTheDocument()
    expect(screen.queryByRole('article', { name: 'Studio Awa' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '1 compte en attente' })).toBeInTheDocument()
    expect(serveur.appelsVers('POST', '/api/admin/comptes/42/validation')).toHaveLength(1)
  })

  it('exige un motif pour refuser, puis envoie le refus', async () => {
    const serveur = api({ 'POST /api/admin/comptes/:id/refus': { corps: { compte: { ...testeur, statut: 'refuse' } } } })
    const user = userEvent.setup()
    rendreA('/admin/comptes')
    await attendreListe()

    await user.click(screen.getByRole('button', { name: 'Refuser le compte de Koffi Agbo' }))
    const motif = screen.getByLabelText('Motif du refus')
    expect(motif).toHaveFocus()
    expect(motif).toHaveAccessibleDescription(/envoyé par SMS/)

    await user.click(screen.getByRole('button', { name: 'Confirmer le refus' }))
    expect(screen.getByText('Indiquez le motif du refus. Il sera envoyé à la personne.')).toBeInTheDocument()

    await user.type(motif, 'Flou')
    await user.click(screen.getByRole('button', { name: 'Confirmer le refus' }))
    expect(screen.getByText('Le motif doit contenir au moins 10 caractères.')).toBeInTheDocument()
    expect(serveur.appelsVers('POST', '/api/admin/comptes/77/refus')).toHaveLength(0)

    await user.clear(motif)
    await user.type(motif, '  La photo de la pièce est illisible.  ')
    await user.click(screen.getByRole('button', { name: 'Confirmer le refus' }))

    expect(await screen.findByText('Compte de Koffi Agbo refusé. Le motif est envoyé par SMS.')).toBeInTheDocument()
    expect(serveur.appelsVers('POST', '/api/admin/comptes/77/refus')[0].corps).toEqual({
      motif: 'La photo de la pièce est illisible.',
    })
  })

  it('annule un refus avec Échap et rend le focus au bouton Refuser', async () => {
    api()
    const user = userEvent.setup()
    rendreA('/admin/comptes')
    await attendreListe()

    await user.click(screen.getByRole('button', { name: 'Refuser le compte de Studio Awa' }))
    await user.keyboard('{Escape}')
    expect(screen.queryByLabelText('Motif du refus')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refuser le compte de Studio Awa' })).toHaveFocus())
  })

  it('retire un compte déjà traité par un autre administrateur', async () => {
    api({ 'POST /api/admin/comptes/:id/validation': { statut: 409, corps: { erreur: { code: 'statut_incompatible' } } } })
    const user = userEvent.setup()
    rendreA('/admin/comptes')
    await attendreListe()

    await user.click(screen.getByRole('button', { name: 'Valider le compte de Studio Awa' }))
    expect(await screen.findByText(/déjà été traité par un autre administrateur/)).toBeInTheDocument()
    expect(screen.queryByRole('article', { name: 'Studio Awa' })).not.toBeInTheDocument()
  })

  it('garde le compte et affiche l’erreur si la validation échoue', async () => {
    api({ 'POST /api/admin/comptes/:id/validation': 'reseau' })
    const user = userEvent.setup()
    rendreA('/admin/comptes')
    await attendreListe()

    await user.click(screen.getByRole('button', { name: 'Valider le compte de Studio Awa' }))
    const carte = screen.getByRole('article', { name: 'Studio Awa' })
    expect(await within(carte).findByRole('alert')).toHaveTextContent('Impossible de joindre le serveur')
    expect(within(carte).getByRole('button', { name: 'Valider le compte de Studio Awa' })).toBeEnabled()
  })

  it('affiche les photos du testeur à la demande', async () => {
    const serveur = api({
      'GET /api/admin/comptes/:id': {
        corps: { compte: { ...testeur, documents: { pieceIdentite: '/piece.jpg', selfie: '/selfie.jpg' } } },
      },
    })
    const user = userEvent.setup()
    rendreA('/admin/comptes')
    await attendreListe()

    const bouton = screen.getByRole('button', { name: 'Afficher la pièce d’identité et le selfie' })
    expect(bouton).toHaveAttribute('aria-expanded', 'false')
    await user.click(bouton)

    expect(await screen.findByRole('img', { name: 'Pièce d’identité de Koffi Agbo' })).toHaveAttribute('src', '/piece.jpg')
    expect(screen.getByRole('img', { name: 'Selfie de Koffi Agbo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Masquer les photos' })).toHaveAttribute('aria-expanded', 'true')
    expect(serveur.appelsVers('GET', '/api/admin/comptes/77')).toHaveLength(1)
  })

  it('pagine par 20', async () => {
    const serveur = api({ 'GET /api/admin/comptes': liste([developpeur], { total: 25 }) })
    const user = userEvent.setup()
    const { routeur } = rendreA('/admin/comptes')
    await attendreListe()

    expect(screen.getByText('Page 1 sur 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Précédent' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Suivant' }))
    expect(routeur.state.location.search).toBe('?page=2')
    await waitFor(() => expect(serveur.appelsVers('GET', '/api/admin/comptes').at(-1).query.get('page')).toBe('2'))
  })

  it('propose de réessayer quand la liste ne charge pas', async () => {
    api({ 'GET /api/admin/comptes': ['reseau', liste([developpeur])] })
    const user = userEvent.setup()
    rendreA('/admin/comptes')

    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de joindre le serveur')
    await user.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByRole('heading', { name: '1 compte en attente' })).toBeInTheDocument()
  })

  it('demande de se connecter sans session, et refuse un non-admin', async () => {
    simulerApi({ 'GET /api/auth/moi': { statut: 401, corps: { erreur: { code: 'non_authentifie' } } } })
    const { unmount } = rendreA('/admin/comptes')
    expect(await screen.findByRole('link', { name: 'Connectez-vous' })).toBeInTheDocument()
    unmount()

    simulerApi({ 'GET /api/auth/moi': { corps: { utilisateur: { ...ADMIN, role: 'developpeur' } } } })
    rendreA('/admin/comptes')
    expect(await screen.findByText('Accès réservé aux administrateurs')).toBeInTheDocument()
  })
})
