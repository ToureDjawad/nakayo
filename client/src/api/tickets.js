import { requete } from './client.js'

// Messages au support (docs/api-sprint1.md §12).
export function envoyerTicket({ sujet, message }) {
  return requete('/tickets', { methode: 'POST', corps: { sujet, message } })
}

export function listerMesTickets({ signal } = {}) {
  return requete('/tickets/moi', { signal })
}

export function listerTicketsAdmin({ statut = 'ouvert', page = 1 } = {}, { signal } = {}) {
  const parametres = new URLSearchParams({ statut })
  if (page > 1) parametres.set('page', String(page))
  return requete(`/admin/tickets?${parametres}`, { signal })
}

export function traiterTicket(id) {
  return requete(`/admin/tickets/${encodeURIComponent(id)}/traitement`, { methode: 'POST' })
}
