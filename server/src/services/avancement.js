import { introuvable } from '../lib/erreurs.js'
import { ajouterJours, ecartJours, jourBenin } from '../lib/temps.js'
import { jourCampagne } from './campagnes.js'

// Nombre de testeurs que Google exige pendant 14 jours continus.
export const TESTEURS_EXIGES_GOOGLE = 12
// Au plus ce nombre de rapports dans la réponse (une campagne pleine en compte 15 × 16 = 240).
export const RAPPORTS_MAX = 300

// US-21 : avancement de la campagne au jour le jour pour le développeur (docs/api-sprint4.md §1).
// Les testeurs restent anonymes (numéro, ville, téléphone) ; la position des rapports n'est jamais montrée.
export async function lireAvancement(db, { appId, developpeurId, maintenant }) {
  const { rows: campagnes } = await db.query(
    `SELECT c.*, ap.fonctionnalites FROM campagnes c JOIN apps ap ON ap.id = c.app_id
      WHERE c.app_id = $1 AND c.developpeur_id = $2 ORDER BY c.demarree_le DESC, c.id DESC LIMIT 1`,
    [appId, developpeurId],
  )
  const c = campagnes[0]
  if (!c) throw introuvable('Campagne introuvable.')

  const aujourdhui = jourBenin(maintenant)
  const premierJour = jourBenin(c.demarree_le)
  const dernierJour = c.terminee_le ? jourBenin(c.terminee_le) : aujourdhui
  const hier = ajouterJours(aujourdhui, -1)

  const { rows: membres } = await db.query(
    `SELECT a.id, a.statut, a.jours_valides, a.inscription_confirmee_le, a.installation_confirmee_le,
            p.ville, ap.modele, ap.version_android,
            (SELECT max(r.jour)::text FROM rapports r WHERE r.affectation_id = a.id) AS dernier_rapport,
            EXISTS (SELECT 1 FROM rapports r WHERE r.affectation_id = a.id AND r.jour IN ($2::date, $3::date))
              OR EXISTS (SELECT 1 FROM usages_quotidiens u WHERE u.affectation_id = a.id AND u.jour IN ($2::date, $3::date) AND u.secondes > 0)
              AS activite_recente
       FROM affectations a
       JOIN profils_testeurs p ON p.utilisateur_id = a.testeur_id
       LEFT JOIN LATERAL (
         SELECT modele, version_android FROM appareils WHERE utilisateur_id = a.testeur_id ORDER BY derniere_vue_le DESC, id DESC LIMIT 1
       ) ap ON true
      WHERE a.campagne_id = $1
      ORDER BY a.id`,
    [c.id, aujourdhui, hier],
  )
  // Même numérotation que la liste des testeurs de la campagne (§1.1 du Sprint 3).
  const actifs = membres.filter((m) => m.statut !== 'remplacee')
  const numeros = new Map(actifs.map((m, i) => [String(m.id), i + 1]))
  const installes = actifs.filter((m) => m.installation_confirmee_le)

  const testeurs = actifs.map((m) => ({
    numero: numeros.get(String(m.id)),
    ville: m.ville,
    modele: m.modele ?? null,
    versionAndroid: m.version_android ?? null,
    inscriptionConfirmee: Boolean(m.inscription_confirmee_le),
    installationConfirmee: Boolean(m.installation_confirmee_le),
    joursValides: m.jours_valides,
    joursAcquis: m.jours_valides >= c.jours_exiges,
    dernierRapport: m.dernier_rapport,
    // Installé, avec un rapport ou du temps dans l'app aujourd'hui ou hier.
    actif: Boolean(m.installation_confirmee_le) && m.activite_recente,
  }))

  const { rows: jours } = await db.query(
    `SELECT j::date::text AS jour,
            COALESCE((SELECT sum(u.secondes) FROM usages_quotidiens u JOIN affectations a ON a.id = u.affectation_id
                       WHERE a.campagne_id = $1 AND u.jour = j::date), 0)::int AS secondes,
            (SELECT count(*) FROM usages_quotidiens u JOIN affectations a ON a.id = u.affectation_id
              WHERE a.campagne_id = $1 AND u.jour = j::date AND u.secondes > 0)::int AS testeurs_usage,
            (SELECT count(*) FROM rapports r JOIN affectations a ON a.id = r.affectation_id
              WHERE a.campagne_id = $1 AND r.jour = j::date)::int AS rapports,
            (SELECT count(*) FILTER (WHERE jr.valide) FROM journees jr JOIN affectations a ON a.id = jr.affectation_id
              WHERE a.campagne_id = $1 AND jr.jour = j::date)::int AS valides,
            EXISTS (SELECT 1 FROM verifications_quotidiennes v WHERE v.jour = j::date) AS verifie
       FROM generate_series($2::date, $3::date, interval '1 day') AS j
      ORDER BY j`,
    [c.id, premierJour, dernierJour],
  )
  const parJour = jours.map((j) => ({
    jour: j.jour,
    numero: ecartJours(premierJour, j.jour) + 1,
    tempsSecondes: j.secondes,
    testeursAvecUsage: j.testeurs_usage,
    rapports: j.rapports,
    // null tant que la vérification de la nuit n'est pas passée sur ce jour.
    testeursValides: j.verifie ? j.valides : null,
  }))

  const { rows: lignesRapports } = await db.query(
    `SELECT r.id, r.affectation_id, r.jour::text AS jour, r.actions, r.note, r.bug, r.commentaire_bug, r.fonctionnalites,
            r.version_app, r.retour_detaille, r.recu_le, p.ville
       FROM rapports r
       JOIN affectations a ON a.id = r.affectation_id
       JOIN profils_testeurs p ON p.utilisateur_id = r.testeur_id
      WHERE a.campagne_id = $1
      ORDER BY r.recu_le DESC, r.id DESC
      LIMIT $2`,
    [c.id, RAPPORTS_MAX],
  )
  const rapports = lignesRapports.map((r) => ({
    id: String(r.id),
    jour: r.jour,
    jourCampagne: ecartJours(premierJour, r.jour) + 1,
    // null : le testeur a été remplacé depuis.
    testeur: numeros.get(String(r.affectation_id)) ?? null,
    ville: r.ville,
    actions: r.actions,
    note: r.note,
    bug: r.bug,
    commentaireBug: r.commentaire_bug,
    fonctionnalites: r.fonctionnalites,
    versionApp: r.version_app,
    retourDetaille: r.retour_detaille,
    recuLe: r.recu_le.toISOString(),
  }))

  // Couverture : part des testeurs installés qui ont utilisé chaque fonctionnalité au moins une fois.
  const { rows: usagesFonctions } = await db.query(
    `SELECT f AS fonctionnalite, count(DISTINCT r.affectation_id)::int AS testeurs, count(*)::int AS rapports
       FROM rapports r JOIN affectations a ON a.id = r.affectation_id, unnest(r.fonctionnalites) AS f
      WHERE a.campagne_id = $1 AND a.statut <> 'remplacee'
      GROUP BY f`,
    [c.id],
  )
  const parFonction = new Map(usagesFonctions.map((u) => [u.fonctionnalite, u]))
  const couverture = c.fonctionnalites.map((f) => {
    const u = parFonction.get(f)
    return {
      fonctionnalite: f,
      testeurs: u?.testeurs ?? 0,
      rapports: u?.rapports ?? 0,
      part: installes.length ? Math.round(((u?.testeurs ?? 0) / installes.length) * 100) / 100 : 0,
    }
  })

  // Modèles et versions d'Android des testeurs actifs, du plus courant au plus rare.
  const groupes = new Map()
  for (const t of testeurs) {
    const cle = `${t.modele ?? ''}\u0000${t.versionAndroid ?? ''}`
    const g = groupes.get(cle) ?? { modele: t.modele, versionAndroid: t.versionAndroid, testeurs: 0 }
    g.testeurs++
    groupes.set(cle, g)
  }
  const appareils = [...groupes.values()].sort(
    (a, b) => b.testeurs - a.testeurs || String(a.modele).localeCompare(String(b.modele)) || String(a.versionAndroid).localeCompare(String(b.versionAndroid)),
  )

  const notes = lignesRapports.map((r) => r.note)
  return {
    campagneId: String(c.id),
    statut: c.statut,
    jour: jourCampagne(c.demarree_le, maintenant),
    joursExiges: c.jours_exiges,
    finPrevueLe: c.fin_prevue_le.toISOString(),
    objectif: estimerObjectif(installes.map((m) => m.jours_valides), c.jours_exiges, aujourdhui, c.statut),
    resume: {
      testeursActifs: testeurs.filter((t) => t.actif).length,
      installes: installes.length,
      tempsTotalSecondes: parJour.reduce((s, j) => s + j.tempsSecondes, 0),
      rapports: notes.length,
      noteMoyenne: notes.length ? Math.round((notes.reduce((s, n) => s + n, 0) / notes.length) * 10) / 10 : null,
      bugs: lignesRapports.filter((r) => r.bug).length,
    },
    testeurs,
    parJour,
    couverture,
    appareils,
    rapports,
  }
}

// Date à laquelle 12 testeurs auront leurs 14 jours, s'ils continuent chaque jour sans interruption.
// Le jour en cours compte s'il est réussi : 14 jours atteints à la fin du jour `aujourd'hui + reste - 1`.
export function estimerObjectif(joursValides, joursExiges, aujourdhui, statut = 'en_cours') {
  const tries = [...joursValides].sort((a, b) => b - a)
  const atteints = tries.filter((j) => j >= joursExiges).length
  if (atteints >= TESTEURS_EXIGES_GOOGLE) return { atteint: true, testeursAtteints: atteints, dateEstimee: null }
  if (tries.length < TESTEURS_EXIGES_GOOGLE || statut !== 'en_cours') {
    return { atteint: false, testeursAtteints: atteints, dateEstimee: null }
  }
  const reste = joursExiges - tries[TESTEURS_EXIGES_GOOGLE - 1]
  return { atteint: false, testeursAtteints: atteints, dateEstimee: ajouterJours(aujourdhui, reste - 1) }
}
