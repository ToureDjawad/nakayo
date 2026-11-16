import { ErreurHttp, introuvable } from '../lib/erreurs.js'
import { jourCampagne } from './campagnes.js'

// US-44 : nouvelle version annoncée aux testeurs pendant le test (docs/nouvelle-version.md).

export function validerVersion({ numero, changements }) {
  return {
    numero: !numero ? 'requis' : numero.length > 50 ? 'trop_long' : null,
    changements: !changements ? 'requis' : changements.length < 10 ? 'trop_court' : changements.length > 1000 ? 'trop_long' : null,
  }
}

// Versions d'une campagne, avec le nombre de testeurs qui ont envoyé un rapport sur chacune.
export async function lireVersions(db, campagne) {
  const { rows } = await db.query(
    `SELECT v.*, (SELECT count(DISTINCT r.testeur_id)::int FROM rapports r JOIN affectations a ON a.id = r.affectation_id
                   WHERE a.campagne_id = v.campagne_id AND r.version_app = v.numero) AS testeurs_sur_version
       FROM versions_campagne v WHERE v.campagne_id = $1 ORDER BY v.annoncee_le, v.id`,
    [campagne.id],
  )
  return rows.map((v) => ({
    numero: v.numero,
    changements: v.changements,
    annonceeLe: v.annoncee_le.toISOString(),
    jourCampagne: jourCampagne(campagne.demarree_le, v.annoncee_le),
    testeursSurVersion: v.testeurs_sur_version,
  }))
}

export async function campagneDeLApp(db, { appId, developpeurId }) {
  const { rows } = await db.query(
    `SELECT c.*, ap.nom AS app_nom FROM campagnes c JOIN apps ap ON ap.id = c.app_id
      WHERE c.app_id = $1 AND c.developpeur_id = $2 ORDER BY c.demarree_le DESC, c.id DESC LIMIT 1`,
    [appId, developpeurId],
  )
  if (!rows.length) throw introuvable('Campagne introuvable.')
  return rows[0]
}

export async function annoncerVersion(client, { campagne, numero, changements, maintenant }) {
  if (campagne.statut !== 'en_cours') throw new ErreurHttp(409, 'statut_incompatible', { message: 'Une version s’annonce pendant le test.', statut: campagne.statut })
  const { rowCount } = await client.query(
    `INSERT INTO versions_campagne (campagne_id, numero, changements, annoncee_le) VALUES ($1, $2, $3, $4) ON CONFLICT (campagne_id, numero) DO NOTHING`,
    [campagne.id, numero, changements, maintenant],
  )
  if (!rowCount) throw new ErreurHttp(409, 'conflit', { message: 'Cette version est déjà annoncée.', champs: { numero: 'deja_utilise' } })
}

// Testeurs actifs et inscrits de la campagne, à prévenir par SMS.
export async function telephonesInscrits(db, campagneId) {
  const { rows } = await db.query(
    `SELECT u.telephone FROM affectations a JOIN utilisateurs u ON u.id = a.testeur_id
      WHERE a.campagne_id = $1 AND a.statut = 'active' AND a.inscription_confirmee_le IS NOT NULL AND u.statut = 'valide' ORDER BY a.id`,
    [campagneId],
  )
  return rows.map((r) => r.telephone)
}

export const messageNouvelleVersion = (app, numero) =>
  `Nakayo : « ${app} » a une nouvelle version (${numero}). Mettez-la à jour depuis le Play Store, puis vérifiez les corrections dans l’app Nakayo.`
