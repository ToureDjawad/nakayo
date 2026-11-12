import { ErreurHttp } from '../lib/erreurs.js'

// Numéro WhatsApp du support, au format international : « +2290197000000 ».
// On accepte les espaces, points, tirets et parenthèses, et « 00 » à la place de « + ».
export function normaliserWhatsapp(valeur) {
  if (typeof valeur !== 'string') return ''
  const v = valeur.trim().replace(/[\s.()-]/g, '')
  return v.startsWith('00') ? `+${v.slice(2)}` : v
}

export function validerWhatsapp(valeur) {
  if (!valeur) return 'requis'
  if (!/^\+[1-9]\d{7,14}$/.test(valeur)) return 'format_invalide'
  return null
}

const VIDE = { whatsapp: null, whatsapp_publie: null, modifie_le: null, publie_le: null }

function versApi(ligne = VIDE) {
  return {
    whatsapp: ligne.whatsapp,
    whatsappPublie: ligne.whatsapp_publie,
    modifieLe: ligne.modifie_le?.toISOString() ?? null,
    publieLe: ligne.publie_le?.toISOString() ?? null,
  }
}

export async function lireSupportAdmin(db) {
  const { rows } = await db.query('SELECT * FROM contact_support WHERE id')
  return versApi(rows[0])
}

// Contact visible par tous : seulement le numéro publié.
export async function lireSupportPublic(db) {
  const { rows } = await db.query('SELECT whatsapp_publie FROM contact_support WHERE id')
  return { whatsapp: rows[0]?.whatsapp_publie ?? null }
}

// Enregistre le numéro sans le publier : le numéro déjà publié reste visible tel quel.
export async function enregistrerWhatsapp(db, { whatsapp, adminId, maintenant }) {
  const { rows } = await db.query(
    `INSERT INTO contact_support (id, whatsapp, modifie_par, modifie_le) VALUES (TRUE, $1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET whatsapp = $1, modifie_par = $2, modifie_le = $3
     RETURNING *`,
    [whatsapp, adminId, maintenant],
  )
  return versApi(rows[0])
}

export async function publierWhatsapp(db, { adminId, maintenant }) {
  const { rows } = await db.query(
    `UPDATE contact_support SET whatsapp_publie = whatsapp, publie_par = $1, publie_le = $2
      WHERE id AND whatsapp IS NOT NULL RETURNING *`,
    [adminId, maintenant],
  )
  if (!rows.length) {
    throw new ErreurHttp(409, 'rien_a_publier', { message: 'Enregistrez d’abord un numéro WhatsApp.' })
  }
  return versApi(rows[0])
}

// Retire le numéro de l'app et du site ; il reste enregistré pour être republié.
export async function retirerWhatsapp(db, { adminId, maintenant }) {
  const { rows } = await db.query(
    `UPDATE contact_support SET whatsapp_publie = NULL, publie_par = $1, publie_le = $2
      WHERE id RETURNING *`,
    [adminId, maintenant],
  )
  return versApi(rows[0])
}
