import { requete } from './client.js'

// Ne transmet que les filtres renseignés (docs/api-sprint1.md §5.1).
export function construireRequeteComptes({ role, du, au, tri, page } = {}) {
  const parametres = new URLSearchParams()
  parametres.set('statut', 'en_attente')
  if (role) parametres.set('role', role)
  if (du) parametres.set('du', du)
  if (au) parametres.set('au', au)
  if (tri && tri !== 'ancien') parametres.set('tri', tri)
  if (page && page > 1) parametres.set('page', String(page))
  return parametres.toString()
}

export function listerComptes(filtres, { signal } = {}) {
  return requete(`/admin/comptes?${construireRequeteComptes(filtres)}`, { signal })
}

export function lireCompte(id, { signal } = {}) {
  return requete(`/admin/comptes/${encodeURIComponent(id)}`, { signal })
}

export function validerCompte(id) {
  return requete(`/admin/comptes/${encodeURIComponent(id)}/validation`, { methode: 'POST' })
}

export function refuserCompte(id, motif) {
  return requete(`/admin/comptes/${encodeURIComponent(id)}/refus`, { methode: 'POST', corps: { motif } })
}

// Numéro WhatsApp du support (docs/api-sprint1.md §11.2).
export function lireSupport({ signal } = {}) {
  return requete('/admin/support', { signal })
}

export function enregistrerWhatsapp(whatsapp) {
  return requete('/admin/support', { methode: 'PUT', corps: { whatsapp } })
}

export function publierWhatsapp() {
  return requete('/admin/support/publication', { methode: 'POST' })
}

export function retirerWhatsapp() {
  return requete('/admin/support/publication', { methode: 'DELETE' })
}
