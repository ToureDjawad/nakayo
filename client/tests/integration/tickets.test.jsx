import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { rendreA, simulerApi } from './outils.jsx'

const DEV = { id: '2', role: 'developpeur', statut: 'valide', email: 'awa@studio.bj', emailVerifie: true, nom: 'Studio Awa', pays: 'BJ' }
const ADMIN = { id: '1', role: 'admin', statut: 'valide', email: 'admin@nakayo.test', nom: 'Équipe' }
const TICKET = {
  id: '12',
  sujet: 'Lancement de campagne',
  message: 'Bonjour,\nquand puis-je lancer ma campagne ?',
  statut: 'ouvert',
  creeLe: '2026-11-12T09:00:00.000Z',
  traiteLe: null,
}
const AUTEUR = { id: '2', role: 'developpeur', nom: 'Studio Awa', email: 'awa@studio.bj', telephone: null }

describe('Écrire à l’équipe depuis l’espace développeur (US-40)', () => {
  it('envoie un message et l’ajoute à l’historique', async () => {
    const user = userEvent.setup()
    const serveur = simulerApi({
      'GET /api/auth/moi': { corps: { utilisateur: DEV } },
      'GET /api/support': { corps: { support: { whatsapp: null } } },
      'GET /api/tickets/moi': { corps: { tickets: [] } },
      'POST /api/tickets': { statut: 201, corps: { ticket: TICKET } },
    })
    rendreA('/mon-compte/support')

    await user.type(await screen.findByLabelText('Sujet'), '  Lancement de campagne ')
    await user.type(screen.getByLabelText('Votre message'), 'Bonjour,{enter}quand puis-je lancer ma campagne ?')
    await user.click(screen.getByRole('button', { name: 'Envoyer le message' }))

    expect(await screen.findByText('Message envoyé')).toBeInTheDocument()
    expect(serveur.appelsVers('POST', '/api/tickets')[0].corps).toEqual({
      sujet: 'Lancement de campagne',
      message: 'Bonjour,\nquand puis-je lancer ma campagne ?',
    })
    expect(screen.getByRole('heading', { name: 'Vos messages' })).toBeInTheDocument()
    expect(screen.getByText('Envoyé')).toBeInTheDocument()
    expect(screen.getByLabelText('Sujet')).toHaveValue('')
  })

  it('vérifie les champs avant l’envoi', async () => {
    const user = userEvent.setup()
    const serveur = simulerApi({
      'GET /api/auth/moi': { corps: { utilisateur: DEV } },
      'GET /api/support': { corps: { support: { whatsapp: null } } },
      'GET /api/tickets/moi': { corps: { tickets: [] } },
    })
    rendreA('/mon-compte/support')
    await user.type(await screen.findByLabelText('Sujet'), 'ab')
    await user.click(screen.getByRole('button', { name: 'Envoyer le message' }))
    expect(await screen.findByText('Le sujet doit contenir au moins 3 caractères.')).toBeInTheDocument()
    expect(screen.getByText('Écrivez votre message.')).toBeInTheDocument()
    expect(serveur.appelsVers('POST', '/api/tickets')).toHaveLength(0)
  })

  it('trop de messages : message clair', async () => {
    const user = userEvent.setup()
    simulerApi({
      'GET /api/auth/moi': { corps: { utilisateur: DEV } },
      'GET /api/support': { corps: { support: { whatsapp: null } } },
      'GET /api/tickets/moi': { corps: { tickets: [{ ...TICKET, statut: 'traite', traiteLe: '2026-11-12T10:00:00.000Z' }] } },
      'POST /api/tickets': { statut: 429, corps: { erreur: { code: 'trop_de_requetes' } }, entetes: { 'Retry-After': '1200' } },
    })
    rendreA('/mon-compte/support')
    expect(await screen.findByText('Traité')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Sujet'), 'Encore une question')
    await user.type(screen.getByLabelText('Votre message'), 'Une autre question importante.')
    await user.click(screen.getByRole('button', { name: 'Envoyer le message' }))
    expect(await screen.findByText('Trop de tentatives. Réessayez dans 20 minutes.')).toBeInTheDocument()
  })

  it('sans session, invite à se connecter', async () => {
    simulerApi({ 'GET /api/auth/moi': { statut: 401, corps: { erreur: { code: 'non_authentifie' } } } })
    rendreA('/mon-compte/support')
    expect(await screen.findByRole('link', { name: 'Connectez-vous' })).toHaveAttribute('href', '/connexion?suite=%2Fmon-compte%2Fsupport')
  })
})

describe('Back-office : messages reçus (US-40)', () => {
  it('liste les messages à traiter et en marque un comme traité', async () => {
    const user = userEvent.setup()
    const serveur = simulerApi({
      'GET /api/auth/moi': { corps: { utilisateur: ADMIN } },
      'GET /api/admin/tickets': { corps: { tickets: [{ ...TICKET, auteur: AUTEUR }], total: 1, page: 1, parPage: 20 } },
      'POST /api/admin/tickets/:id/traitement': {
        corps: { ticket: { ...TICKET, statut: 'traite', traiteLe: '2026-11-12T10:00:00.000Z', auteur: AUTEUR } },
      },
    })
    rendreA('/admin/messages')

    expect(await screen.findByRole('heading', { name: '1 message à traiter' })).toBeInTheDocument()
    const carte = screen.getByRole('article', { name: 'Lancement de campagne' })
    expect(carte).toHaveTextContent('Studio Awa · Développeur · awa@studio.bj')
    expect(carte).toHaveTextContent('quand puis-je lancer ma campagne ?')

    await user.click(screen.getByRole('button', { name: 'Marquer comme traité' }))
    expect(await screen.findByText('Message marqué comme traité.')).toBeInTheDocument()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Aucun message à traiter' })).toBeInTheDocument()
    expect(serveur.appelsVers('POST', '/api/admin/tickets/12/traitement')).toHaveLength(1)
  })

  it('message déjà traité par un autre admin', async () => {
    const user = userEvent.setup()
    simulerApi({
      'GET /api/auth/moi': { corps: { utilisateur: ADMIN } },
      'GET /api/admin/tickets': { corps: { tickets: [{ ...TICKET, auteur: AUTEUR }], total: 1, page: 1, parPage: 20 } },
      'POST /api/admin/tickets/:id/traitement': { statut: 409, corps: { erreur: { code: 'statut_incompatible', statut: 'traite' } } },
    })
    rendreA('/admin/messages')
    await user.click(await screen.findByRole('button', { name: 'Marquer comme traité' }))
    expect(await screen.findByText('Ce message avait déjà été traité par un autre admin.')).toBeInTheDocument()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })

  it('onglet des messages traités', async () => {
    const user = userEvent.setup()
    const serveur = simulerApi({
      'GET /api/auth/moi': { corps: { utilisateur: ADMIN } },
      'GET /api/admin/tickets': ({ query }) =>
        query.get('statut') === 'traite'
          ? { corps: { tickets: [{ ...TICKET, statut: 'traite', traiteLe: '2026-11-12T10:00:00.000Z', auteur: AUTEUR }], total: 1, page: 1, parPage: 20 } }
          : { corps: { tickets: [], total: 0, page: 1, parPage: 20 } },
    })
    const { routeur } = rendreA('/admin/messages')
    expect(await screen.findByRole('heading', { name: 'Aucun message à traiter' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Traités' }))
    expect(await screen.findByRole('heading', { name: '1 message traité' })).toBeInTheDocument()
    expect(screen.getByText(/Traité le/)).toBeInTheDocument()
    expect(routeur.state.location.search).toBe('?statut=traite')
    expect(serveur.appelsVers('GET', '/api/admin/tickets').at(-1).query.get('statut')).toBe('traite')
  })
})
