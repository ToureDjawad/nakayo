import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { corpsEnvoye, rendreA, simulerFetch } from '../../test/outils.jsx'

const developpeur = {
  id: '9',
  role: 'developpeur',
  statut: 'en_attente',
  emailVerifie: true,
  email: 'awa@studio.bj',
  nom: 'Studio Awa',
  pays: 'BJ',
  lienFicheDeveloppeur: 'https://play.google.com/store/apps/dev?id=1',
  motifRefus: null,
}

describe('Vérification de l’email', () => {
  it('confirme l’adresse puis affiche le compte en attente', async () => {
    const espion = simulerFetch({ corps: { utilisateur: developpeur } }, { corps: { utilisateur: developpeur } })
    rendreA('/verification-email?jeton=abc123')

    expect(await screen.findByRole('heading', { name: 'Votre compte est en attente de validation' })).toBeInTheDocument()
    expect(screen.getByText('Votre adresse email est confirmée.')).toBeInTheDocument()
    expect(screen.getByText('Bénin')).toBeInTheDocument()
    expect(corpsEnvoye(espion)).toEqual({ jeton: 'abc123' })
  })

  it('propose un nouveau lien quand celui-ci a expiré', async () => {
    simulerFetch({ statut: 410, corps: { erreur: { code: 'jeton_expire' } } })
    rendreA('/verification-email?jeton=vieux')

    expect(await screen.findByRole('heading', { name: 'Ce lien a expiré' })).toBeInTheDocument()
    expect(screen.getByLabelText('Adresse email du compte')).toBeInTheDocument()
  })

  it('signale un lien sans jeton', async () => {
    simulerFetch()
    rendreA('/verification-email')
    expect(await screen.findByRole('heading', { name: 'Ce lien n’est pas valide' })).toBeInTheDocument()
  })

  it('permet de réessayer après une coupure réseau', async () => {
    simulerFetch('reseau', { corps: { utilisateur: developpeur } }, { corps: { utilisateur: developpeur } })
    const user = userEvent.setup()
    rendreA('/verification-email?jeton=coupure')

    await user.click(await screen.findByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByRole('heading', { name: 'Votre compte est en attente de validation' })).toBeInTheDocument()
  })
})

describe('Compte en attente', () => {
  it('affiche le motif d’un refus', async () => {
    simulerFetch({ corps: { utilisateur: { ...developpeur, statut: 'refuse', motifRefus: 'Fiche introuvable.' } } })
    rendreA('/compte-en-attente')
    expect(await screen.findByText('Fiche introuvable.')).toBeInTheDocument()
  })

  it('invite à se connecter sans session', async () => {
    simulerFetch({ statut: 401, corps: { erreur: { code: 'non_authentifie' } } })
    rendreA('/compte-en-attente')
    expect(await screen.findByRole('link', { name: 'Connectez-vous' })).toBeInTheDocument()
  })
})

describe('Renvoi de l’email', () => {
  it('bloque le bouton après un envoi', async () => {
    simulerFetch({ statut: 202, corps: {} })
    const user = userEvent.setup()
    rendreA('/verifiez-votre-email', { email: 'awa@studio.bj' })

    await user.click(screen.getByRole('button', { name: 'Renvoyer l’email' }))
    expect(await screen.findByText(/un nouveau lien vient d’y être envoyé/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /possible dans 60 s/ })).toBeDisabled()
  })

  it('demande l’adresse quand elle n’est pas connue', async () => {
    simulerFetch()
    rendreA('/verifiez-votre-email')
    expect(screen.getByLabelText('Adresse email du compte')).toBeInTheDocument()
  })
})
