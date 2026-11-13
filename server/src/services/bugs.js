import { ErreurHttp } from '../lib/erreurs.js'
import { offre } from '../lib/offres.js'

// Rapports de bugs des testeurs (US-33, docs/api-bugs.md).

export const offreSansRapportsDeBugs = () =>
  new ErreurHttp(403, 'offre_sans_rapports_de_bugs', {
    message: 'Les rapports de bugs avec captures sont réservés aux apps en Offre Pro ou Lancement Afrique.',
  })

// `affectation` : ligne de lireAffectationTesteur (avec l'offre de l'app).
export function exigerRapportsDeBugs(affectation) {
  if (!offre(affectation.offre).rapportsDeBugs) throw offreSansRapportsDeBugs()
}

export function versBugTesteur(b) {
  return {
    id: String(b.id),
    titre: b.titre,
    etapes: b.etapes,
    resultatAttendu: b.resultat_attendu,
    resultatObtenu: b.resultat_obtenu,
    gravite: b.gravite,
    versionApp: b.version_app,
    captures: b.captures.length,
    statut: b.statut,
    motifRefus: b.motif_refus,
    signaleLe: b.signale_le.toISOString(),
    decideLe: b.decide_le?.toISOString() ?? null,
  }
}

export async function enregistrerBug(db, { affectation, valeurs, captures, maintenant }) {
  const { rows } = await db.query(
    `INSERT INTO bugs (affectation_id, campagne_id, app_id, testeur_id, titre, etapes, resultat_attendu, resultat_obtenu,
                       gravite, version_app, captures, signale_le)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
    [
      affectation.id,
      affectation.campagne_id,
      affectation.app_id,
      affectation.testeur_id,
      valeurs.titre,
      valeurs.etapes,
      valeurs.resultatAttendu,
      valeurs.resultatObtenu,
      valeurs.gravite,
      valeurs.versionApp,
      captures,
      maintenant,
    ],
  )
  return rows[0]
}

export async function listerBugsTesteur(db, { affectation }) {
  const { rows } = await db.query('SELECT * FROM bugs WHERE affectation_id = $1 ORDER BY signale_le DESC, id DESC', [affectation.id])
  return rows.map(versBugTesteur)
}
