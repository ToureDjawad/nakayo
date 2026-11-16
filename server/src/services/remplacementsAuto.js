import { JOURS_CAMPAGNE, JOURS_REMPLACEMENT_MANUEL } from '../lib/affectation.js'
import { ajouterJours, jourBenin, JOUR_MS } from '../lib/temps.js'
import { transaction } from '../routes/auth.js'
import { jourCampagne, lireMembres, messageNouvelleApp, remplacerAffectation } from './campagnes.js'
import { lireActivite } from './emailsCampagne.js'

// US-27 : remplacement automatique des testeurs inactifs (docs/remplacement-automatique.md).
// Après la vérification de la nuit, à partir du jour 3 : un testeur inactif depuis 2 jours (pas
// inscrit, ou aucune journée validée sur les deux derniers jours, jours non acquis) est remplacé.
// Après le jour 2, la campagne est prolongée, sans frais, pour que le remplaçant ait le temps
// de faire ses 14 jours.

export const MOTIF_AUTOMATIQUE = 'Inactif depuis 2 jours (remplacement automatique).'

export async function remplacerInactifs(deps, { maintenant }) {
  const { pool, sms, emails, config, journal } = deps
  const jourVerifie = ajouterJours(jourBenin(maintenant), -1)
  const { rows: campagnes } = await pool.query(
    `SELECT c.id, c.app_id, c.demarree_le, ap.nom, ap.groupe_google AS groupe_app, u.email
       FROM campagnes c JOIN apps ap ON ap.id = c.app_id JOIN utilisateurs u ON u.id = c.developpeur_id
      WHERE c.statut = 'en_cours' ORDER BY c.id`,
  )
  const bilan = { remplaces: 0, manquants: 0 }
  for (const c of campagnes) {
    const jour = jourCampagne(c.demarree_le, maintenant)
    if (jour <= JOURS_REMPLACEMENT_MANUEL) continue
    const inactifs = (await lireActivite(pool, { campagneId: c.id, jourVerifie, jour })).filter((a) => !a.actif)
    if (!inactifs.length) continue

    const remplacements = []
    let manquants = 0
    let finPrevue = null
    for (const inactif of inactifs) {
      try {
        const r = await transaction(pool, async (client) => {
          const { rows } = await client.query(`SELECT * FROM campagnes WHERE id = $1 AND statut = 'en_cours' FOR UPDATE`, [c.id])
          if (!rows.length) return null
          const membres = await lireMembres(client, c.id)
          const sortant = membres.find((m) => String(m.id) === String(inactif.id) && m.statut === 'active')
          if (!sortant) return null
          const entrant = await remplacerAffectation(client, { campagne: rows[0], membres, sortant, motif: MOTIF_AUTOMATIQUE, maintenant })
          // Le remplaçant a besoin d'une campagne complète à partir d'aujourd'hui.
          const { rows: prolongee } = await client.query(
            `UPDATE campagnes SET fin_prevue_le = GREATEST(fin_prevue_le, $2) WHERE id = $1 RETURNING fin_prevue_le`,
            [c.id, new Date(maintenant.getTime() + JOURS_CAMPAGNE * JOUR_MS)],
          )
          const { rows: entrants } = await client.query(
            `SELECT u.telephone, p.gmail FROM utilisateurs u JOIN profils_testeurs p ON p.utilisateur_id = u.id WHERE u.id = $1`,
            [entrant.testeurId],
          )
          return { sortant, entrant: entrants[0], finPrevue: prolongee[0].fin_prevue_le }
        })
        if (!r) continue
        remplacements.push(r)
        finPrevue = r.finPrevue
      } catch (erreur) {
        if (erreur.code !== 'testeurs_insuffisants') throw erreur
        manquants = inactifs.length - remplacements.length
        break
      }
    }
    bilan.remplaces += remplacements.length
    bilan.manquants += manquants
    if (!remplacements.length && !manquants) continue

    const envois = [
      ...remplacements.flatMap(({ sortant, entrant }) => [
        sortant.telephone && { canal: sms, message: { a: sortant.telephone, texte: messageRetire(c.nom) } },
        entrant?.telephone && { canal: sms, message: { a: entrant.telephone, texte: messageNouvelleApp(c.nom) } },
      ]),
      emails && { canal: emails, message: messageDeveloppeur(c, { remplacements, manquants, finPrevue, jour, clientUrl: config?.clientUrl ?? '' }) },
    ].filter(Boolean)
    for (const { canal, message } of envois) {
      try {
        await canal.envoyer(message)
      } catch (erreur) {
        journal.error(erreur)
      }
    }
  }
  // US-43 : les remplacés quittent le Groupe Google de l'app, les remplaçants y entrent.
  if (bilan.remplaces) deps.synchroGroupes?.lancer()
  return bilan
}

const dateCourte = (date) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Africa/Porto-Novo' }).format(date)

export function messageRetire(nomApp) {
  return `Nakayo : vous n'avez pas testé « ${nomApp} » ces 2 derniers jours, un autre testeur vous remplace. Vous pouvez vous désinscrire de ce test.`
}

function messageDeveloppeur(c, { remplacements, manquants, finPrevue, jour, clientUrl }) {
  const lignes = ['Bonjour,', '']
  if (remplacements.length) {
    lignes.push(
      `${remplacements.length} testeur${remplacements.length > 1 ? 's' : ''} de « ${c.nom} » ne testai${remplacements.length > 1 ? 'ent' : 't'} plus depuis 2 jours et ${remplacements.length > 1 ? 'ont été remplacés' : 'a été remplacé'} automatiquement.`,
    )
    lignes.push(
      c.groupe_app
        ? 'Le groupe des testeurs de votre app est déjà à jour : vous n’avez rien à faire.'
        : 'Si vous avez ajouté la liste des Gmail plutôt que le groupe, ajoutez ces adresses à votre test fermé :',
    )
    if (!c.groupe_app) for (const { entrant } of remplacements) lignes.push(`- ${entrant.gmail}`)
    if (jour > JOURS_REMPLACEMENT_MANUEL && finPrevue) {
      lignes.push('', `Pour que les remplaçants fassent leurs 14 jours, la campagne est prolongée jusqu’au ${dateCourte(finPrevue)}, sans frais.`)
    }
  }
  if (manquants) {
    lignes.push('', `Aucun testeur n’était disponible pour remplacer ${manquants} testeur${manquants > 1 ? 's' : ''} inactif${manquants > 1 ? 's' : ''}. Notre équipe s’en occupe.`)
  }
  lignes.push('', `Suivre la campagne : ${clientUrl}/mon-compte/apps/${c.app_id}/campagne`, '', 'L’équipe Nakayo')
  return { a: c.email, sujet: `« ${c.nom} » : testeurs remplacés`, texte: lignes.join('\n') }
}
