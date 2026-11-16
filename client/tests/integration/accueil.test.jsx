import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { rendreA, simulerApi, simulerFetch } from './outils.jsx'

afterEach(() => vi.unstubAllGlobals())

describe('Accueil (maquette D01)', () => {
  it('présente la règle, les étapes, les vérifications, les offres, la garantie et la FAQ', () => {
    simulerFetch()
    rendreA('/')
    expect(screen.getByRole('heading', { level: 1, name: /12 testeurs pendant 14 jours/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Soumettre mon app · 29 \$/ })).toHaveAttribute('href', '/inscription')
    expect(screen.getByRole('heading', { name: 'La règle, en clair' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Quatre étapes, et vous gardez la main sur la Play Console' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Un jour ne compte que s’il est vraiment fait' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Si Google refuse, on recommence' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Vous êtes au Bénin\s\? Devenez testeur/ })).toBeInTheDocument()
    expect(screen.getByText(/ne vous demande jamais l’accès à votre Play Console/)).toBeInTheDocument()
  })

  it('les trois offres sont ouvertes : Standard, Pro et Plus sur devis', () => {
    simulerFetch()
    rendreA('/')
    const section = screen.getByRole('region', { name: 'Un prix par app, payé une fois' })
    const offres = within(section).getAllByRole('listitem', { name: /Standard|Pro|Plus/ })
    expect(offres.map((o) => o.getAttribute('aria-labelledby'))).toEqual(['offre-standard', 'offre-pro', 'offre-afrique'])
    expect(within(offres[0]).getByText(/17\s400 FCFA/)).toBeInTheDocument()
    expect(within(offres[0]).getByRole('link', { name: 'Choisir Standard' })).toHaveAttribute('href', '/inscription')
    expect(within(offres[1]).getByText(/35\s400 FCFA/)).toBeInTheDocument()
    expect(within(offres[1]).getByRole('link', { name: 'Choisir Pro' })).toHaveAttribute('href', '/inscription')
    expect(within(offres[1]).queryByText('Bientôt disponible')).not.toBeInTheDocument()
    expect(within(offres[2]).getByRole('link', { name: 'Demander un devis' })).toHaveAttribute('href', '/inscription')
    expect(screen.queryByText('Bientôt disponible')).not.toBeInTheDocument()
  })

  it('la navigation mène aux sections et le pied de page aux textes légaux', () => {
    simulerFetch()
    rendreA('/')
    const nav = screen.getByRole('navigation', { name: 'Sections de la page' })
    expect(within(nav).getByRole('link', { name: 'Offres' })).toHaveAttribute('href', '#offres')
    expect(within(nav).getByRole('link', { name: 'FAQ' })).toHaveAttribute('href', '#questions')
    for (const ancre of ['fonctionnement', 'offres', 'garantie', 'devenir-testeur', 'questions']) {
      expect(document.getElementById(ancre)).not.toBeNull()
    }
    const legal = screen.getByRole('navigation', { name: 'Informations légales' })
    expect(within(legal).getByRole('link', { name: 'Conditions générales (CGU)' })).toHaveAttribute('href', '/conditions-utilisation')
    expect(within(legal).getByRole('link', { name: 'Politique de confidentialité' })).toHaveAttribute('href', '/confidentialite')
    expect(within(legal).getByRole('link', { name: 'Mentions légales' })).toHaveAttribute('href', '/mentions-legales')
  })

  it('la FAQ s’ouvre sur la première question et déplie les autres', async () => {
    simulerFetch()
    const user = userEvent.setup()
    rendreA('/')
    expect(screen.getByText('Mon compte est-il concerné ?').closest('details')).toHaveAttribute('open')
    const question = screen.getByText('Pouvez-vous garantir l’accord de Google ?')
    expect(question.closest('details')).not.toHaveAttribute('open')
    await user.click(question)
    expect(question.closest('details')).toHaveAttribute('open')
    expect(screen.getByText(/la décision appartient à Google/)).toBeVisible()
  })

  it('le bouton WhatsApp n’apparaît que si l’équipe a publié un numéro', async () => {
    simulerApi({ 'GET /api/support': { corps: { support: { whatsapp: '+22901970000000' } } } })
    rendreA('/')
    const lien = await screen.findByRole('link', { name: /Parler à l’équipe sur WhatsApp/ })
    expect(lien.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/22901970000000\?text=/)
  })

  it('sans numéro publié, pas de bouton WhatsApp', async () => {
    const serveur = simulerApi({ 'GET /api/support': { corps: { support: { whatsapp: null } } } })
    rendreA('/')
    await waitFor(() => expect(serveur.appelsVers('GET', '/api/support')).toHaveLength(1))
    expect(screen.queryByRole('link', { name: /WhatsApp/ })).not.toBeInTheDocument()
  })
})
