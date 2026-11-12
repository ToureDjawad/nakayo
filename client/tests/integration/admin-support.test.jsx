import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { rendreA, simulerApi } from './outils.jsx'

const ADMIN = { id: '1', role: 'admin', statut: 'valide', email: 'admin@nakayo.test', nom: 'Équipe' }
const VIDE = { whatsapp: null, whatsappPublie: null, modifieLe: null, publieLe: null }
const ENREGISTRE = { ...VIDE, whatsapp: '+2290197000000', modifieLe: '2026-11-12T09:00:00.000Z' }
const PUBLIE = { ...ENREGISTRE, whatsappPublie: '+2290197000000', publieLe: '2026-11-12T09:05:00.000Z' }

function api(table) {
  return simulerApi({ 'GET /api/auth/moi': { corps: { utilisateur: ADMIN } }, ...table })
}

describe('Back-office : contact du support (US-40)', () => {
  it('enregistre le numéro, puis le publie', async () => {
    const user = userEvent.setup()
    const serveur = api({
      'GET /api/admin/support': { corps: { support: VIDE } },
      'PUT /api/admin/support': { corps: { support: ENREGISTRE } },
      'POST /api/admin/support/publication': { corps: { support: PUBLIE } },
    })
    rendreA('/admin/support')

    expect(await screen.findByText(/Aucun numéro publié/)).toBeInTheDocument()
    const champ = screen.getByLabelText('Numéro WhatsApp du support')
    await user.type(champ, '00229 01 97 00 00 00')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText(/Numéro enregistré\. Il n’est visible/)).toBeInTheDocument()
    expect(serveur.appelsVers('PUT', '/api/admin/support')[0].corps).toEqual({ whatsapp: '+2290197000000' })
    expect(screen.getByText(/pas encore publié/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Publier ce numéro' }))
    expect(await screen.findByText(/Numéro publié : les testeurs/)).toBeInTheDocument()
    expect(screen.getByText('+229 01 97 00 00 00')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Publier ce numéro' })).not.toBeInTheDocument()
  })

  it('refuse un numéro sans indicatif sans appeler l’API', async () => {
    const user = userEvent.setup()
    const serveur = api({ 'GET /api/admin/support': { corps: { support: VIDE } } })
    rendreA('/admin/support')

    await user.type(await screen.findByLabelText('Numéro WhatsApp du support'), '97 00 00 00')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByText(/au format international/)).toBeInTheDocument()
    expect(serveur.appelsVers('PUT', '/api/admin/support')).toHaveLength(0)
  })

  it('retire un numéro publié', async () => {
    const user = userEvent.setup()
    api({
      'GET /api/admin/support': { corps: { support: PUBLIE } },
      'DELETE /api/admin/support/publication': { corps: { support: { ...PUBLIE, whatsappPublie: null } } },
    })
    rendreA('/admin/support')

    expect(await screen.findByText('+229 01 97 00 00 00')).toBeInTheDocument()
    expect(screen.getByLabelText('Numéro WhatsApp du support')).toHaveValue('+2290197000000')
    await user.click(screen.getByRole('button', { name: 'Retirer la publication' }))
    expect(await screen.findByText(/n’est plus affiché/)).toBeInTheDocument()
    expect(screen.getByText(/Aucun numéro publié/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publier ce numéro' })).toBeInTheDocument()
  })

  it('erreur réseau au chargement, puis réessai', async () => {
    const user = userEvent.setup()
    api({ 'GET /api/admin/support': ['reseau', { corps: { support: VIDE } }] })
    rendreA('/admin/support')

    expect(await screen.findByText(/Impossible de joindre le serveur/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByText(/Aucun numéro publié/)).toBeInTheDocument()
  })

  it('le lien du menu admin mène à la page', async () => {
    api({ 'GET /api/admin/support': { corps: { support: VIDE } } })
    rendreA('/admin/support')
    expect(await screen.findByRole('link', { name: 'Contact du support' })).toHaveAttribute('aria-current', 'page')
  })
})
