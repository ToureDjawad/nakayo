import { ajouterJours, debutJourBenin, jourBenin } from '../lib/temps.js'

// US-25 : SMS de secours à 22 h (heure du Bénin) au testeur dont un rapport du jour manque.
// L'app Android a déjà rappelé à 19 h et 21 h ; le SMS touche aussi les téléphones sans notification.

export const HEURE_RAPPEL_SMS = 22
const HEURE_MS = 60 * 60 * 1000

// « « A » », « « A » et « B » », « « A », « B » et « C » ».
export function listeApps(noms) {
  const entre = noms.map((n) => `« ${n} »`)
  return entre.length < 2 ? entre.join('') : `${entre.slice(0, -1).join(', ')} et ${entre.at(-1)}`
}

export function messageRappel(noms) {
  return noms.length === 1
    ? `Nakayo : il manque votre rapport du jour pour ${listeApps(noms)}. Envoyez-le avant minuit pour garder votre compteur.`
    : `Nakayo : il manque vos rapports du jour pour ${listeApps(noms)}. Envoyez-les avant minuit pour garder votre compteur.`
}

// Envoie les rappels du jour du Bénin `jour`. Rejouable : un testeur déjà prévenu ce soir ne l'est pas deux fois.
export async function envoyerRappelsSms({ pool, sms, journal }, { jour, maintenant }) {
  const { rows } = await pool.query(
    `SELECT u.id AS testeur_id, u.telephone, array_agg(ap.nom ORDER BY a.affecte_le, a.id) AS apps
       FROM affectations a
       JOIN campagnes c ON c.id = a.campagne_id
       JOIN apps ap ON ap.id = a.app_id
       JOIN utilisateurs u ON u.id = a.testeur_id
      WHERE a.statut = 'active' AND c.statut = 'en_cours' AND u.statut = 'valide' AND u.telephone IS NOT NULL
        AND a.installation_confirmee_le IS NOT NULL AND a.jours_valides < c.jours_exiges
        AND NOT EXISTS (SELECT 1 FROM rapports r WHERE r.affectation_id = a.id AND r.jour = $1)
        AND NOT EXISTS (SELECT 1 FROM rappels_sms s WHERE s.testeur_id = a.testeur_id AND s.jour = $1)
      GROUP BY u.id, u.telephone
      ORDER BY u.id`,
    [jour],
  )
  let envoyes = 0
  for (const ligne of rows) {
    const { rowCount } = await pool.query(
      'INSERT INTO rappels_sms (testeur_id, jour, apps, envoye_le) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
      [ligne.testeur_id, jour, ligne.apps, maintenant],
    )
    if (!rowCount) continue
    try {
      await sms.envoyer({ a: ligne.telephone, texte: messageRappel(ligne.apps) })
      envoyes++
    } catch (erreur) {
      // Pas de nouvel essai : un rappel tardif après minuit n'aurait plus de sens.
      journal.error(erreur)
    }
  }
  return { jour, envoyes }
}

// Instant de 22 h au Bénin pour un jour donné.
const instantRappel = (jour) => new Date(debutJourBenin(jour).getTime() + HEURE_RAPPEL_SMS * HEURE_MS)

// Chaque soir à 22 h. Un serveur démarré entre 22 h et minuit envoie tout de suite ceux du soir.
export function demarrerRappelsSms(deps) {
  let minuteur = null
  let arrete = false

  async function envoyer(jour) {
    try {
      const bilan = await envoyerRappelsSms(deps, { jour, maintenant: deps.maintenant() })
      if (bilan.envoyes) deps.journal.info(`[rappels] ${jour} : ${bilan.envoyes} SMS de rappel envoyés`)
    } catch (erreur) {
      deps.journal.error(erreur)
    }
  }

  function programmer() {
    if (arrete) return
    const maintenant = deps.maintenant()
    const aujourdhui = jourBenin(maintenant)
    const ceSoir = instantRappel(aujourdhui)
    const jour = ceSoir > maintenant ? aujourdhui : ajouterJours(aujourdhui, 1)
    minuteur = setTimeout(async () => {
      await envoyer(jour)
      programmer()
    }, instantRappel(jour).getTime() - maintenant.getTime())
    minuteur.unref?.()
  }

  const maintenant = deps.maintenant()
  const aujourdhui = jourBenin(maintenant)
  const premier = (maintenant >= instantRappel(aujourdhui) ? envoyer(aujourdhui) : Promise.resolve()).then(programmer)
  return {
    premier,
    arreter() {
      arrete = true
      clearTimeout(minuteur)
    },
  }
}
