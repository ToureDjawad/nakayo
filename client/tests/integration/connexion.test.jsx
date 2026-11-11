import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { rendreA, simulerApi } from './outils.jsx'

const ADMIN = { id: '1', role: 'admin', statut: 'valide', email: 'admin@nakayo.test', nom: 'Équipe Nakayo' }
const DEV = {
  id: '2',
  role: 'developpeur',
  statut: 'en_attente',
  emailVerifie: true,
  email: 'awa@studio.bj',
  nom: 'Studio Awa',
  pays: 'BJ',
  lienFicheDeveloppeur: 'https://play.google.com/store/apps/dev?id=1',
  motifRefus: null,
}
const LISTE_VIDE = { corps: { comptes: [], total: 0, page: 1, parPage: 20 } }

async function seConnecter(user, email = 'awa@studio.bj', motDePasse = 'une phrase longue') {
  await user.type(screen.getByLabelText('Adresse email'), email)
  await user.type(screen.getByLabelText('Mot de passe'), motDePasse)
  await user.click(screen.getByRole('button', { name: 'Se connecter' }))
}

describe('Connexion (US-09 web)', () => {
  it('demande l’email et le mot de passe avec des messages propres à la connexion', async () => {
    const serveur = simulerApi({})
    const user = userEvent.setup()
    rendreA('/connexion')

    await user.click(screen.getByRole('button', { name: 'Se connecter' }))
    expect(screen.getByText('Saisissez votre adresse email.')).toBeInTheDocument()
    expect(screen.getByText('Saisissez votre mot de passe.')).toBeInTheDocument()
    expect(screen.getByLabelText('Adresse email')).toHaveFocus()
    expect(serveur.appels).toHaveLength(0)
  })

  it('n’impose pas la longueur minimale à la connexion', async () => {
    const serveur = simulerApi({ 'POST /api/auth/connexion': { statut: 401, corps: { erreur: { code: 'identifiants_invalides' } } } })
    const user = userEvent.setup()
    rendreA('/connexion')
    await seConnecter(user, 'awa@studio.bj', 'court')
    await screen.findByRole('alert')
    expect(serveur.appelsVers('POST', '/api/auth/connexion')[0].corps).toEqual({ email: 'awa@studio.bj', motDePasse: 'court' })
  })

  it('envoie un admin vers le back-office', async () => {
    simulerApi({
      'POST /api/auth/connexion': { corps: { utilisateur: ADMIN } },
      'GET /api/auth/moi': { corps: { utilisateur: ADMIN } },
      'GET /api/admin/comptes': LISTE_VIDE,
    })
    const user = userEvent.setup()
    const { routeur } = rendreA('/connexion')
    await seConnecter(user, 'Admin@Nakayo.test')
    expect(await screen.findByRole('heading', { name: 'Aucun compte en attente' })).toBeInTheDocument()
    expect(routeur.state.location.pathname).toBe('/admin/comptes')
  })

  it('envoie un développeur vers son compte et ignore une suite vers un autre site', async () => {
    simulerApi({
      'POST /api/auth/connexion': { corps: { utilisateur: DEV } },
      'GET /api/auth/moi': { corps: { utilisateur: DEV } },
    })
    const user = userEvent.setup()
    const { routeur } = rendreA('/connexion?suite=%2F%2Fexemple.com')
    await seConnecter(user)
    expect(await screen.findByRole('heading', { name: 'Votre compte est en attente de validation' })).toBeInTheDocument()
    expect(routeur.state.location.pathname).toBe('/mon-compte')
  })

  it('revient à la page demandée après connexion', async () => {
    simulerApi({
      'POST /api/auth/connexion': { corps: { utilisateur: ADMIN } },
      'GET /api/auth/moi': { corps: { utilisateur: ADMIN } },
      'GET /api/admin/comptes': LISTE_VIDE,
    })
    const user = userEvent.setup()
    const { routeur } = rendreA('/connexion?suite=%2Fadmin%2Fcomptes%3Frole%3Dtesteur')
    await seConnecter(user)
    await waitFor(() => expect(routeur.state.location.search).toBe('?role=testeur'))
  })

  it('identifiants faux : message neutre, mot de passe vidé, email gardé', async () => {
    simulerApi({ 'POST /api/auth/connexion': { statut: 401, corps: { erreur: { code: 'identifiants_invalides' } } } })
    const user = userEvent.setup()
    rendreA('/connexion')
    await seConnecter(user)

    const alerte = await screen.findByRole('alert')
    expect(alerte).toHaveTextContent('Adresse email ou mot de passe incorrect.')
    await waitFor(() => expect(alerte).toHaveFocus())
    expect(screen.getByLabelText('Mot de passe')).toHaveValue('')
    expect(screen.getByLabelText('Mot de passe')).not.toHaveAttribute('aria-invalid')
    expect(screen.queryByText('Saisissez votre mot de passe.')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Adresse email')).toHaveValue('awa@studio.bj')
  })

  it('email non confirmé : propose de renvoyer le lien', async () => {
    const serveur = simulerApi({
      'POST /api/auth/connexion': { statut: 403, corps: { erreur: { code: 'email_non_verifie' } } },
      'POST /api/auth/verification-email/renvoi': { statut: 202, corps: {} },
    })
    const user = userEvent.setup()
    rendreA('/connexion')
    await seConnecter(user)

    expect(await screen.findByText('Adresse email non confirmée')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Renvoyer l’email' }))
    expect(await screen.findByText(/un nouveau lien vient d’y être envoyé/)).toBeInTheDocument()
    expect(serveur.appelsVers('POST', '/api/auth/verification-email/renvoi')[0].corps).toEqual({ email: 'awa@studio.bj' })
  })

  it('compte suspendu et trop de tentatives', async () => {
    simulerApi({
      'POST /api/auth/connexion': [
        { statut: 403, corps: { erreur: { code: 'compte_suspendu' } } },
        { statut: 429, corps: { erreur: { code: 'trop_de_requetes' } }, entetes: { 'Retry-After': '840' } },
      ],
    })
    const user = userEvent.setup()
    rendreA('/connexion')
    await seConnecter(user)
    expect(await screen.findByText('Compte suspendu')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Mot de passe'), 'x')
    await user.click(screen.getByRole('button', { name: 'Se connecter' }))
    expect(await screen.findByText('Trop de tentatives. Réessayez dans 14 minutes.')).toBeInTheDocument()
  })
})

describe('Déconnexion', () => {
  it('ferme la session depuis l’en-tête et revient à la connexion', async () => {
    const serveur = simulerApi({
      'GET /api/auth/moi': { corps: { utilisateur: DEV } },
      'POST /api/auth/deconnexion': { statut: 204 },
    })
    const user = userEvent.setup()
    const { routeur } = rendreA('/mon-compte')
    await screen.findByRole('heading', { name: 'Votre compte est en attente de validation' })

    await user.click(screen.getByRole('button', { name: 'Se déconnecter' }))
    expect(await screen.findByText('Vous êtes déconnecté.')).toBeInTheDocument()
    expect(routeur.state.location.pathname).toBe('/connexion')
    expect(serveur.appelsVers('POST', '/api/auth/deconnexion')).toHaveLength(1)
  })

  it('signale une déconnexion impossible', async () => {
    simulerApi({ 'GET /api/auth/moi': { corps: { utilisateur: ADMIN } }, 'GET /api/admin/comptes': LISTE_VIDE, 'POST /api/auth/deconnexion': 'reseau' })
    const user = userEvent.setup()
    const { routeur } = rendreA('/admin/comptes')
    await screen.findByRole('heading', { name: 'Aucun compte en attente' })

    await user.click(screen.getByRole('button', { name: 'Se déconnecter' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Déconnexion impossible.')
    expect(routeur.state.location.pathname).toBe('/admin/comptes')
  })

  it('le lien de connexion du back-office garde la page demandée', async () => {
    simulerApi({ 'GET /api/auth/moi': { statut: 401, corps: { erreur: { code: 'non_authentifie' } } } })
    rendreA('/admin/comptes?role=testeur')
    expect(await screen.findByRole('link', { name: 'Connectez-vous' })).toHaveAttribute(
      'href',
      '/connexion?suite=%2Fadmin%2Fcomptes%3Frole%3Dtesteur',
    )
  })
})

describe('Mot de passe oublié', () => {
  it('confirme l’envoi sans dire si le compte existe, puis bloque le renvoi', async () => {
    const serveur = simulerApi({ 'POST /api/auth/mot-de-passe/oubli': { statut: 202, corps: {} } })
    const user = userEvent.setup()
    rendreA('/connexion')
    await user.click(screen.getByRole('link', { name: 'Mot de passe oublié ?' }))

    await user.type(screen.getByLabelText('Adresse email'), 'Awa@Studio.bj')
    await user.click(screen.getByRole('button', { name: 'Envoyer le lien' }))

    expect(await screen.findByText(/Si un compte existe pour/)).toHaveTextContent('awa@studio.bj')
    expect(screen.getByRole('button', { name: /possible dans 60 s/ })).toBeDisabled()
    expect(serveur.appelsVers('POST', '/api/auth/mot-de-passe/oubli')[0].corps).toEqual({ email: 'awa@studio.bj' })
  })

  it('affiche le délai en cas de limite atteinte', async () => {
    simulerApi({ 'POST /api/auth/mot-de-passe/oubli': { statut: 429, corps: { erreur: { code: 'trop_de_requetes' } }, entetes: { 'Retry-After': '120' } } })
    const user = userEvent.setup()
    rendreA('/mot-de-passe-oublie')
    await user.type(screen.getByLabelText('Adresse email'), 'awa@studio.bj')
    await user.click(screen.getByRole('button', { name: 'Envoyer le lien' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Réessayez dans 2 minutes')
  })
})

describe('Réinitialisation du mot de passe', () => {
  it('vérifie la longueur et la confirmation avant d’envoyer', async () => {
    const serveur = simulerApi({})
    const user = userEvent.setup()
    rendreA('/reinitialiser-mot-de-passe?jeton=abc')

    await user.type(screen.getByLabelText('Nouveau mot de passe'), 'court')
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'autre')
    await user.click(screen.getByRole('button', { name: 'Enregistrer le mot de passe' }))
    expect(screen.getByText('Le mot de passe doit contenir au moins 10 caractères.')).toBeInTheDocument()
    expect(screen.getByText('Les deux mots de passe ne correspondent pas.')).toBeInTheDocument()
    expect(serveur.appels).toHaveLength(0)
  })

  it('enregistre le mot de passe puis renvoie vers la connexion', async () => {
    const serveur = simulerApi({ 'POST /api/auth/mot-de-passe/reinitialisation': { statut: 204 } })
    const user = userEvent.setup()
    const { routeur } = rendreA('/reinitialiser-mot-de-passe?jeton=abc')

    await user.type(screen.getByLabelText('Nouveau mot de passe'), 'une nouvelle phrase')
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'une nouvelle phrase')
    await user.click(screen.getByRole('button', { name: 'Enregistrer le mot de passe' }))

    expect(await screen.findByText(/Votre mot de passe a été modifié/)).toBeInTheDocument()
    expect(routeur.state.location.pathname).toBe('/connexion')
    expect(serveur.appelsVers('POST', '/api/auth/mot-de-passe/reinitialisation')[0].corps).toEqual({
      jeton: 'abc',
      motDePasse: 'une nouvelle phrase',
    })
  })

  it('gère un lien absent, expiré ou déjà utilisé', async () => {
    simulerApi({})
    const premier = rendreA('/reinitialiser-mot-de-passe')
    expect(screen.getByRole('heading', { name: 'Ce lien n’est pas valide' })).toBeInTheDocument()
    premier.unmount()

    for (const [statut, code, titre] of [
      [410, 'jeton_expire', 'Ce lien a expiré'],
      [400, 'jeton_invalide', 'Ce lien n’est pas valide'],
    ]) {
      simulerApi({ 'POST /api/auth/mot-de-passe/reinitialisation': { statut, corps: { erreur: { code } } } })
      const user = userEvent.setup()
      const rendu = rendreA('/reinitialiser-mot-de-passe?jeton=abc')
      await user.type(screen.getByLabelText('Nouveau mot de passe'), 'une nouvelle phrase')
      await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'une nouvelle phrase')
      await user.click(screen.getByRole('button', { name: 'Enregistrer le mot de passe' }))
      expect(await screen.findByRole('heading', { name: titre })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Demander un nouveau lien' })).toHaveAttribute('href', '/mot-de-passe-oublie')
      rendu.unmount()
    }
  })
})
