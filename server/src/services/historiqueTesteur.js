import { introuvable } from '../lib/erreurs.js'
import { jourBenin } from '../lib/temps.js'
import { niveauTesteur } from '../lib/niveaux.js'
import { LIBELLES_ALERTES } from './fraude.js'

// US-31 : fiche d'un testeur pour l'admin, pour trancher un litige (docs/fiche-testeur.md).
// Une campagne à la fois : jours (connexions, temps, rapport, validation), rapports et positions.

const iso = (d) => d?.toISOString() ?? null

export async function lireHistoriqueTesteur(db, { testeurId, affectationId = null, maintenant }) {
  const { rows: testeurs } = await db.query(
    `SELECT u.id, u.nom, u.telephone, u.statut, u.motif_sanction, u.cree_le, p.ville, p.gmail, p.numero_momo, p.operateur_momo,
            (SELECT count(*)::int FROM affectations a WHERE a.testeur_id = u.id AND a.statut = 'terminee') AS terminees,
            (SELECT count(*)::int FROM affectations a WHERE a.testeur_id = u.id AND a.statut = 'remplacee') AS remplacees,
            (SELECT COALESCE(sum(a.nombre_remises), 0)::int FROM affectations a WHERE a.testeur_id = u.id) AS remises,
            (SELECT count(*)::int FROM bugs b WHERE b.testeur_id = u.id AND b.statut = 'accepte') AS bugs_acceptes
       FROM utilisateurs u JOIN profils_testeurs p ON p.utilisateur_id = u.id
      WHERE u.id = $1 AND u.role = 'testeur'`,
    [testeurId],
  )
  const t = testeurs[0]
  if (!t) throw introuvable('Testeur introuvable.')

  const { rows: affectations } = await db.query(
    `SELECT a.id, a.statut, a.affecte_le, a.inscription_confirmee_le, a.jours_valides, a.motif_remplacement,
            c.id AS campagne_id, c.statut AS campagne_statut, c.demarree_le, c.fin_prevue_le, c.terminee_le, c.jours_exiges,
            ap.nom AS app_nom
       FROM affectations a JOIN campagnes c ON c.id = a.campagne_id JOIN apps ap ON ap.id = a.app_id
      WHERE a.testeur_id = $1 ORDER BY a.affecte_le DESC, a.id DESC`,
    [testeurId],
  )
  const choisie = affectationId ? affectations.find((a) => String(a.id) === String(affectationId)) : affectations[0]
  if (affectationId && !choisie) throw introuvable('Campagne introuvable pour ce testeur.')

  const { rows: alertes } = await db.query(
    `SELECT id, code, statut, detail, creee_le FROM alertes_fraude WHERE $1 = ANY(testeur_ids) ORDER BY creee_le DESC, id DESC LIMIT 50`,
    [testeurId],
  )

  let jours = []
  let rapports = []
  if (choisie) {
    const debut = jourBenin(choisie.affecte_le)
    const finCampagne = choisie.terminee_le ?? choisie.fin_prevue_le
    const fin = jourBenin(finCampagne < maintenant ? finCampagne : maintenant)
    const { rows } = await db.query(
      `SELECT to_char(j.jour, 'YYYY-MM-DD') AS jour, cc.premiere_le, cc.derniere_le, cc.nombre, u.secondes,
              r.id IS NOT NULL AS rapport, jo.valide, jo.usage_secondes
         FROM generate_series($2::date, GREATEST($2::date, $3::date), interval '1 day') AS j(jour)
         LEFT JOIN connexions_compagnon cc ON cc.testeur_id = $4 AND cc.jour = j.jour::date
         LEFT JOIN usages_quotidiens u ON u.affectation_id = $1 AND u.jour = j.jour::date
         LEFT JOIN rapports r ON r.affectation_id = $1 AND r.jour = j.jour::date
         LEFT JOIN journees jo ON jo.affectation_id = $1 AND jo.jour = j.jour::date
        ORDER BY j.jour`,
      [choisie.id, debut, fin, testeurId],
    )
    jours = rows.map((l) => ({
      jour: l.jour,
      connexion: l.premiere_le ? { premiere: iso(l.premiere_le), derniere: iso(l.derniere_le), nombre: l.nombre } : null,
      usageSecondes: l.usage_secondes ?? l.secondes ?? 0,
      rapport: l.rapport,
      // null tant que la vérification de la nuit n'est pas passée.
      valide: l.valide ?? null,
    }))
    const { rows: liste } = await db.query(
      `SELECT to_char(jour, 'YYYY-MM-DD') AS jour, actions, note, bug, commentaire_bug, fonctionnalites, version_app, latitude, longitude, retour_detaille, recu_le
         FROM rapports WHERE affectation_id = $1 ORDER BY jour DESC`,
      [choisie.id],
    )
    rapports = liste.map((r) => ({
      jour: r.jour,
      actions: r.actions,
      note: r.note,
      bug: r.bug ? r.commentaire_bug : null,
      fonctionnalites: r.fonctionnalites,
      versionApp: r.version_app,
      position: { latitude: Number(r.latitude), longitude: Number(r.longitude) },
      retourDetaille: r.retour_detaille,
      recuLe: iso(r.recu_le),
    }))
  }

  return {
    testeur: {
      id: String(t.id),
      nom: t.nom,
      telephone: t.telephone,
      statut: t.statut,
      motifSanction: t.motif_sanction,
      ville: t.ville,
      gmail: t.gmail,
      numeroMomo: t.numero_momo,
      operateurMomo: t.operateur_momo,
      inscritLe: iso(t.cree_le),
      niveau: niveauTesteur({ terminees: t.terminees, remplacees: t.remplacees, remises: t.remises, bugsAcceptes: t.bugs_acceptes }),
    },
    affectations: affectations.map((a) => ({
      id: String(a.id),
      campagneId: String(a.campagne_id),
      app: a.app_nom,
      statut: a.statut,
      campagneStatut: a.campagne_statut,
      affecteLe: iso(a.affecte_le),
      inscritLe: iso(a.inscription_confirmee_le),
      joursValides: a.jours_valides,
      joursExiges: a.jours_exiges,
      motifRemplacement: a.motif_remplacement,
    })),
    affectation: choisie ? String(choisie.id) : null,
    jours,
    rapports,
    alertes: alertes.map((a) => ({ id: String(a.id), libelle: LIBELLES_ALERTES[a.code] ?? a.code, statut: a.statut, detail: a.detail, creeLe: iso(a.creee_le) })),
  }
}
