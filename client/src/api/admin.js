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

// Vérification des apps payées (docs/api-sprint2.md §4).
export function listerAppsAVerifier({ statut = 'en_verification', page = 1 } = {}, { signal } = {}) {
  const parametres = new URLSearchParams()
  if (statut !== 'en_verification') parametres.set('statut', statut)
  if (page > 1) parametres.set('page', String(page))
  const requeteTexte = parametres.toString()
  return requete(`/admin/apps${requeteTexte ? `?${requeteTexte}` : ''}`, { signal })
}

export function validerApp(id) {
  return requete(`/admin/apps/${encodeURIComponent(id)}/validation`, { methode: 'POST' })
}

export function refuserApp(id, motif) {
  return requete(`/admin/apps/${encodeURIComponent(id)}/refus`, { methode: 'POST', corps: { motif } })
}

// Suivi des campagnes (docs/api-sprint3.md §1.4).
export function listerCampagnes({ statut = 'en_cours', page = 1 } = {}, { signal } = {}) {
  const parametres = new URLSearchParams()
  if (statut !== 'en_cours') parametres.set('statut', statut)
  if (page > 1) parametres.set('page', String(page))
  const requeteTexte = parametres.toString()
  return requete(`/admin/campagnes${requeteTexte ? `?${requeteTexte}` : ''}`, { signal })
}

export function lireCampagneAdmin(id, { signal } = {}) {
  return requete(`/admin/campagnes/${encodeURIComponent(id)}`, { signal })
}

export function remplacerTesteur(campagneId, affectationId, motif) {
  return requete(`/admin/campagnes/${encodeURIComponent(campagneId)}/affectations/${encodeURIComponent(affectationId)}/remplacement`, {
    methode: 'POST',
    corps: { motif },
  })
}

// Tableau de bord global (docs/api-sprint4.md §5) et relance d'un versement échoué (§2.4).
export function lireTableauDeBord({ signal } = {}) {
  return requete('/admin/tableau-de-bord', { signal })
}

export function relancerVersement(reference) {
  return requete(`/admin/versements/${encodeURIComponent(reference)}/relance`, { methode: 'POST' })
}
