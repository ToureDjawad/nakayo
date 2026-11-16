import { ErreurHttp, introuvable } from '../lib/erreurs.js'
import { montantLisible, offre as lireOffre } from '../lib/offres.js'
import { versAppApi } from './apps.js'

// File de vérification des apps (US-14, docs/api-sprint2.md §5).
export const STATUTS_FILE = ['en_verification', 'validee', 'refusee']

const SELECT_APP_ADMIN = `SELECT a.*, u.nom AS dev_nom, u.email AS dev_email, u.pays AS dev_pays,
    u.lien_fiche_developpeur AS dev_fiche,
    p.reference AS paiement_reference, p.moyen AS paiement_moyen, p.montant AS paiement_montant,
    p.devise AS paiement_devise, p.statut AS paiement_statut, p.confirme_le AS paiement_confirme_le,
    p.rembourse_le AS paiement_rembourse_le, f.numero AS paiement_facture
  FROM apps a
  JOIN utilisateurs u ON u.id = a.developpeur_id
  LEFT JOIN LATERAL (
    SELECT * FROM paiements WHERE app_id = a.id AND statut IN ('reussi', 'rembourse') ORDER BY confirme_le DESC, id DESC LIMIT 1
  ) p ON true
  LEFT JOIN factures f ON f.paiement_id = p.id`

export function versAppAdmin(l) {
  return {
    ...versAppApi(l),
    developpeur: { id: String(l.developpeur_id), nom: l.dev_nom, email: l.dev_email, pays: l.dev_pays, lienFicheDeveloppeur: l.dev_fiche },
    paiement: l.paiement_reference
      ? {
          reference: l.paiement_reference,
          moyen: l.paiement_moyen,
          montant: l.paiement_montant,
          devise: l.paiement_devise,
          montantLisible: montantLisible(l.paiement_montant, l.paiement_devise),
          statut: l.paiement_statut,
          facture: l.paiement_facture ?? null,
          confirmeLe: l.paiement_confirme_le?.toISOString() ?? null,
          rembourseLe: l.paiement_rembourse_le?.toISOString() ?? null,
        }
      : null,
    decideLe: l.decide_le?.toISOString() ?? null,
  }
}

// Liste paginée ; la file « en vérification » montre d'abord les apps payées depuis le plus longtemps.
export async function listerAppsAdmin(db, { statut, page, parPage }) {
  const ordre = statut === 'en_verification' ? 'a.modifie_le ASC, a.id ASC' : 'a.decide_le DESC NULLS LAST, a.id DESC'
  const { rows } = await db.query(
    `${SELECT_APP_ADMIN.replace('SELECT a.*', 'SELECT a.*, count(*) OVER ()::int AS total')}
      WHERE a.statut = $1 ORDER BY ${ordre} LIMIT $2 OFFSET $3`,
    [statut, parPage, (page - 1) * parPage],
  )
  let total = rows[0]?.total ?? 0
  if (!rows.length && page > 1) {
    const { rows: compte } = await db.query('SELECT count(*)::int AS total FROM apps WHERE statut = $1', [statut])
    total = compte[0].total
  }
  return { apps: rows.map(versAppAdmin), total, page, parPage }
}

async function lireLigne(db, id) {
  const { rows } = await db.query(`${SELECT_APP_ADMIN} WHERE a.id = $1 AND a.statut <> 'brouillon'`, [id])
  return rows[0] ?? null
}

export async function lireAppAdmin(db, id) {
  const ligne = await lireLigne(db, id)
  if (!ligne) throw introuvable('App introuvable.')
  const { rows } = await db.query(
    `SELECT d.decision, d.motif, d.cree_le, u.nom AS admin_nom
       FROM decisions_apps d JOIN utilisateurs u ON u.id = d.admin_id
      WHERE d.app_id = $1 ORDER BY d.cree_le DESC, d.id DESC`,
    [id],
  )
  return {
    app: versAppAdmin(ligne),
    historique: rows.map((d) => ({ decision: d.decision, motif: d.motif, admin: d.admin_nom, creeLe: d.cree_le.toISOString() })),
  }
}

// Décision sur une app en vérification. Un refus rembourse le paiement réussi de l'app.
// Deux admins en même temps : le second reçoit 409 statut_incompatible.
export async function deciderApp(client, { id, adminId, decision, motif = null, maintenant }) {
  const { rows } = await client.query(
    `UPDATE apps SET statut = $2, motif_refus = $3, decide_par = $4, decide_le = $5, modifie_le = $5
      WHERE id = $1 AND statut = 'en_verification' RETURNING id`,
    [id, decision, motif, adminId, maintenant],
  )
  if (!rows.length) {
    const { rows: existe } = await client.query(`SELECT statut FROM apps WHERE id = $1 AND statut <> 'brouillon'`, [id])
    if (!existe.length) throw introuvable('App introuvable.')
    throw new ErreurHttp(409, 'statut_incompatible', { message: 'Cette app a déjà été traitée.', statut: existe[0].statut })
  }
  let rembourse = null
  if (decision === 'refusee') {
    const { rows: payes } = await client.query(
      `UPDATE paiements SET statut = 'rembourse', rembourse_le = $2 WHERE app_id = $1 AND statut = 'reussi' RETURNING id`,
      [id, maintenant],
    )
    rembourse = payes[0]?.id ?? null
  }
  await client.query(
    'INSERT INTO decisions_apps (app_id, admin_id, decision, motif, paiement_rembourse_id, cree_le) VALUES ($1, $2, $3, $4, $5, $6)',
    [id, adminId, decision, motif, rembourse, maintenant],
  )
  return lireLigne(client, id)
}

// Email au développeur après la décision.
export function messageDecisionApp(ligne, { clientUrl }) {
  const lien = `${clientUrl}/mon-compte`
  if (ligne.statut === 'validee') {
    return {
      a: ligne.dev_email,
      sujet: `Votre app « ${ligne.nom} » est validée`,
      texte: [
        'Bonjour,',
        '',
        `Notre équipe a vérifié votre app « ${ligne.nom} » : tout est prêt pour la campagne de test.`,
        `Terminez la liste de vérification, puis démarrez la campagne : ${lireOffre(ligne.offre).testeurs} testeurs seront affectés à votre app.`,
        '',
        `Suivre votre app : ${lien}`,
        '',
        'L’équipe Nakayo',
      ].join('\n'),
    }
  }
  const remboursement = ligne.paiement_statut === 'rembourse'
    ? [`Votre paiement de ${montantLisible(ligne.paiement_montant, ligne.paiement_devise)} vous est remboursé (référence ${ligne.paiement_reference}).`, '']
    : []
  return {
    a: ligne.dev_email,
    sujet: `Votre app « ${ligne.nom} » n’a pas été acceptée`,
    texte: [
      'Bonjour,',
      '',
      `Notre équipe a vérifié votre app « ${ligne.nom} » et ne peut pas lancer la campagne.`,
      `Motif : ${ligne.motif_refus}`,
      '',
      ...remboursement,
      `Vous pouvez soumettre de nouveau votre app une fois le problème corrigé : ${lien}`,
      '',
      'L’équipe Nakayo',
    ].join('\n'),
  }
}
