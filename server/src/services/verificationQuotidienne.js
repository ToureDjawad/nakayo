import { transaction } from '../routes/auth.js'
import { USAGE_MINIMUM_SECONDES } from '../lib/rapports.js'
import { ajouterJours, debutJourBenin, jourBenin } from '../lib/temps.js'

// Vérification de chaque nuit (US-20, docs/api-sprint3.md §3). Un jour est validé pour une
// affectation si le testeur a ouvert l'app compagnon, passé au moins 2 minutes dans l'app
// testée et envoyé son rapport. Sinon son compteur repart à 0 et il est prévenu par SMS.
// Le compteur sert au paiement du testeur : celui de Google ne dépend que de l'inscription.

const MANQUES = {
  connexion: 'ouvrir l’app Nakayo',
  usage: 'utiliser l’app 2 minutes',
  rapport: 'envoyer le rapport',
}

export function manquesDuJour({ connexion, usage_secondes: usage, rapport }) {
  return [!connexion && 'connexion', usage < USAGE_MINIMUM_SECONDES && 'usage', !rapport && 'rapport'].filter(Boolean)
}

export function messageRemise(nomApp, manques) {
  return (
    `Nakayo : votre compteur pour « ${nomApp} » repart à J1. Hier, il manquait : ${manques.map((m) => MANQUES[m]).join(', ')}. ` +
    'Restez inscrit au test : ne vous désinscrivez surtout pas.'
  )
}

// Vérifie un jour du Bénin (« AAAA-MM-JJ »). Rejouable : un jour déjà compté pour une
// affectation ne l'est pas deux fois.
export async function verifierJour({ pool, sms, journal }, { jour, maintenant }) {
  const finDuJour = debutJourBenin(ajouterJours(jour, 1))
  const { rows } = await pool.query(
    `SELECT a.id, a.jours_valides, c.jours_exiges, ap.nom AS app_nom, u.telephone,
            EXISTS (SELECT 1 FROM connexions_compagnon k WHERE k.testeur_id = a.testeur_id AND k.jour = $1) AS connexion,
            COALESCE((SELECT secondes FROM usages_quotidiens q WHERE q.affectation_id = a.id AND q.jour = $1), 0) AS usage_secondes,
            EXISTS (SELECT 1 FROM rapports r WHERE r.affectation_id = a.id AND r.jour = $1) AS rapport
       FROM affectations a
       JOIN campagnes c ON c.id = a.campagne_id
       JOIN apps ap ON ap.id = a.app_id
       JOIN utilisateurs u ON u.id = a.testeur_id
      WHERE a.statut = 'active' AND c.statut = 'en_cours' AND a.installation_confirmee_le < $2
        AND NOT EXISTS (SELECT 1 FROM journees j WHERE j.affectation_id = a.id AND j.jour = $1)
      ORDER BY a.id`,
    [jour, finDuJour],
  )

  let joursValides = 0
  const messages = []
  for (const ligne of rows) {
    const manques = manquesDuJour(ligne)
    const valide = manques.length === 0
    const compte = await transaction(pool, async (client) => {
      const { rowCount } = await client.query(
        `INSERT INTO journees (affectation_id, jour, connexion, usage_secondes, rapport, valide, verifie_le)
         VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING`,
        [ligne.id, jour, ligne.connexion, ligne.usage_secondes, ligne.rapport, valide, maintenant],
      )
      if (!rowCount) return null
      // Les 14 jours atteints sont acquis : ni nouveau jour compté, ni remise à zéro.
      if (ligne.jours_valides >= ligne.jours_exiges) return 'acquis'
      if (valide) {
        await client.query('UPDATE affectations SET jours_valides = jours_valides + 1 WHERE id = $1', [ligne.id])
        return 'valide'
      }
      // Un testeur encore à 0 (souvent le jour de son installation) n'a rien à perdre : pas de SMS.
      if (ligne.jours_valides === 0) return 'vide'
      await client.query(
        'UPDATE affectations SET jours_valides = 0, nombre_remises = nombre_remises + 1, derniere_remise_jour = $2 WHERE id = $1',
        [ligne.id, jour],
      )
      return 'remise'
    })
    if (compte === 'valide') joursValides++
    if (compte === 'remise' && ligne.telephone) messages.push({ a: ligne.telephone, texte: messageRemise(ligne.app_nom, manques) })
  }

  // Les campagnes arrivées au bout de leurs 16 jours se terminent avec leurs affectations.
  await transaction(pool, async (client) => {
    const { rows: finies } = await client.query(
      `UPDATE campagnes SET statut = 'terminee', terminee_le = $1 WHERE statut = 'en_cours' AND fin_prevue_le <= $1 RETURNING id`,
      [maintenant],
    )
    if (finies.length) {
      await client.query(`UPDATE affectations SET statut = 'terminee', terminee_le = $2 WHERE campagne_id = ANY($1) AND statut = 'active'`, [
        finies.map((c) => c.id),
        maintenant,
      ])
    }
  })

  const bilan = { jour, affectations: rows.length, joursValides, remises: messages.length }
  await pool.query(
    `INSERT INTO verifications_quotidiennes (jour, terminee_le, affectations, jours_valides, remises) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (jour) DO UPDATE SET terminee_le = $2,
       affectations = verifications_quotidiennes.affectations + $3,
       jours_valides = verifications_quotidiennes.jours_valides + $4,
       remises = verifications_quotidiennes.remises + $5`,
    [jour, maintenant, bilan.affectations, bilan.joursValides, bilan.remises],
  )
  for (const message of messages) {
    try {
      await sms.envoyer(message)
    } catch (erreur) {
      journal.error(erreur)
    }
  }
  return bilan
}

// Jours récents pas encore vérifiés (le serveur a pu être arrêté à minuit), du plus ancien au plus récent.
export async function joursEnRetard(pool, { maintenant, jusqua = 3 }) {
  const hier = ajouterJours(jourBenin(maintenant), -1)
  const candidats = Array.from({ length: jusqua }, (_, i) => ajouterJours(hier, -i)).reverse()
  const { rows } = await pool.query('SELECT jour::text AS jour FROM verifications_quotidiennes WHERE jour = ANY($1::date[])', [candidats])
  const faits = new Set(rows.map((r) => r.jour))
  return candidats.filter((j) => !faits.has(j))
}

// Lance la vérification 5 minutes après minuit (heure du Bénin), le temps que les derniers
// envois de la journée arrivent, et rattrape au démarrage les jours manqués.
export function demarrerVerificationNocturne(deps, { delaiMs = 5 * 60 * 1000 } = {}) {
  let minuteur = null
  let arrete = false

  async function rattraper() {
    try {
      for (const jour of await joursEnRetard(deps.pool, { maintenant: deps.maintenant() })) {
        const bilan = await verifierJour(deps, { jour, maintenant: deps.maintenant() })
        deps.journal.info(`[vérification] ${jour} : ${bilan.affectations} affectations, ${bilan.joursValides} jours validés, ${bilan.remises} remises à zéro`)
      }
    } catch (erreur) {
      deps.journal.error(erreur)
    }
  }

  function programmer() {
    if (arrete) return
    const maintenant = deps.maintenant()
    const prochaine = debutJourBenin(ajouterJours(jourBenin(maintenant), 1)).getTime() + delaiMs
    minuteur = setTimeout(async () => {
      await rattraper()
      programmer()
    }, prochaine - maintenant.getTime())
    minuteur.unref?.()
  }

  const premier = rattraper().then(programmer)
  return {
    premier,
    arreter() {
      arrete = true
      clearTimeout(minuteur)
    },
  }
}
