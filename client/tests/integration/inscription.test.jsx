import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { corpsEnvoye, rendreA, simulerFetch } from './outils.jsx'

async function remplir(user, valeurs = {}) {
  const v = {
    nom: 'Studio Awa',
    email: 'Awa@Studio.bj',
    motDePasse: 'une phrase longue',
    pays: 'BJ',
    lien: 'play.google.com/store/apps/dev?id=1234567890',
    ...valeurs,
  }
  await user.type(screen.getByLabelText('Nom de développeur Google Play'), v.nom)
  await user.type(screen.getByLabelText('Adresse email'), v.email)
  await user.type(screen.getByLabelText('Mot de passe'), v.motDePasse)
  await user.selectOptions(screen.getByLabelText('Pays'), v.pays)
  await user.type(screen.getByLabelText('Lien de votre fiche développeur Google Play'), v.lien)
  await user.click(screen.getByRole('checkbox'))
}

describe('Inscription développeur', () => {
  it('affiche une erreur par champ et met le focus sur le premier sans appeler l’API', async () => {
    const espion = simulerFetch()
    const user = userEvent.setup()
    rendreA('/inscription')

    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    expect(screen.getByText('Saisissez votre nom de développeur.')).toBeInTheDocument()
    expect(screen.getByText('Saisissez votre adresse email.')).toBeInTheDocument()
    expect(screen.getByText('Choisissez un mot de passe.')).toBeInTheDocument()
    expect(screen.getByText('Choisissez votre pays.')).toBeInTheDocument()
    expect(screen.getByText('Collez le lien de votre fiche développeur Google Play.')).toBeInTheDocument()
    expect(screen.getByText(/Vous devez accepter les conditions/)).toBeInTheDocument()
    expect(screen.getByLabelText('Nom de développeur Google Play')).toHaveFocus()
    expect(screen.getByLabelText('Nom de développeur Google Play')).toHaveAttribute('aria-invalid', 'true')
    expect(espion).not.toHaveBeenCalled()
  })

  it('n’affiche pas « obligatoire » quand on traverse un champ vide au clavier', async () => {
    simulerFetch()
    const user = userEvent.setup()
    rendreA('/inscription')

    await user.click(screen.getByLabelText('Nom de développeur Google Play'))
    await user.tab()
    expect(screen.queryByText('Saisissez votre nom de développeur.')).not.toBeInTheDocument()
  })

  it('signale un format invalide en quittant le champ', async () => {
    simulerFetch()
    const user = userEvent.setup()
    rendreA('/inscription')

    await user.type(screen.getByLabelText('Adresse email'), 'awa@')
    await user.tab()
    expect(screen.getByText(/Cette adresse email n’est pas valide/)).toBeInTheDocument()
  })

  it('affiche un compteur à l’approche de la limite', async () => {
    simulerFetch()
    const user = userEvent.setup()
    rendreA('/inscription')

    await user.type(screen.getByLabelText('Nom de développeur Google Play'), 'x'.repeat(64))
    expect(screen.getByText('64 / 80 caractères')).toBeInTheDocument()
  })

  it('envoie les données nettoyées puis affiche l’écran de vérification', async () => {
    const espion = simulerFetch({ statut: 201, corps: { utilisateur: { id: '1', statut: 'en_attente' } } })
    const user = userEvent.setup()
    rendreA('/inscription')

    await remplir(user)
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    expect(await screen.findByRole('heading', { name: 'Vérifiez votre adresse email' })).toBeInTheDocument()
    expect(screen.getByText('awa@studio.bj')).toBeInTheDocument()
    expect(espion.mock.calls[0][0]).toBe('/api/auth/inscription')
    expect(corpsEnvoye(espion)).toEqual({
      nom: 'Studio Awa',
      email: 'awa@studio.bj',
      motDePasse: 'une phrase longue',
      pays: 'BJ',
      lienFicheDeveloppeur: 'https://play.google.com/store/apps/dev?id=1234567890',
      accepteConditions: true,
    })
  })

  it('place l’erreur « email déjà utilisé » renvoyée par l’API sous le champ', async () => {
    simulerFetch({ statut: 409, corps: { erreur: { code: 'conflit', champs: { email: 'deja_utilise' } } } })
    const user = userEvent.setup()
    rendreA('/inscription')

    await remplir(user)
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    expect(await screen.findByText('Un compte existe déjà avec cette adresse email.')).toBeInTheDocument()
    expect(screen.getByLabelText('Adresse email')).toHaveFocus()
  })

  it('garde la saisie et prévient en cas de coupure réseau', async () => {
    simulerFetch('reseau')
    const user = userEvent.setup()
    rendreA('/inscription')

    await remplir(user)
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de joindre le serveur')
    expect(screen.getByLabelText('Adresse email')).toHaveValue('Awa@Studio.bj')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Créer mon compte' })).toBeEnabled())
  })

  it('indique le délai d’attente quand la limite est atteinte', async () => {
    simulerFetch({ statut: 429, corps: { erreur: { code: 'trop_de_requetes' } }, entetes: { 'Retry-After': '300' } })
    const user = userEvent.setup()
    rendreA('/inscription')

    await remplir(user)
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Réessayez dans 5 minutes')
  })
})
