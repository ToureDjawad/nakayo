import { genererJeton, hacherJeton } from '../lib/jetons.js'
import { COLONNES_UTILISATEUR } from '../lib/utilisateurs.js'

export const DUREE_SESSION_MS = 30 * 24 * 60 * 60 * 1000
export const NOM_COOKIE = 'nakayo_session'

// Ouvre une session de 30 jours et renvoie le jeton à donner au client.
export async function ouvrirSession(db, { utilisateurId, client, maintenant }) {
  const jeton = genererJeton()
  await db.query(
    `INSERT INTO sessions (utilisateur_id, jeton_hash, client, cree_le, utilisee_le, expire_le)
     VALUES ($1, $2, $3, $4, $4, $5)`,
    [utilisateurId, hacherJeton(jeton), client, maintenant, new Date(maintenant.getTime() + DUREE_SESSION_MS)],
  )
  return { jeton, expireLe: new Date(maintenant.getTime() + DUREE_SESSION_MS) }
}

// Session valide (non révoquée, non expirée) et son utilisateur, ou null.
export async function lireSession(db, { jeton, maintenant }) {
  const { rows } = await db.query(
    `SELECT s.id AS session_id, s.client, ${COLONNES_UTILISATEUR}
       FROM sessions s JOIN utilisateurs u ON u.id = s.utilisateur_id
      WHERE s.jeton_hash = $1 AND s.revoquee_le IS NULL AND s.expire_le > $2`,
    [hacherJeton(jeton), maintenant],
  )
  if (!rows.length) return null
  const { session_id: sessionId, client, ...utilisateur } = rows[0]
  // Date de dernière utilisation, mise à jour au plus une fois par heure.
  await db.query(
    `UPDATE sessions SET utilisee_le = $2 WHERE id = $1 AND utilisee_le < $2::timestamptz - interval '1 hour'`,
    [sessionId, maintenant],
  )
  return { sessionId, client, utilisateur }
}

export async function revoquerSession(db, { sessionId, maintenant }) {
  await db.query('UPDATE sessions SET revoquee_le = $2 WHERE id = $1 AND revoquee_le IS NULL', [sessionId, maintenant])
}

export async function revoquerSessionsUtilisateur(db, { utilisateurId, maintenant }) {
  await db.query('UPDATE sessions SET revoquee_le = $2 WHERE utilisateur_id = $1 AND revoquee_le IS NULL', [
    utilisateurId,
    maintenant,
  ])
}
