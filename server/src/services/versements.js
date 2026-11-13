import { randomBytes } from 'node:crypto'
import { ErreurHttp, introuvable } from '../lib/erreurs.js'
import { BONUS_BUG, montantLisible, remuneration } from '../lib/offres.js'
import { transaction } from '../routes/auth.js'

// Versements Mobile Money aux testeurs (US-22, docs/api-sprint4.md §2). À la clôture d'une
// campagne (J16), chaque testeur qui a ses 14 jours validés et qui est resté inscrit au test
// reçoit la paie de l'offre (500 FCFA en Standard, 800 FCFA en Pro), plus 200 FCFA par bug
// accepté par le développeur (US-33). En cas d'échec, 3 nouvelles tentatives sont faites, puis l'admin est alerté.

export const TENTATIVES_MAX = 4
// Attente avant chaque nouvelle tentative (après la 1re, la 2e puis la 3e).
export const DELAIS_NOUVELLE_TENTATIVE_MS = [60 * 60 * 1000, 4 * 60 * 60 * 1000, 24 * 60 * 60 * 1000]
const PAR_PASSAGE = 50

export const OPERATEURS_LISIBLES = { mtn: 'MTN MoMo', moov: 'Moov Money' }

export const nouvelleReferenceVersement = () => `VER-${randomBytes(8).toString('hex').toUpperCase()}`

// Paie de l'offre, plus le bonus des bugs acceptés (US-33).
export const montantVersement = (codeOffre, bugsAcceptes = 0) => remuneration(codeOffre).montant + bugsAcceptes * BONUS_BUG.montant

// Crée les versements des campagnes qui viennent de se terminer (dans la transaction de la
// clôture). Rejouable : une affectation n'a jamais deux versements.
export async function creerVersementsCampagnes(client, { campagneIds, maintenant }) {
  if (!campagneIds.length) return 0
  const { rows } = await client.query(
    `SELECT a.id, a.campagne_id, a.testeur_id, p.numero_momo, p.operateur_momo,
            (SELECT offre FROM apps WHERE id = a.app_id) AS offre,
            (SELECT count(*)::int FROM bugs b WHERE b.affectation_id = a.id AND b.statut = 'accepte') AS bugs_acceptes
       FROM affectations a
       JOIN campagnes c ON c.id = a.campagne_id
       JOIN profils_testeurs p ON p.utilisateur_id = a.testeur_id
      WHERE a.campagne_id = ANY($1) AND a.statut = 'active'
        AND a.inscription_confirmee_le IS NOT NULL AND a.jours_valides >= c.jours_exiges
      ORDER BY a.id`,
    [campagneIds],
  )
  let crees = 0
  for (const ligne of rows) {
    const { rowCount } = await client.query(
      `INSERT INTO versements (reference, affectation_id, campagne_id, testeur_id, montant, devise, numero_momo, operateur_momo,
                               prochaine_tentative_le, cree_le)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9) ON CONFLICT (affectation_id) DO NOTHING`,
      [
        nouvelleReferenceVersement(),
        ligne.id,
        ligne.campagne_id,
        ligne.testeur_id,
        montantVersement(ligne.offre, ligne.bugs_acceptes),
        remuneration(ligne.offre).devise,
        ligne.numero_momo,
        ligne.operateur_momo,
        maintenant,
      ],
    )
    crees += rowCount
  }
  return crees
}

const SELECT_VERSEMENT = `SELECT v.*, ap.nom AS app_nom, u.nom AS testeur_nom, u.telephone
  FROM versements v
  JOIN affectations a ON a.id = v.affectation_id
  JOIN apps ap ON ap.id = a.app_id
  JOIN utilisateurs u ON u.id = v.testeur_id`

// Objet `versement` du contrat (§2.1).
export function versVersementApi(l) {
  return {
    reference: l.reference,
    campagneId: String(l.campagne_id),
    appNom: l.app_nom,
    montant: l.montant,
    devise: l.devise,
    montantLisible: montantLisible(l.montant, l.devise),
    operateur: l.operateur_momo,
    numeroMasque: masquerNumero(l.numero_momo),
    statut: l.statut,
    tentatives: l.tentatives,
    prochaineTentativeLe: l.statut === 'a_verser' ? (l.prochaine_tentative_le?.toISOString() ?? null) : null,
    dernierMotif: l.dernier_motif,
    creeLe: l.cree_le.toISOString(),
    verseLe: l.verse_le?.toISOString() ?? null,
  }
}

// Pour l'admin : le testeur payé en plus.
export function versVersementAdmin(l) {
  return {
    ...versVersementApi(l),
    testeur: { id: String(l.testeur_id), nom: l.testeur_nom, telephone: l.telephone, numeroMomo: l.numero_momo },
    referenceFournisseur: l.reference_fournisseur,
    alerteLe: l.alerte_le?.toISOString() ?? null,
  }
}

// « +22901960012 » → « •••• 12 » : les 2 derniers chiffres suffisent pour reconnaître son compte.
export function masquerNumero(numero) {
  return `•••• ${numero.slice(-2)}`
}

export function messageVersement(v) {
  return (
    `Nakayo : ${montantLisible(v.montant, v.devise)} vous ont été versés sur votre compte ${OPERATEURS_LISIBLES[v.operateur_momo]} ` +
    `(${masquerNumero(v.numero_momo)}) pour votre test de « ${v.app_nom} ». Merci pour vos 14 jours de test !`
  )
}

export function messageAlerteAdmin(v, { email, clientUrl }) {
  return {
    a: email,
    sujet: `Versement testeur en échec : ${v.reference}`,
    texte: [
      'Bonjour,',
      '',
      `Le versement de ${montantLisible(v.montant, v.devise)} au testeur ${v.testeur_nom} (${v.telephone}) a échoué ${v.tentatives} fois.`,
      `App : « ${v.app_nom} »`,
      `Compte : ${OPERATEURS_LISIBLES[v.operateur_momo]} ${v.numero_momo}`,
      `Dernier motif : ${v.dernier_motif ?? 'inconnu'}`,
      `Référence : ${v.reference}`,
      '',
      'Vérifiez le compte avec le testeur, puis relancez le versement depuis l’administration.',
      `${clientUrl}/admin`,
      '',
      'Nakayo',
    ].join('\n'),
  }
}

// Retrouve notre référence (VER-…) à partir de l'identifiant du payout chez le fournisseur.
export async function referenceVersementDepuisFournisseur(db, referenceFournisseur) {
  const { rows } = await db.query('SELECT reference FROM versements WHERE reference_fournisseur = $1', [referenceFournisseur])
  return rows[0]?.reference ?? null
}

async function lireVersementParId(db, id) {
  const { rows } = await db.query(`${SELECT_VERSEMENT} WHERE v.id = $1`, [id])
  return rows[0]
}

// Enregistre l'issue d'une tentative (réponse directe ou webhook). Renvoie { versement, issue }
// où issue vaut 'verse' (SMS à envoyer), 'alerte' (admin à prévenir) ou null.
export async function appliquerIssue(client, { reference, statut, referenceFournisseur, motif, maintenant }) {
  const { rows } = await client.query('SELECT * FROM versements WHERE reference = $1 FOR UPDATE', [reference])
  if (!rows.length) throw introuvable('Versement introuvable.')
  const v = rows[0]
  // Un versement déjà réglé ne bouge plus (webhook reçu deux fois, réponse tardive).
  if (v.statut === 'verse' || v.statut === 'echoue') return { versement: await lireVersementParId(client, v.id), issue: null }

  if (statut === 'verse') {
    await client.query(
      `UPDATE versements SET statut = 'verse', verse_le = $2, reference_fournisseur = COALESCE($3, reference_fournisseur),
              prochaine_tentative_le = NULL, dernier_motif = NULL WHERE id = $1`,
      [v.id, maintenant, referenceFournisseur ?? null],
    )
    return { versement: await lireVersementParId(client, v.id), issue: 'verse' }
  }
  if (statut === 'en_cours') {
    await client.query(`UPDATE versements SET statut = 'en_cours', reference_fournisseur = COALESCE($2, reference_fournisseur) WHERE id = $1`, [
      v.id,
      referenceFournisseur ?? null,
    ])
    return { versement: await lireVersementParId(client, v.id), issue: null }
  }

  // Échec : nouvelle tentative plus tard, ou abandon et alerte après la 4e.
  const epuise = v.tentatives >= TENTATIVES_MAX
  await client.query(
    `UPDATE versements SET statut = $2, dernier_motif = $3, prochaine_tentative_le = $4, alerte_le = $5,
            reference_fournisseur = COALESCE($6, reference_fournisseur) WHERE id = $1`,
    [
      v.id,
      epuise ? 'echoue' : 'a_verser',
      motif || 'refuse_par_le_fournisseur',
      epuise ? null : new Date(maintenant.getTime() + DELAIS_NOUVELLE_TENTATIVE_MS[v.tentatives - 1]),
      epuise ? maintenant : null,
      referenceFournisseur ?? null,
    ],
  )
  return { versement: await lireVersementParId(client, v.id), issue: epuise ? 'alerte' : null }
}

// SMS au testeur ou email aux admins après une issue. Un envoi raté n'annule pas le versement.
export async function prevenir({ pool, sms, emails, config, journal }, { versement, issue }) {
  try {
    if (issue === 'verse' && versement.telephone) await sms.envoyer({ a: versement.telephone, texte: messageVersement(versement) })
    if (issue === 'alerte') {
      const { rows } = await pool.query("SELECT email FROM utilisateurs WHERE role = 'admin' AND statut = 'valide' ORDER BY id")
      for (const { email } of rows) await emails.envoyer(messageAlerteAdmin(versement, { email, clientUrl: config.clientUrl }))
    }
  } catch (erreur) {
    journal.error(erreur)
  }
}

// Verse ce qui est dû. Chaque versement est réservé (tentative comptée) avant l'appel au
// fournisseur : deux passages simultanés ne paient jamais deux fois.
export async function traiterVersements(deps) {
  const { pool, momo, maintenant, journal } = deps
  const bilan = { tentes: 0, verses: 0, enCours: 0, echecs: 0, alertes: 0 }
  if (!momo) return bilan
  const reserves = await transaction(pool, async (client) => {
    const { rows } = await client.query(
      `UPDATE versements SET tentatives = tentatives + 1, derniere_tentative_le = $1, prochaine_tentative_le = NULL
        WHERE id IN (SELECT id FROM versements WHERE statut = 'a_verser' AND prochaine_tentative_le <= $1
                      ORDER BY prochaine_tentative_le, id LIMIT $2 FOR UPDATE SKIP LOCKED)
        RETURNING reference, numero_momo, operateur_momo, montant, devise,
                  (SELECT nom FROM utilisateurs WHERE id = versements.testeur_id) AS nom`,
      [maintenant(), PAR_PASSAGE],
    )
    return rows
  })

  for (const v of reserves) {
    bilan.tentes++
    let resultat
    try {
      resultat = await momo.verser({ reference: v.reference, numero: v.numero_momo, operateur: v.operateur_momo, montant: v.montant, devise: v.devise, nom: v.nom })
    } catch (erreur) {
      journal.error(erreur)
      resultat = { statut: 'echoue', motif: 'fournisseur_injoignable' }
    }
    const statut = ['verse', 'en_cours'].includes(resultat?.statut) ? resultat.statut : 'echoue'
    const issue = await transaction(pool, (client) =>
      appliquerIssue(client, { reference: v.reference, statut, referenceFournisseur: resultat?.referenceFournisseur, motif: resultat?.motif, maintenant: maintenant() }),
    )
    if (statut === 'verse') bilan.verses++
    else if (statut === 'en_cours') bilan.enCours++
    else bilan.echecs++
    if (issue.issue === 'alerte') bilan.alertes++
    await prevenir(deps, issue)
  }
  return bilan
}

// Relance par l'admin d'un versement abandonné (après correction du compte avec le testeur) :
// les tentatives repartent de zéro, avec le numéro MoMo actuel du testeur.
export async function relancerVersement(client, { reference, maintenant }) {
  const { rows } = await client.query(
    `SELECT v.id, v.statut, p.numero_momo, p.operateur_momo FROM versements v
       JOIN profils_testeurs p ON p.utilisateur_id = v.testeur_id WHERE v.reference = $1 FOR UPDATE OF v`,
    [reference],
  )
  if (!rows.length) throw introuvable('Versement introuvable.')
  const v = rows[0]
  if (v.statut !== 'echoue') {
    throw new ErreurHttp(409, 'statut_incompatible', { message: 'Seul un versement en échec peut être relancé.', statut: v.statut })
  }
  await client.query(
    `UPDATE versements SET statut = 'a_verser', tentatives = 0, prochaine_tentative_le = $2, alerte_le = NULL,
            numero_momo = $3, operateur_momo = $4 WHERE id = $1`,
    [v.id, maintenant, v.numero_momo, v.operateur_momo],
  )
  return lireVersementParId(client, v.id)
}

export async function listerVersementsAdmin(db, { statut, reference }) {
  const { rows } = await db.query(
    `${SELECT_VERSEMENT} WHERE ($1::statut_versement IS NULL OR v.statut = $1) AND ($2::text IS NULL OR v.reference = $2)
      ORDER BY v.cree_le DESC, v.id DESC LIMIT 200`,
    [statut ?? null, reference ?? null],
  )
  return rows.map(versVersementAdmin)
}

// US-23 : portefeuille du testeur. « En attente » : les apps en cours de test (500 FCFA à
// gagner avec les 14 jours) et les versements pas encore arrivés ; puis l'historique.
export async function lirePortefeuille(db, { testeurId }) {
  const { rows: profil } = await db.query('SELECT numero_momo, operateur_momo FROM profils_testeurs WHERE utilisateur_id = $1', [testeurId])
  const { rows: enTest } = await db.query(
    `SELECT a.id, ap.nom AS app_nom, ap.offre, a.jours_valides, c.jours_exiges, c.fin_prevue_le,
            (SELECT count(*)::int FROM bugs b WHERE b.affectation_id = a.id AND b.statut = 'accepte') AS bugs_acceptes
       FROM affectations a JOIN campagnes c ON c.id = a.campagne_id JOIN apps ap ON ap.id = a.app_id
      WHERE a.testeur_id = $1 AND a.statut = 'active' AND c.statut = 'en_cours'
      ORDER BY a.affecte_le, a.id`,
    [testeurId],
  )
  const { rows: verses } = await db.query(`${SELECT_VERSEMENT} WHERE v.testeur_id = $1 ORDER BY v.cree_le DESC, v.id DESC`, [testeurId])
  const enAttente = [
    // Gain prévu selon l'offre de l'app (500 FCFA en Standard, 800 FCFA en Pro), bonus des bugs acceptés compris.
    ...enTest.map((l) => {
      const { devise } = remuneration(l.offre)
      const montant = montantVersement(l.offre, l.bugs_acceptes)
      return {
        affectationId: String(l.id),
        appNom: l.app_nom,
        etat: 'en_test',
        joursValides: Math.min(l.jours_valides, l.jours_exiges),
        joursExiges: l.jours_exiges,
        montant,
        devise,
        montantLisible: montantLisible(montant, devise),
        prevuLe: l.fin_prevue_le.toISOString(),
      }
    }),
    ...verses
      .filter((v) => v.statut !== 'verse')
      .map((v) => ({
        affectationId: String(v.affectation_id),
        appNom: v.app_nom,
        // Un versement abandonné reste « en paiement » pour le testeur : l'équipe le reprend.
        etat: 'en_paiement',
        joursValides: 14,
        joursExiges: 14,
        montant: v.montant,
        devise: v.devise,
        montantLisible: montantLisible(v.montant, v.devise),
        prevuLe: null,
      })),
  ]
  const historique = verses
    .filter((v) => v.statut === 'verse')
    .map((v) => ({
      reference: v.reference,
      referenceTransaction: v.reference_fournisseur,
      appNom: v.app_nom,
      montant: v.montant,
      devise: v.devise,
      montantLisible: montantLisible(v.montant, v.devise),
      operateur: v.operateur_momo,
      numeroMasque: masquerNumero(v.numero_momo),
      verseLe: v.verse_le.toISOString(),
    }))
  const somme = (liste) => liste.reduce((total, l) => total + l.montant, 0)
  // Tous les gains des testeurs sont en FCFA, quelle que soit l'offre.
  const { devise } = remuneration('standard')
  return {
    devise,
    totalEnAttente: somme(enAttente),
    totalEnAttenteLisible: montantLisible(somme(enAttente), devise),
    totalVerse: somme(historique),
    totalVerseLisible: montantLisible(somme(historique), devise),
    compte: profil.length ? { operateur: profil[0].operateur_momo, numeroMasque: masquerNumero(profil[0].numero_momo) } : null,
    enAttente,
    historique,
  }
}

// Passage toutes les 15 minutes, et un premier au démarrage.
export function demarrerVersements(deps, { intervalleMs = 15 * 60 * 1000 } = {}) {
  let enCours = null
  const passer = () => {
    if (enCours) return enCours
    enCours = traiterVersements(deps)
      .then((bilan) => {
        if (bilan.tentes) deps.journal.info(`[versements] ${bilan.tentes} tentés, ${bilan.verses} versés, ${bilan.echecs} échecs, ${bilan.alertes} alertes`)
        return bilan
      })
      .catch((erreur) => deps.journal.error(erreur))
      .finally(() => {
        enCours = null
      })
    return enCours
  }
  const minuteur = setInterval(passer, intervalleMs)
  minuteur.unref?.()
  return { premier: passer(), passer, arreter: () => clearInterval(minuteur) }
}
