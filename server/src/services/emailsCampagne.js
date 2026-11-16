import { JOURS_REMPLACEMENT_MANUEL, SEUIL_ALERTE_INSCRITS } from '../lib/affectation.js'
import { ajouterJours, jourBenin } from '../lib/temps.js'
import { jourCampagne } from './campagnes.js'

// US-26 : emails au développeur aux étapes clés (docs/emails-campagne.md). Le démarrage
// (POST /api/apps/:id/campagne) et le rapport prêt au 14e jour (US-36) ont déjà leur email ;
// ici : rappels de nouvelle version à J5 et J10, point de mi-parcours à J7, et alerte quand
// moins de 13 testeurs sont actifs.

export const ETAPES = [
  { etape: 'rappel_version_j5', jour: 5 },
  { etape: 'mi_parcours', jour: 7 },
  { etape: 'rappel_version_j10', jour: 10 },
]

// Testeurs actifs d'une campagne au soir du jour `jourVerifie` : inscrits au test, et soit leurs
// jours sont acquis, soit ils ont validé au moins une des deux dernières journées vérifiées.
// Pendant les 2 premiers jours (inscription, installation), tout testeur inscrit compte.
export async function lireActivite(db, { campagneId, jourVerifie, jour }) {
  const { rows } = await db.query(
    `SELECT a.id, a.testeur_id, a.affecte_le, a.inscription_confirmee_le IS NOT NULL AS inscrit,
            a.jours_valides >= c.jours_exiges AS acquis,
            EXISTS (SELECT 1 FROM journees j WHERE j.affectation_id = a.id AND j.valide AND j.jour IN ($2::date, $2::date - 1)) AS recent
       FROM affectations a JOIN campagnes c ON c.id = a.campagne_id
      WHERE a.campagne_id = $1 AND a.statut = 'active'
      ORDER BY a.id`,
    [campagneId, jourVerifie],
  )
  const debut = jour <= JOURS_REMPLACEMENT_MANUEL
  return rows.map((a) => ({ ...a, actif: a.inscrit && (debut || a.acquis || a.recent) }))
}

export async function envoyerEmailsCampagnes({ pool, emails, config, journal }, { maintenant }) {
  if (!emails) return 0
  const clientUrl = config?.clientUrl ?? ''
  const jourVerifie = ajouterJours(jourBenin(maintenant), -1)
  const { rows: campagnes } = await pool.query(
    `SELECT c.id, c.app_id, c.demarree_le, c.jours_exiges, ap.nom, u.email,
            ARRAY(SELECT etape FROM emails_campagnes e WHERE e.campagne_id = c.id) AS envoyes
       FROM campagnes c JOIN apps ap ON ap.id = c.app_id JOIN utilisateurs u ON u.id = c.developpeur_id
      WHERE c.statut = 'en_cours'
      ORDER BY c.id`,
  )
  let envoyes = 0
  for (const c of campagnes) {
    const jour = jourCampagne(c.demarree_le, maintenant)
    const activite = await lireActivite(pool, { campagneId: c.id, jourVerifie, jour })
    const actifs = activite.filter((a) => a.actif).length
    const lien = `${clientUrl}/mon-compte/apps/${c.app_id}/campagne`
    const contexte = { email: c.email, appNom: c.nom, jour, actifs, total: activite.length, joursExiges: c.jours_exiges, lien }
    const aEnvoyer = ETAPES.filter((e) => jour >= e.jour && !c.envoyes.includes(e.etape))
      // Une campagne rattrapée en retard n'envoie que l'étape la plus récente.
      .slice(-1)
      .map((e) => ({ etape: e.etape, message: MESSAGES[e.etape](contexte) }))

    // L'alerte suit le premier jour d'inscription (comme l'alerte du site) ; elle repart quand la
    // campagne retrouve 13 testeurs actifs.
    if (jour >= 2 && actifs < SEUIL_ALERTE_INSCRITS && !c.envoyes.includes('testeurs_actifs')) {
      aEnvoyer.push({ etape: 'testeurs_actifs', message: messageTesteursActifs(contexte) })
    } else if (actifs >= SEUIL_ALERTE_INSCRITS && c.envoyes.includes('testeurs_actifs')) {
      await pool.query(`DELETE FROM emails_campagnes WHERE campagne_id = $1 AND etape = 'testeurs_actifs'`, [c.id])
    }

    for (const { etape, message } of aEnvoyer) {
      const { rowCount } = await pool.query(
        'INSERT INTO emails_campagnes (campagne_id, etape, envoye_le) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [c.id, etape, maintenant],
      )
      if (!rowCount) continue
      try {
        await emails.envoyer(message)
        envoyes++
      } catch (erreur) {
        journal.error(erreur)
      }
    }
    // Les rappels de version rattrapés en même temps qu'une étape plus récente sont marqués envoyés.
    for (const e of ETAPES.filter((e) => jour >= e.jour && !c.envoyes.includes(e.etape))) {
      await pool.query('INSERT INTO emails_campagnes (campagne_id, etape, envoye_le) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [c.id, e.etape, maintenant])
    }
  }
  return envoyes
}

const signature = ['', 'L’équipe Nakayo']

function rappelVersion({ email, appNom, jour, lien }) {
  return {
    a: email,
    sujet: `« ${appNom} » : publiez une nouvelle version avec vos corrections`,
    texte: [
      'Bonjour,',
      '',
      `Votre campagne en est au jour ${jour}. Google attend des changements faits à partir des retours des testeurs : un test fermé sans aucune mise à jour est une cause de refus fréquente.`,
      'Corrigez les problèmes signalés puis publiez une nouvelle version sur votre piste de test fermé. Vos testeurs la recevront par le Play Store.',
      '',
      `Les retours de vos testeurs : ${lien}`,
      ...signature,
    ].join('\n'),
  }
}

const MESSAGES = {
  rappel_version_j5: rappelVersion,
  rappel_version_j10: rappelVersion,
  mi_parcours: ({ email, appNom, actifs, total, joursExiges, lien }) => ({
    a: email,
    sujet: `« ${appNom} » : la campagne est à mi-parcours`,
    texte: [
      'Bonjour,',
      '',
      `Votre campagne a passé son 7e jour sur ${joursExiges} exigés par Google.`,
      `${actifs} testeurs sur ${total} sont actifs : inscrits au test et présents ces deux derniers jours.`,
      '',
      'Gardez les testeurs inscrits jusqu’au bout : ne retirez ni le groupe ni la liste de votre test fermé.',
      '',
      `Suivre la campagne : ${lien}`,
      ...signature,
    ].join('\n'),
  }),
}

function messageTesteursActifs({ email, appNom, actifs, total, lien }) {
  return {
    a: email,
    sujet: `« ${appNom} » : moins de ${SEUIL_ALERTE_INSCRITS} testeurs actifs`,
    texte: [
      'Bonjour,',
      '',
      `Seuls ${actifs} testeurs sur ${total} sont actifs aujourd’hui sur votre campagne. Google exige 12 testeurs inscrits pendant 14 jours.`,
      'Notre équipe remplace les testeurs qui ne testent plus. De votre côté, vérifiez dans la Play Console que le groupe des testeurs est toujours dans votre test fermé et que le Bénin est coché.',
      '',
      `Suivre la campagne : ${lien}`,
      ...signature,
    ].join('\n'),
  }
}
