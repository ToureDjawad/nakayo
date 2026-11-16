import { ErreurHttp, introuvable } from '../lib/erreurs.js'
import { jourBenin } from '../lib/temps.js'

// US-30 : garantie « nouvelle campagne offerte » si Google refuse l'accès à la production
// (docs/garantie.md).
export const DELAI_GARANTIE_JOURS = 7
export const MOTIFS_GOOGLE = { engagement_insuffisant: 'Engagement des testeurs insuffisant', testeurs_insuffisants: 'Nombre de testeurs insuffisant' }
export const CHOIX = { nouvelle_campagne: 'Nouvelle campagne offerte', remboursement: 'Remboursement' }
export const STATUTS_GARANTIE = ['en_attente', 'acceptee', 'refusee']
const JOUR_MS = 24 * 60 * 60 * 1000

const fin = (c) => c.terminee_le ?? c.fin_prevue_le

export function versGarantie(g) {
  return {
    id: String(g.id),
    appId: String(g.app_id),
    choix: g.choix,
    motifGoogle: g.motif_google,
    emailGoogle: g.email_google,
    statut: g.statut,
    motifRefus: g.motif_refus,
    decideLe: g.decide_le?.toISOString() ?? null,
    campagneOfferteDemarree: Boolean(g.campagne_offerte_id),
    creeLe: g.cree_le.toISOString(),
  }
}

async function derniereCampagne(db, { appId, developpeurId }) {
  const { rows } = await db.query(
    `SELECT c.* FROM campagnes c JOIN apps a ON a.id = c.app_id
      WHERE c.app_id = $1 AND a.developpeur_id = $2 ORDER BY c.demarree_le DESC, c.id DESC LIMIT 1`,
    [appId, developpeurId],
  )
  return rows[0] ?? null
}

// État pour le développeur : la garantie demandée, ou si elle peut l'être et jusqu'à quand.
export async function lireGarantie(db, { appId, developpeurId, maintenant }) {
  const { rows } = await db.query('SELECT * FROM garanties WHERE app_id = $1 AND developpeur_id = $2', [appId, developpeurId])
  if (rows.length) return { garantie: versGarantie(rows[0]), possible: false, jusquau: null, raison: 'deja_demandee' }
  const c = await derniereCampagne(db, { appId, developpeurId })
  if (!c) throw introuvable('Campagne introuvable.')
  const limite = new Date(fin(c).getTime() + DELAI_GARANTIE_JOURS * JOUR_MS)
  let raison = null
  if (c.offerte) raison = 'campagne_offerte'
  else if (c.statut !== 'terminee') raison = 'campagne_pas_terminee'
  else if (maintenant > limite) raison = 'delai_depasse'
  return { garantie: null, possible: !raison, jusquau: raison === 'campagne_pas_terminee' ? null : jourBenin(limite), raison }
}

export async function demanderGarantie(client, { appId, developpeurId, choix, motifGoogle, emailGoogle, maintenant }) {
  await client.query('SELECT 1 FROM apps WHERE id = $1 FOR UPDATE', [appId])
  const etat = await lireGarantie(client, { appId, developpeurId, maintenant })
  if (!etat.possible) {
    const messages = {
      deja_demandee: 'Une seule garantie par app : votre demande est déjà enregistrée.',
      campagne_offerte: 'La campagne offerte n’ouvre pas droit à une nouvelle garantie.',
      campagne_pas_terminee: 'La garantie se demande après la fin du test.',
      delai_depasse: `La garantie se demande dans les ${DELAI_GARANTIE_JOURS} jours après la fin du test.`,
    }
    throw new ErreurHttp(409, etat.raison === 'deja_demandee' ? 'garantie_existante' : 'garantie_impossible', { message: messages[etat.raison], raison: etat.raison })
  }
  const c = await derniereCampagne(client, { appId, developpeurId })
  const { rows } = await client.query(
    `INSERT INTO garanties (app_id, campagne_id, developpeur_id, choix, motif_google, email_google, cree_le)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [appId, c.id, developpeurId, choix, motifGoogle, emailGoogle, maintenant],
  )
  // La réponse de Google est notée sur la campagne (taux de réussite, US-24).
  await client.query(
    `UPDATE campagnes SET decision_google = 'refusee', decision_saisie_le = COALESCE(decision_saisie_le, $2) WHERE id = $1`,
    [c.id, maintenant],
  )
  return rows[0]
}

const SELECT_ADMIN = `SELECT g.*, a.nom AS app_nom, a.package AS app_package, a.offre, u.nom AS dev_nom, u.email AS dev_email,
    c.demarree_le, c.terminee_le, c.fin_prevue_le, c.jours_exiges,
    (SELECT count(*)::int FROM affectations af WHERE af.campagne_id = c.id AND af.statut <> 'remplacee'
        AND af.jours_valides >= c.jours_exiges) AS testeurs_au_bout,
    a.preparation_complete_le,
    count(*) OVER ()::int AS total
  FROM garanties g JOIN apps a ON a.id = g.app_id JOIN utilisateurs u ON u.id = g.developpeur_id JOIN campagnes c ON c.id = g.campagne_id`

function versGarantieAdmin(l) {
  return {
    ...versGarantie(l),
    app: { id: String(l.app_id), nom: l.app_nom, package: l.app_package, offre: l.offre },
    developpeur: { nom: l.dev_nom, email: l.dev_email },
    campagne: {
      id: String(l.campagne_id),
      demarreeLe: l.demarree_le.toISOString(),
      termineeLe: fin(l).toISOString(),
      testeursAuBout: l.testeurs_au_bout,
      preparationComplete: Boolean(l.preparation_complete_le),
    },
  }
}

export async function listerGaranties(db, { statut, page = 1 }) {
  const { rows } = await db.query(`${SELECT_ADMIN} WHERE g.statut = $1 ORDER BY g.cree_le, g.id LIMIT 20 OFFSET $2`, [statut, (page - 1) * 20])
  return { garanties: rows.map(versGarantieAdmin), total: rows[0]?.total ?? 0, page, parPage: 20 }
}

// Décision de l'admin. Acceptée : la nouvelle campagne pourra démarrer sans paiement, ou le
// paiement est marqué remboursé. Refusée : avec un motif envoyé au développeur.
export async function deciderGarantie(client, { id, decision, motif, adminId, maintenant }) {
  await client.query('SELECT 1 FROM garanties WHERE id = $1 FOR UPDATE', [id])
  const { rows } = await client.query(`${SELECT_ADMIN} WHERE g.id = $1`, [id])
  const g = rows[0]
  if (!g) throw introuvable('Demande introuvable.')
  if (g.statut !== 'en_attente') throw new ErreurHttp(409, 'statut_incompatible', { message: 'Cette demande a déjà été traitée.', statut: g.statut })
  let paiement = null
  if (decision === 'acceptee' && g.choix === 'remboursement') {
    const { rows: payes } = await client.query(
      `UPDATE paiements SET statut = 'rembourse', rembourse_le = $2
        WHERE id = (SELECT id FROM paiements WHERE app_id = $1 AND statut = 'reussi' ORDER BY confirme_le DESC, id DESC LIMIT 1)
        RETURNING id, reference, montant, devise`,
      [g.app_id, maintenant],
    )
    paiement = payes[0] ?? null
  }
  const { rows: maj } = await client.query(
    `UPDATE garanties SET statut = $2, motif_refus = $3, decide_par = $4, decide_le = $5, paiement_rembourse_id = $6 WHERE id = $1 RETURNING *`,
    [id, decision, decision === 'refusee' ? motif : null, adminId, maintenant, paiement?.id ?? null],
  )
  return { garantie: versGarantieAdmin({ ...g, ...maj[0] }), paiement }
}

// Une garantie acceptée « nouvelle campagne » et pas encore utilisée autorise un nouveau démarrage.
export async function garantieDisponible(client, appId) {
  const { rows } = await client.query(
    `SELECT id FROM garanties WHERE app_id = $1 AND statut = 'acceptee' AND choix = 'nouvelle_campagne' AND campagne_offerte_id IS NULL FOR UPDATE`,
    [appId],
  )
  return rows[0]?.id ?? null
}

export function messageDecisionGarantie(g, { paiement, clientUrl }) {
  const lien = `${clientUrl}/apps/${g.app.id}`
  let corps
  if (g.statut === 'refusee') {
    corps = [`Votre demande de garantie pour « ${g.app.nom} » n’a pas été acceptée.`, `Motif : ${g.motifRefus}`]
  } else if (g.choix === 'remboursement') {
    corps = [
      `Votre demande de garantie pour « ${g.app.nom} » est acceptée : vous êtes remboursé.`,
      paiement ? `Montant : ${paiement.montant} ${paiement.devise}, référence ${paiement.reference}. Comptez quelques jours selon votre moyen de paiement.` : '',
    ]
  } else {
    corps = [
      `Votre demande de garantie pour « ${g.app.nom} » est acceptée : une nouvelle campagne de 14 jours vous est offerte.`,
      'Publiez une nouvelle version avec vos corrections, puis démarrez la campagne depuis votre espace.',
    ]
  }
  return {
    a: g.developpeur.email,
    sujet: g.statut === 'refusee' ? `Garantie pour « ${g.app.nom} » : demande refusée` : `Garantie pour « ${g.app.nom} » : demande acceptée`,
    texte: ['Bonjour,', '', ...corps.filter(Boolean), '', `Votre app : ${lien}`, '', 'L’équipe Nakayo'].join('\n'),
  }
}

export function messageNouvelleGarantie({ email, app, clientUrl }) {
  return {
    a: email,
    sujet: `Garantie demandée pour « ${app} »`,
    texte: ['Bonjour,', '', `Le développeur de « ${app} » demande la garantie après un refus de Google.`, '', `À examiner : ${clientUrl}/admin/garanties`].join('\n'),
  }
}
