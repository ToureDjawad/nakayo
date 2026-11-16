import { JOURS_CAMPAGNE } from '../lib/affectation.js'
import { ErreurHttp, introuvable } from '../lib/erreurs.js'
import { offre } from '../lib/offres.js'
import { JOURS_RETOUR_DETAILLE, USAGE_MINIMUM_SECONDES } from '../lib/rapports.js'
import { ajouterJours, jourBenin } from '../lib/temps.js'
import { jourCampagne } from './campagnes.js'
import { manquesDuJour } from './verificationQuotidienne.js'
import { etatTerrain } from './terrain.js'

// Affectations du testeur avec ce qu'il lui faut pour le jour en cours ($2 : jour du Bénin).
const SELECT_AFFECTATION = `SELECT a.*, c.statut AS campagne_statut, c.demarree_le, c.jours_exiges,
    ap.nom, ap.package, ap.offre, ap.lien_test_ferme, ap.instructions, ap.fonctionnalites, ap.connexion_requise, ap.identifiants_test,
    r.id AS rapport_id, uq.secondes AS usage_secondes, rt.envoye_le AS terrain_envoye_le,
    a.derniere_remise_jour::text AS derniere_remise_jour_texte, jr.connexion AS remise_connexion, jr.usage_secondes AS remise_usage, jr.rapport AS remise_rapport,
    pt.gmail AS testeur_gmail, pt.gmail_principal_confirme_le
  FROM affectations a
  JOIN profils_testeurs pt ON pt.utilisateur_id = a.testeur_id
  JOIN campagnes c ON c.id = a.campagne_id
  JOIN apps ap ON ap.id = a.app_id
  LEFT JOIN rapports r ON r.affectation_id = a.id AND r.jour = $2
  LEFT JOIN usages_quotidiens uq ON uq.affectation_id = a.id AND uq.jour = $2
  LEFT JOIN retours_terrain rt ON rt.affectation_id = a.id
  LEFT JOIN journees jr ON jr.affectation_id = a.id AND jr.jour = a.derniere_remise_jour`

// Objet « app à tester » de l'app Android (docs/api-sprint3.md §2.1).
export function versAffectationTesteur(l, maintenant) {
  const jour = jourCampagne(l.demarree_le, maintenant)
  const rapportDuJour = Boolean(l.rapport_id)
  return {
    id: String(l.id),
    campagneId: String(l.campagne_id),
    app: {
      id: String(l.app_id),
      nom: l.nom,
      package: l.package,
      instructions: l.instructions,
      fonctionnalites: l.fonctionnalites,
      connexionRequise: l.connexion_requise,
      identifiantsTest: l.identifiants_test,
    },
    // Lien web d'inscription au test fermé (opt-in), puis fiche Play Store pour installer.
    lienInscription: l.lien_test_ferme,
    lienPlayStore: `https://play.google.com/store/apps/details?id=${encodeURIComponent(l.package)}`,
    jourCampagne: jour,
    joursCampagne: JOURS_CAMPAGNE,
    joursExiges: l.jours_exiges,
    joursValides: l.jours_valides,
    // Les 14 jours sont atteints : le testeur reste inscrit jusqu'à la fin de la campagne.
    joursAcquis: l.jours_valides >= l.jours_exiges,
    // US-20 : dernière remise à zéro du compteur et ce qui manquait ce jour-là.
    derniereRemise: l.derniere_remise_jour_texte
      ? {
          jour: l.derniere_remise_jour_texte,
          manquait: manquesDuJour({ connexion: l.remise_connexion, usage_secondes: l.remise_usage, rapport: l.remise_rapport }),
        }
      : null,
    inscriptionConfirmee: Boolean(l.inscription_confirmee_le),
    // US-07 : à la première campagne, le testeur confirme que son Gmail est le compte principal
    // du Play Store de ce téléphone (avec la capture d'inscription).
    gmailPrincipalAConfirmer: !l.gmail_principal_confirme_le,
    gmail: l.testeur_gmail,
    installationConfirmee: Boolean(l.installation_confirmee_le),
    rapportDuJour,
    retourDetailleAttendu: !rapportDuJour && JOURS_RETOUR_DETAILLE.includes(jour),
    usageDuJourSecondes: l.usage_secondes ?? 0,
    usageMinimumSecondes: USAGE_MINIMUM_SECONDES,
    // US-33 : rapports de bugs avec captures (offres Pro et Plus).
    rapportsDeBugs: offre(l.offre).rapportsDeBugs,
    // US-37 : questionnaire terrain (Offre Plus), ou null.
    questionnaireTerrain: etatTerrain(l, jour),
  }
}

const compteNonValide = () => new ErreurHttp(403, 'compte_non_valide', { message: 'Votre compte testeur n’est pas actif.' })

export function exigerTesteurValide(req, _res, next) {
  next(req.session.utilisateur.statut === 'valide' ? undefined : compteNonValide())
}

// Les apps en cours de test du testeur, de la plus ancienne affectation à la plus récente.
export async function listerAppsTesteur(db, { testeurId, maintenant }) {
  const { rows } = await db.query(
    `${SELECT_AFFECTATION} WHERE a.testeur_id = $1 AND a.statut = 'active' AND c.statut = 'en_cours' ORDER BY a.affecte_le, a.id`,
    [testeurId, jourBenin(maintenant)],
  )
  return rows.map((l) => versAffectationTesteur(l, maintenant))
}

// Une affectation active du testeur, dans une campagne en cours ; sinon 404.
export async function lireAffectationTesteur(db, { id, testeurId, maintenant }) {
  if (!/^\d{1,18}$/.test(String(id))) throw introuvable('App introuvable.')
  const { rows } = await db.query(
    `${SELECT_AFFECTATION} WHERE a.id = $1 AND a.testeur_id = $3 AND a.statut = 'active' AND c.statut = 'en_cours'`,
    [id, jourBenin(maintenant), testeurId],
  )
  if (!rows.length) throw introuvable('App introuvable.')
  return rows[0]
}

// US-17 / US-43 : le testeur confirme son inscription avec la capture de la page « Vous êtes testeur ».
// Une nouvelle capture remplace l'ancienne (son chemin est renvoyé pour la supprimer).
export async function confirmerInscription(db, { affectation, chemin, maintenant }) {
  await db.query(
    'UPDATE profils_testeurs SET gmail_principal_confirme_le = COALESCE(gmail_principal_confirme_le, $2) WHERE utilisateur_id = $1',
    [affectation.testeur_id, maintenant],
  )
  await db.query(
    `UPDATE affectations SET capture_inscription = $2, inscription_confirmee_le = COALESCE(inscription_confirmee_le, $3) WHERE id = $1`,
    [affectation.id, chemin, maintenant],
  )
  return affectation.capture_inscription
}

// US-18 : l'app testée doit venir du Play Store (pas d'un APK), après l'inscription au test.
export async function confirmerInstallation(db, { affectation, maintenant }) {
  if (!affectation.inscription_confirmee_le) {
    throw new ErreurHttp(409, 'inscription_requise', { message: 'Confirmez d’abord votre inscription au test.' })
  }
  await db.query('UPDATE affectations SET installation_confirmee_le = COALESCE(installation_confirmee_le, $2) WHERE id = $1', [affectation.id, maintenant])
}

// US-19 : un rapport par app et par jour du Bénin, compté au moment où le serveur le reçoit.
export async function enregistrerRapport(db, { affectation, testeurId, valeurs, maintenant }) {
  if (!affectation.installation_confirmee_le) {
    throw new ErreurHttp(409, 'installation_requise', { message: 'Installez l’app depuis le Play Store avant votre premier rapport.' })
  }
  try {
    await db.query(
      `INSERT INTO rapports (affectation_id, testeur_id, jour, actions, note, bug, commentaire_bug, fonctionnalites, version_app,
                             latitude, longitude, retour_detaille, recu_le)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        affectation.id,
        testeurId,
        jourBenin(maintenant),
        valeurs.actions,
        valeurs.note,
        valeurs.bug,
        valeurs.commentaireBug,
        valeurs.fonctionnalites,
        valeurs.versionApp,
        valeurs.position.latitude,
        valeurs.position.longitude,
        valeurs.retourDetaille,
        maintenant,
      ],
    )
  } catch (erreur) {
    if (erreur.code === '23505') {
      throw new ErreurHttp(409, 'rapport_deja_envoye', { message: 'Vous avez déjà envoyé le rapport du jour pour cette app.' })
    }
    throw erreur
  }
}

// US-18 : ouverture de l'app compagnon, horodatée par le serveur.
export async function enregistrerSignal(db, { testeurId, maintenant }) {
  await db.query(
    `INSERT INTO connexions_compagnon (testeur_id, jour, premiere_le, derniere_le) VALUES ($1, $2, $3, $3)
     ON CONFLICT (testeur_id, jour) DO UPDATE SET derniere_le = $3, nombre = connexions_compagnon.nombre + 1`,
    [testeurId, jourBenin(maintenant), maintenant],
  )
}

// US-18 : temps d'utilisation envoyé par l'app compagnon (cumul du jour, renvoyé tant que le
// réseau manque). Seuls comptent aujourd'hui et hier, pour une app en cours de test depuis ce jour.
// On garde le plus grand cumul reçu : un envoi en retard ne fait pas baisser le compteur.
export async function enregistrerUsages(db, { testeurId, usages, maintenant }) {
  const aujourdhui = jourBenin(maintenant)
  const jours = [aujourdhui, ajouterJours(aujourdhui, -1)]
  const { rows } = await db.query(
    `SELECT a.id, lower(ap.package) AS package, a.affecte_le FROM affectations a
       JOIN campagnes c ON c.id = a.campagne_id JOIN apps ap ON ap.id = a.app_id
      WHERE a.testeur_id = $1 AND a.statut = 'active' AND c.statut = 'en_cours'`,
    [testeurId],
  )
  const parPackage = new Map(rows.map((r) => [r.package, r]))
  let enregistres = 0
  for (const usage of usages) {
    const affectation = parPackage.get(usage.package.toLowerCase())
    if (!affectation || !jours.includes(usage.jour) || usage.jour < jourBenin(affectation.affecte_le)) continue
    // Un jour déjà vérifié cette nuit (US-20) ne change plus.
    const { rows: verifie } = await db.query('SELECT 1 FROM journees WHERE affectation_id = $1 AND jour = $2', [affectation.id, usage.jour])
    if (verifie.length) continue
    await db.query(
      `INSERT INTO usages_quotidiens (affectation_id, jour, secondes, maj_le) VALUES ($1, $2, $3, $4)
       ON CONFLICT (affectation_id, jour) DO UPDATE SET secondes = GREATEST(usages_quotidiens.secondes, $3), maj_le = $4`,
      [affectation.id, usage.jour, usage.secondes, maintenant],
    )
    enregistres++
  }
  return { enregistres, ignores: usages.length - enregistres }
}
