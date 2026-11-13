import { JOURS_CAMPAGNE } from '../lib/affectation.js'
import { montantLisible, remuneration, TAUX_USD_FCFA } from '../lib/offres.js'
import { jourBenin } from '../lib/temps.js'
import { TESTEURS_EXIGES_GOOGLE } from './avancement.js'
import { jourCampagne } from './campagnes.js'
import { listerVersementsAdmin } from './versements.js'

// US-24 : tableau de bord global de l'admin (docs/api-sprint4.md §5). Montants en FCFA :
// les paiements par carte (centimes de dollar) sont convertis au taux du modèle économique.

export const enFcfa = (montant, devise) => (devise === 'USD' ? Math.round((montant / 100) * TAUX_USD_FCFA) : montant)
const lisible = (montant) => montantLisible(montant, 'XOF')

// Une campagne en cours est « en retard » quand moins de 12 testeurs peuvent encore atteindre
// 14 jours avant la clôture, même en ne manquant plus aucun jour (le jour en cours compris).
export function enBonneVoie(joursValides, joursExiges, joursRestants) {
  return joursValides.filter((j) => j + joursRestants >= joursExiges).length
}

export async function lireTableauDeBord(db, { maintenant }) {
  const aujourdhui = jourBenin(maintenant)

  const { rows: statuts } = await db.query('SELECT statut, count(*)::int AS n FROM campagnes GROUP BY statut')
  const compte = Object.fromEntries(statuts.map((s) => [s.statut, s.n]))
  // US-36 : réponses de Google indiquées par les développeurs, pour mesurer le taux de réussite.
  const { rows: decisions } = await db.query(
    `SELECT count(*) FILTER (WHERE decision_google = 'acceptee')::int AS acceptees,
            count(*) FILTER (WHERE decision_google = 'refusee')::int AS refusees FROM campagnes`,
  )
  const { acceptees, refusees } = decisions[0]

  const { rows: enCours } = await db.query(
    `SELECT c.id, c.demarree_le, c.jours_exiges, ap.nom AS app_nom,
            COALESCE(array_agg(a.jours_valides) FILTER (WHERE a.statut = 'active' AND a.installation_confirmee_le IS NOT NULL), '{}') AS jours
       FROM campagnes c JOIN apps ap ON ap.id = c.app_id LEFT JOIN affectations a ON a.campagne_id = c.id
      WHERE c.statut = 'en_cours'
      GROUP BY c.id, ap.nom ORDER BY c.demarree_le, c.id`,
  )
  const enRetard = enCours
    .map((c) => {
      const jour = jourCampagne(c.demarree_le, maintenant)
      // Jours encore possibles : du jour en cours au dernier jour de la campagne.
      const joursRestants = Math.max(JOURS_CAMPAGNE - jour + 1, 0)
      return { campagneId: String(c.id), appNom: c.app_nom, jour, testeursEnBonneVoie: enBonneVoie(c.jours, c.jours_exiges, joursRestants) }
    })
    .filter((c) => c.testeursEnBonneVoie < TESTEURS_EXIGES_GOOGLE)

  const { rows: testeurs } = await db.query(
    `SELECT
       (SELECT count(*)::int FROM utilisateurs WHERE role = 'testeur' AND statut = 'valide') AS valides,
       (SELECT count(DISTINCT a.testeur_id)::int FROM affectations a JOIN campagnes c ON c.id = a.campagne_id
         WHERE a.statut = 'active' AND c.statut = 'en_cours' AND a.installation_confirmee_le IS NOT NULL) AS actifs,
       (SELECT count(*)::int FROM affectations) AS affectations,
       (SELECT count(*)::int FROM affectations WHERE statut = 'remplacee') AS remplaces,
       (SELECT count(*)::int FROM affectations WHERE nombre_remises > 0) AS avec_remise`,
  )
  const t = testeurs[0]

  // Par campagne : ce que le développeur a payé, ce qui est versé et dû aux testeurs.
  const { rows: apps } = await db.query(
    `SELECT c.id, c.statut, c.testeurs_vises, c.demarree_le, ap.nom AS app_nom, ap.offre, u.nom AS dev_nom,
            (SELECT json_agg(json_build_object('montant', p.montant, 'devise', p.devise)) FROM paiements p
              WHERE p.app_id = c.app_id AND p.statut = 'reussi') AS paiements,
            COALESCE((SELECT sum(v.montant) FROM versements v WHERE v.campagne_id = c.id AND v.statut = 'verse'), 0)::int AS verses,
            COALESCE((SELECT sum(v.montant) FROM versements v WHERE v.campagne_id = c.id AND v.statut <> 'verse'), 0)::int AS dus
       FROM campagnes c JOIN apps ap ON ap.id = c.app_id JOIN utilisateurs u ON u.id = c.developpeur_id
      ORDER BY c.demarree_le DESC, c.id DESC`,
  )
  const parApp = apps.map((a) => {
    const encaisse = (a.paiements ?? []).reduce((s, p) => s + enFcfa(p.montant, p.devise), 0)
    // Campagne en cours : on compte le pire cas (tous les testeurs visés payés).
    const definitive = a.statut !== 'en_cours'
    const coutTesteurs = definitive ? a.verses + a.dus : a.testeurs_vises * remuneration(a.offre).montant
    return {
      campagneId: String(a.id),
      appNom: a.app_nom,
      offre: a.offre,
      developpeur: a.dev_nom,
      statut: a.statut,
      demarreeLe: a.demarree_le.toISOString(),
      encaisse,
      versesTesteurs: a.verses,
      dusTesteurs: a.dus,
      marge: encaisse - coutTesteurs,
      margeDefinitive: definitive,
    }
  })

  // Chiffre d'affaires : tous les paiements réussis, même ceux d'apps pas encore lancées.
  const { rows: ca } = await db.query(`SELECT montant, devise FROM paiements WHERE statut = 'reussi'`)
  const chiffreAffaires = ca.reduce((s, p) => s + enFcfa(p.montant, p.devise), 0)
  const { rows: v } = await db.query(
    `SELECT COALESCE(sum(montant) FILTER (WHERE statut = 'verse'), 0)::int AS verses,
            COALESCE(sum(montant) FILTER (WHERE statut <> 'verse'), 0)::int AS dus,
            count(*) FILTER (WHERE statut = 'echoue')::int AS echoues
       FROM versements`,
  )
  const cout = v[0].verses + v[0].dus
  const versementsEchoues = await listerVersementsAdmin(db, { statut: 'echoue' })

  return {
    aujourdhui,
    campagnes: {
      enCours: compte.en_cours ?? 0,
      terminees: compte.terminee ?? 0,
      annulees: compte.annulee ?? 0,
      enRetard: enRetard.length,
      retards: enRetard,
      decisionsGoogle: { acceptees, refusees, tauxReussite: acceptees + refusees ? acceptees / (acceptees + refusees) : null },
    },
    testeurs: {
      valides: t.valides,
      actifs: t.actifs,
      affectations: t.affectations,
      remplaces: t.remplaces,
      tauxAbandon: t.affectations ? t.remplaces / t.affectations : 0,
      avecRemise: t.avec_remise,
    },
    finances: {
      devise: 'XOF',
      tauxUsdFcfa: TAUX_USD_FCFA,
      chiffreAffaires,
      chiffreAffairesLisible: lisible(chiffreAffaires),
      versesTesteurs: v[0].verses,
      versesTesteursLisible: lisible(v[0].verses),
      dusTesteurs: v[0].dus,
      dusTesteursLisible: lisible(v[0].dus),
      // Marge réalisée : encaissé moins ce qui est versé ou dû aux testeurs (hors frais des fournisseurs).
      marge: chiffreAffaires - cout,
      margeLisible: lisible(chiffreAffaires - cout),
      parApp,
    },
    versementsEchoues,
    nombreVersementsEchoues: v[0].echoues,
  }
}

