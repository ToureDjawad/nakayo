import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { rendreA, simulerApi } from './outils.jsx'

const DEV = {
  id: '2',
  role: 'developpeur',
  statut: 'en_attente',
  email: 'awa@studio.bj',
  emailVerifie: true,
  nom: 'Studio Awa',
  pays: 'BJ',
  lienFicheDeveloppeur: 'https://play.google.com/store/apps/dev?id=1',
}

describe('Contact WhatsApp du support sur l’espace développeur (US-40)', () => {
  it('affiche le numéro publié avec un lien WhatsApp', async () => {
    simulerApi({
      'GET /api/auth/moi': { corps: { utilisateur: DEV } },
      'GET /api/support': { corps: { support: { whatsapp: '+2290197000000' } } },
    })
    rendreA('/mon-compte')

    const lien = await screen.findByRole('link', { name: /Écrire au support sur WhatsApp/ })
    const href = new URL(lien.getAttribute('href'))
    expect(href.origin + href.pathname).toBe('https://wa.me/2290197000000')
    expect(href.searchParams.get('text')).toBe('Bonjour, je suis Studio Awa, développeur sur Nakayo (awa@studio.bj). J’ai une question :')
    expect(lien).toHaveAttribute('target', '_blank')
    expect(lien).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByText(/au \+229 01 97 00 00 00/)).toBeInTheDocument()
  })

  it.each(['refuse', 'valide', 'suspendu'])('apparaît aussi pour un compte %s', async (statut) => {
    simulerApi({
      'GET /api/auth/moi': { corps: { utilisateur: { ...DEV, statut, motifRefus: statut === 'refuse' ? 'Fiche introuvable sur Google Play.' : null } } },
      'GET /api/support': { corps: { support: { whatsapp: '+2290197000000' } } },
    })
    rendreA('/mon-compte')
    expect(await screen.findByRole('link', { name: /Écrire au support sur WhatsApp/ })).toBeInTheDocument()
  })

  it('rien quand aucun numéro n’est publié ou que le serveur ne répond pas', async () => {
    const serveur = simulerApi({
      'GET /api/auth/moi': { corps: { utilisateur: DEV } },
      'GET /api/support': [{ corps: { support: { whatsapp: null } } }, 'reseau'],
    })
    const { unmount } = rendreA('/mon-compte')
    await screen.findByRole('heading', { name: 'Votre compte est en cours de vérification' })
    await vi.waitFor(() => expect(serveur.appelsVers('GET', '/api/support')).toHaveLength(1))
    expect(screen.queryByText('Une question ?')).not.toBeInTheDocument()
    unmount()

    rendreA('/mon-compte')
    await screen.findByRole('heading', { name: 'Votre compte est en cours de vérification' })
    await vi.waitFor(() => expect(serveur.appelsVers('GET', '/api/support')).toHaveLength(2))
    expect(screen.queryByText('Une question ?')).not.toBeInTheDocument()
  })
})
