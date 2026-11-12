import { ErreurHttp, introuvable } from '../lib/erreurs.js'

export const conflitPackage = () =>
  new ErreurHttp(409, 'conflit', { message: 'Ce package est déjà inscrit sur Nakayo.', champs: { package: 'deja_utilise' } })

const statutIncompatible = (statut) =>
  new ErreurHttp(409, 'statut_incompatible', { message: 'Seule une app en brouillon peut être modifiée ou supprimée.', statut })

// Objet `app` du contrat (docs/api-sprint2.md §1.1).
export function versAppApi(l) {
  return {
    id: String(l.id),
    nom: l.nom,
    package: l.package,
    lienTestFerme: l.lien_test_ferme,
    description: l.description,
    instructions: l.instructions,
    fonctionnalites: l.fonctionnalites,
    connexionRequise: l.connexion_requise,
    identifiantsTest: l.identifiants_test,
    comptePlay: l.compte_play,
    // Seuls les comptes personnels récents sont soumis aux 12 testeurs pendant 14 jours.
    testObligatoire: l.compte_play === 'personnel_recent',
    statut: l.statut,
    // Motif donné par l'équipe quand l'app est refusée (US-14).
    motifRefus: l.motif_refus ?? null,
    // Liste de vérification avant le lancement (US-42).
    preparation: {
      elements: l.preparation ?? [],
      complete: Boolean(l.preparation_complete_le),
      completeLe: l.preparation_complete_le?.toISOString() ?? null,
    },
    creeLe: l.cree_le.toISOString(),
    modifieLe: l.modifie_le.toISOString(),
  }
}

const COLONNES = ['nom', 'package', 'lien_test_ferme', 'description', 'instructions', 'fonctionnalites', 'connexion_requise', 'identifiants_test', 'compte_play']
const parametres = (v) => [v.nom, v.package, v.lienTestFerme, v.description, v.instructions, v.fonctionnalites, v.connexionRequise, v.identifiantsTest, v.comptePlay]

// Le package est unique (sans tenir compte de la casse) parmi les apps non refusées.
async function packagePris(db, pkg, saufId = null) {
  const { rows } = await db.query(
    `SELECT 1 FROM apps WHERE lower(package) = lower($1) AND statut <> 'refusee' AND id IS DISTINCT FROM $2::bigint`,
    [pkg, saufId],
  )
  return rows.length > 0
}

// Course entre deux soumissions du même package : l'index unique tranche.
function traduireConflit(erreur) {
  if (erreur.code === '23505' && erreur.constraint === 'apps_package_unique') throw conflitPackage()
  throw erreur
}

export async function creerApp(db, { developpeurId, valeurs, maintenant }) {
  if (await packagePris(db, valeurs.package)) throw conflitPackage()
  const { rows } = await db
    .query(
      `INSERT INTO apps (developpeur_id, ${COLONNES.join(', ')}, cree_le, modifie_le)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11) RETURNING *`,
      [developpeurId, ...parametres(valeurs), maintenant],
    )
    .catch(traduireConflit)
  return versAppApi(rows[0])
}

// Les apps du développeur, de la plus récente à la plus ancienne.
export async function listerAppsDeveloppeur(db, developpeurId) {
  const { rows } = await db.query('SELECT * FROM apps WHERE developpeur_id = $1 ORDER BY cree_le DESC, id DESC', [developpeurId])
  return rows.map(versAppApi)
}

// Une app du développeur ; celle d'un autre compte répond 404 comme une app inexistante.
export async function lireAppDeveloppeur(db, { id, developpeurId }) {
  const { rows } = await db.query('SELECT * FROM apps WHERE id = $1 AND developpeur_id = $2', [id, developpeurId])
  if (!rows.length) throw introuvable('App introuvable.')
  return rows[0]
}

export async function modifierApp(db, { id, developpeurId, valeurs, maintenant }) {
  const actuelle = await lireAppDeveloppeur(db, { id, developpeurId })
  if (actuelle.statut !== 'brouillon') throw statutIncompatible(actuelle.statut)
  if (await packagePris(db, valeurs.package, id)) throw conflitPackage()
  const affectations = COLONNES.map((c, i) => `${c} = $${i + 3}`).join(', ')
  const { rows } = await db
    .query(
      `UPDATE apps SET ${affectations}, modifie_le = $${COLONNES.length + 3}
        WHERE id = $1 AND developpeur_id = $2 AND statut = 'brouillon' RETURNING *`,
      [id, developpeurId, ...parametres(valeurs), maintenant],
    )
    .catch(traduireConflit)
  // L'app a quitté le brouillon entre la lecture et la mise à jour (paiement en parallèle).
  if (!rows.length) throw statutIncompatible((await lireAppDeveloppeur(db, { id, developpeurId })).statut)
  return versAppApi(rows[0])
}

export async function supprimerApp(db, { id, developpeurId }) {
  const { rowCount } = await db.query(`DELETE FROM apps WHERE id = $1 AND developpeur_id = $2 AND statut = 'brouillon'`, [id, developpeurId])
  if (!rowCount) throw statutIncompatible((await lireAppDeveloppeur(db, { id, developpeurId })).statut)
}

// US-42 : enregistre les points cochés ; la date « complète » est posée quand tout est coché.
export async function enregistrerPreparation(db, { id, developpeurId, elements, total, maintenant }) {
  const actuelle = await lireAppDeveloppeur(db, { id, developpeurId })
  if (!['en_verification', 'validee'].includes(actuelle.statut)) {
    throw new ErreurHttp(409, 'statut_incompatible', { message: 'La préparation commence une fois l’offre payée.', statut: actuelle.statut })
  }
  const complete = elements.length === total
  const { rows } = await db.query(
    `UPDATE apps SET preparation = $3,
        preparation_complete_le = CASE WHEN $4 THEN COALESCE(preparation_complete_le, $5) ELSE NULL END
      WHERE id = $1 AND developpeur_id = $2 RETURNING *`,
    [id, developpeurId, elements, complete, maintenant],
  )
  return versAppApi(rows[0])
}
