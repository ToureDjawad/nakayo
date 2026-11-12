import { ErreurHttp, introuvable } from '../lib/erreurs.js'
import { texte } from '../lib/validation.js'

export const LIMITES_TICKET = { sujetMin: 3, sujetMax: 120, messageMin: 10, messageMax: 2000 }
export const STATUTS_TICKET = ['ouvert', 'traite']

// Longueur en caractères (comme char_length de PostgreSQL), pas en unités UTF-16.
const longueur = (v) => [...v].length

function validerLongueur(valeur, min, max) {
  if (!valeur) return 'requis'
  if (longueur(valeur) < min) return 'trop_court'
  if (longueur(valeur) > max) return 'trop_long'
  return null
}

// Lit et valide { sujet, message }. Renvoie les valeurs nettoyées et les erreurs par champ.
export function lireTicket(donnees) {
  const sujet = texte(donnees.sujet).replace(/\s+/g, ' ')
  // Le message garde ses retours à la ligne, sans espaces superflus autour.
  const message = texte(donnees.message).replace(/\r\n?/g, '\n')
  return {
    valeurs: { sujet, message },
    erreurs: {
      sujet: validerLongueur(sujet, LIMITES_TICKET.sujetMin, LIMITES_TICKET.sujetMax),
      message: validerLongueur(message, LIMITES_TICKET.messageMin, LIMITES_TICKET.messageMax),
    },
  }
}

function versTicketApi(l) {
  return {
    id: String(l.id),
    sujet: l.sujet,
    message: l.message,
    statut: l.statut,
    creeLe: l.cree_le.toISOString(),
    traiteLe: l.traite_le?.toISOString() ?? null,
  }
}

function versTicketAdmin(l) {
  return {
    ...versTicketApi(l),
    auteur: { id: String(l.utilisateur_id), role: l.role, nom: l.nom, email: l.email, telephone: l.telephone },
  }
}

export async function creerTicket(db, { utilisateurId, sujet, message, maintenant }) {
  const { rows } = await db.query(
    `INSERT INTO tickets_support (utilisateur_id, sujet, message, cree_le) VALUES ($1, $2, $3, $4) RETURNING *`,
    [utilisateurId, sujet, message, maintenant],
  )
  return versTicketApi(rows[0])
}

// Les 20 derniers messages de la personne, du plus récent au plus ancien.
export async function listerTicketsUtilisateur(db, utilisateurId) {
  const { rows } = await db.query(
    `SELECT * FROM tickets_support WHERE utilisateur_id = $1 ORDER BY cree_le DESC, id DESC LIMIT 20`,
    [utilisateurId],
  )
  return rows.map(versTicketApi)
}

const COLONNES_ADMIN = `t.*, u.role, u.nom, u.email, u.telephone`

// File admin : les messages ouverts du plus ancien au plus récent (on traite dans l'ordre),
// les messages traités du plus récent au plus ancien.
export async function listerTicketsAdmin(db, { statut, page, parPage }) {
  const ordre = statut === 'ouvert' ? 't.cree_le ASC, t.id ASC' : 't.traite_le DESC, t.id DESC'
  const { rows } = await db.query(
    `SELECT ${COLONNES_ADMIN}, count(*) OVER ()::int AS total
       FROM tickets_support t JOIN utilisateurs u ON u.id = t.utilisateur_id
      WHERE t.statut = $1
      ORDER BY ${ordre}
      LIMIT $2 OFFSET $3`,
    [statut, parPage, (page - 1) * parPage],
  )
  let total = rows[0]?.total
  if (total === undefined) {
    const r = await db.query('SELECT count(*)::int AS total FROM tickets_support WHERE statut = $1', [statut])
    total = r.rows[0].total
  }
  return { tickets: rows.map(versTicketAdmin), total, page, parPage }
}

// Un seul admin peut traiter un message ; le second reçoit 409 statut_incompatible.
export async function traiterTicket(db, { id, adminId, maintenant }) {
  const { rows } = await db.query(
    `UPDATE tickets_support SET statut = 'traite', traite_le = $3, traite_par = $2
      WHERE id = $1 AND statut = 'ouvert' RETURNING id`,
    [id, adminId, maintenant],
  )
  if (!rows.length) {
    const existe = await db.query('SELECT statut FROM tickets_support WHERE id = $1', [id])
    if (!existe.rows.length) throw introuvable('Message introuvable.')
    throw new ErreurHttp(409, 'statut_incompatible', { message: 'Ce message a déjà été traité.', statut: existe.rows[0].statut })
  }
  const { rows: lignes } = await db.query(
    `SELECT ${COLONNES_ADMIN} FROM tickets_support t JOIN utilisateurs u ON u.id = t.utilisateur_id WHERE t.id = $1`,
    [id],
  )
  return versTicketAdmin(lignes[0])
}
