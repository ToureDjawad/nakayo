import { ErreurHttp, introuvable } from '../lib/erreurs.js'
import { montantLisible, OFFRE_AFRIQUE } from '../lib/offres.js'

// Devis de l'Offre Plus (US-37, docs/api-offres.md §4).
export const STATUTS_DEVIS = ['demande', 'propose', 'refuse']

const SELECT_DEVIS = `SELECT d.*, a.nom AS app_nom, a.package AS app_package, a.statut AS app_statut,
    u.nom AS dev_nom, u.email AS dev_email, u.pays AS dev_pays
  FROM devis d
  JOIN apps a ON a.id = d.app_id
  JOIN utilisateurs u ON u.id = d.developpeur_id`

const prixDe = (l) =>
  l.statut === 'propose'
    ? {
        carte: { montant: l.prix_carte, devise: 'USD', montantLisible: montantLisible(l.prix_carte, 'USD') },
        mobile_money: { montant: l.prix_mobile_money, devise: 'XOF', montantLisible: montantLisible(l.prix_mobile_money, 'XOF') },
      }
    : null

export function versDevisApi(l, vue = 'developpeur') {
  const devis = {
    id: String(l.id),
    appId: String(l.app_id),
    pays: l.pays,
    langues: l.langues,
    profils: l.profils,
    scenarios: l.scenarios,
    statut: l.statut,
    prix: prixDe(l),
    message: l.message ?? null,
    demandeLe: l.demande_le.toISOString(),
    reponduLe: l.repondu_le?.toISOString() ?? null,
  }
  if (vue !== 'admin') return devis
  return {
    ...devis,
    app: { id: String(l.app_id), nom: l.app_nom, package: l.app_package, statut: l.app_statut },
    developpeur: { id: String(l.developpeur_id), nom: l.dev_nom, email: l.dev_email, pays: l.dev_pays },
  }
}

export async function lireDevisApp(db, appId) {
  const { rows } = await db.query(`${SELECT_DEVIS} WHERE d.app_id = $1`, [appId])
  return rows[0] ?? null
}

// Le développeur décrit (ou corrige) son besoin. Toute modification relance l'étude du devis.
export async function enregistrerBesoin(db, { app, developpeurId, valeurs, maintenant }) {
  if (app.statut !== 'brouillon') {
    throw new ErreurHttp(409, 'statut_incompatible', { message: 'Le devis se demande avant le paiement de l’app.', statut: app.statut })
  }
  await db.query(
    `INSERT INTO devis (app_id, developpeur_id, pays, langues, profils, scenarios, demande_le)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (app_id) DO UPDATE SET pays = $3, langues = $4, profils = $5, scenarios = $6, demande_le = $7,
       statut = 'demande', prix_carte = NULL, prix_mobile_money = NULL, message = NULL, admin_id = NULL, repondu_le = NULL`,
    [app.id, developpeurId, valeurs.pays, valeurs.langues, valeurs.profils, valeurs.scenarios, maintenant],
  )
  return lireDevisApp(db, app.id)
}

// Prix à payer pour l'Offre Plus : celui du devis proposé.
export async function prixDevis(db, appId) {
  const devis = await lireDevisApp(db, appId)
  if (devis?.statut !== 'propose') {
    throw new ErreurHttp(409, 'devis_requis', { message: 'Demandez un devis : le prix de l’Offre Plus dépend de votre besoin.' })
  }
  return { carte: { montant: devis.prix_carte, devise: 'USD' }, mobile_money: { montant: devis.prix_mobile_money, devise: 'XOF' } }
}

// File des devis pour l'équipe : les demandes les plus anciennes d'abord.
export async function listerDevisAdmin(db, { statut }) {
  const ordre = statut === 'demande' ? 'd.demande_le ASC, d.id ASC' : 'd.repondu_le DESC, d.id DESC'
  const { rows } = await db.query(`${SELECT_DEVIS} WHERE d.statut = $1 ORDER BY ${ordre} LIMIT 100`, [statut])
  return rows.map((l) => versDevisApi(l, 'admin'))
}

export async function lireDevisAdmin(db, id) {
  const { rows } = await db.query(`${SELECT_DEVIS} WHERE d.id = $1`, [id])
  if (!rows.length) throw introuvable('Devis introuvable.')
  return rows[0]
}

// L'équipe propose un prix ou refuse avec un message. À appeler dans une transaction.
export async function repondreDevis(client, { id, adminId, decision, prix, message, maintenant }) {
  const { rows } = await client.query('SELECT d.statut, a.statut AS app_statut FROM devis d JOIN apps a ON a.id = d.app_id WHERE d.id = $1 FOR UPDATE OF d', [id])
  if (!rows.length) throw introuvable('Devis introuvable.')
  if (rows[0].statut !== 'demande') throw new ErreurHttp(409, 'deja_repondu', { message: 'Ce devis a déjà reçu une réponse.' })
  if (rows[0].app_statut !== 'brouillon') {
    throw new ErreurHttp(409, 'statut_incompatible', { message: 'Cette app a déjà été payée.', statut: rows[0].app_statut })
  }
  await client.query(
    `UPDATE devis SET statut = $2, prix_carte = $3, prix_mobile_money = $4, message = $5, admin_id = $6, repondu_le = $7 WHERE id = $1`,
    [id, decision, prix?.carte ?? null, prix?.mobileMoney ?? null, message || null, adminId, maintenant],
  )
  return lireDevisAdmin(client, id)
}

// Courriel au développeur quand l'équipe répond.
export function messageDevis(ligne, { clientUrl }) {
  const lien = `${clientUrl}/mon-compte/apps/${ligne.app_id}/devis`
  const note = ligne.message ? ['', `Message de l’équipe : ${ligne.message}`] : []
  if (ligne.statut === 'propose') {
    return {
      a: ligne.dev_email,
      sujet: `Votre devis Offre Plus pour « ${ligne.app_nom} »`,
      texte: [
        'Bonjour,',
        '',
        `Voici notre proposition pour tester « ${ligne.app_nom} » avec l’${OFFRE_AFRIQUE.nom} : ${montantLisible(ligne.prix_carte, 'USD')} par carte, ou ${montantLisible(ligne.prix_mobile_money, 'XOF')} par Mobile Money.`,
        ...note,
        '',
        `Voir le devis et payer : ${lien}`,
        '',
        'L’équipe Nakayo',
      ].join('\n'),
    }
  }
  return {
    a: ligne.dev_email,
    sujet: `Votre demande d’Offre Plus pour « ${ligne.app_nom} »`,
    texte: [
      'Bonjour,',
      '',
      `Nous ne pouvons pas proposer l’${OFFRE_AFRIQUE.nom} pour « ${ligne.app_nom} » telle que vous l’avez décrite.`,
      ...note,
      '',
      `Vous pouvez modifier votre besoin, ou choisir l’Offre Standard ou Pro : ${lien}`,
      '',
      'L’équipe Nakayo',
    ].join('\n'),
  }
}
