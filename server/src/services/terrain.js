import { ErreurHttp } from '../lib/erreurs.js'
import { estEntreeDeGamme, offre } from '../lib/offres.js'
import { JOUR_TERRAIN, TENUES } from '../lib/terrain.js'

// Questionnaire terrain de l'Offre Plus (US-37, docs/api-offres.md §4.5).

// État du questionnaire pour l'app Android : null hors Offre Plus.
export function etatTerrain(affectation, jour) {
  if (!offre(affectation.offre).questionnaireTerrain) return null
  const envoye = Boolean(affectation.terrain_envoye_le)
  return {
    envoye,
    ouvertLe: JOUR_TERRAIN,
    ouvert: !envoye && affectation.statut === 'active' && affectation.campagne_statut === 'en_cours' && jour >= JOUR_TERRAIN,
  }
}

export async function enregistrerRetourTerrain(db, { affectation, jour, valeurs, maintenant }) {
  const etat = etatTerrain(affectation, jour)
  if (!etat) {
    throw new ErreurHttp(403, 'offre_sans_questionnaire_terrain', { message: 'Le questionnaire terrain est réservé aux apps en Offre Plus.' })
  }
  if (etat.envoye) throw new ErreurHttp(409, 'deja_envoye', { message: 'Vous avez déjà répondu au questionnaire pour cette app.' })
  if (affectation.campagne_statut !== 'en_cours' || affectation.statut !== 'active') {
    throw new ErreurHttp(409, 'campagne_terminee', { message: 'La campagne de test est terminée.' })
  }
  if (jour < JOUR_TERRAIN) {
    throw new ErreurHttp(409, 'trop_tot', { message: `Le questionnaire s’ouvre au jour ${JOUR_TERRAIN}, après une semaine d’utilisation.`, ouvertLe: JOUR_TERRAIN })
  }
  const { rowCount } = await db.query(
    `INSERT INTO retours_terrain (affectation_id, campagne_id, testeur_id, connexion, reseau, telephone, langue, comprehension, commentaire, envoye_le)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (affectation_id) DO NOTHING`,
    [affectation.id, affectation.campagne_id, affectation.testeur_id, valeurs.connexion, valeurs.reseau, valeurs.telephone, valeurs.langue, valeurs.comprehension, valeurs.commentaire, maintenant],
  )
  if (!rowCount) throw new ErreurHttp(409, 'deja_envoye', { message: 'Vous avez déjà répondu au questionnaire pour cette app.' })
}

const compter = (lignes, cle) => Object.fromEntries(TENUES.map((t) => [t, lignes.filter((l) => l[cle] === t).length]))
const moyenne = (valeurs) => (valeurs.length ? Math.round((valeurs.reduce((s, v) => s + v, 0) / valeurs.length) * 10) / 10 : null)

// Section « test terrain » du rapport de fin : réseau lent, petits téléphones, compréhension de la langue.
export async function lireTerrain(db, campagneId) {
  const { rows } = await db.query(
    `SELECT r.*, ap.ram_mo FROM retours_terrain r
       LEFT JOIN LATERAL (
         SELECT ram_mo FROM appareils WHERE utilisateur_id = r.testeur_id ORDER BY derniere_vue_le DESC, id DESC LIMIT 1
       ) ap ON true
      WHERE r.campagne_id = $1 ORDER BY r.envoye_le, r.affectation_id`,
    [campagneId],
  )
  const petits = rows.filter((l) => estEntreeDeGamme(l.ram_mo))
  const groupes = (cle, ordre) =>
    ordre
      .map((valeur) => {
        const lignes = rows.filter((l) => l[cle] === valeur)
        return { [cle]: valeur, reponses: lignes.length, lignes }
      })
      .filter((g) => g.reponses)
  return {
    reponses: rows.length,
    reseau: compter(rows, 'reseau'),
    // Tenue de l'app selon la connexion utilisée, de la plus rapide à la plus lente.
    parConnexion: groupes('connexion', ['wifi', '4g', '3g', '2g']).map(({ lignes, ...g }) => ({ ...g, ...compter(lignes, 'reseau') })),
    telephone: compter(rows, 'telephone'),
    // Téléphones de 3 Go de RAM ou moins (US-35).
    petitsTelephones: { reponses: petits.length, ...compter(petits, 'telephone') },
    langues: groupes('langue', ['fr', 'en']).map(({ lignes, ...g }) => ({ ...g, comprehensionMoyenne: moyenne(lignes.map((l) => l.comprehension)) })),
    comprehensionMoyenne: moyenne(rows.map((l) => l.comprehension)),
    commentaires: rows.filter((l) => l.commentaire).map((l) => l.commentaire),
  }
}
