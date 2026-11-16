import { ErreurHttp, introuvable } from '../lib/erreurs.js'

// US-29 : sanctions des comptes (docs/sanctions.md) et journal des actions admin.

// Transitions permises : action -> statuts de départ et statut d'arrivée.
export const SANCTIONS = {
  suspension: { depuis: ['valide'], vers: 'suspendu', decision: 'suspendu' },
  bannissement: { depuis: ['valide', 'suspendu'], vers: 'banni', decision: 'banni' },
  reactivation: { depuis: ['suspendu', 'banni'], vers: 'valide', decision: 'reactive' },
}

export const LIBELLES_ACTIONS = {
  compte_valide: 'Compte validé',
  compte_refuse: 'Compte refusé',
  compte_suspendu: 'Compte suspendu',
  compte_banni: 'Compte banni',
  compte_reactive: 'Compte réactivé',
  app_validee: 'App validée',
  app_refusee: 'App refusée',
  testeur_remplace: 'Testeur remplacé',
  versement_relance: 'Versement relancé',
  alerte_confirmee: 'Alerte de fraude confirmée',
  alerte_ecartee: 'Alerte de fraude écartée',
}

export async function journaliser(db, { adminId, action, cible, cibleId, detail = null, maintenant }) {
  await db.query('INSERT INTO journal_admin (admin_id, action, cible, cible_id, detail, cree_le) VALUES ($1, $2, $3, $4, $5, $6)', [
    adminId,
    action,
    cible,
    String(cibleId),
    detail,
    maintenant,
  ])
}

const PAR_PAGE = 30

export async function lireJournal(db, { page = 1 }) {
  const { rows } = await db.query(
    `SELECT j.*, a.nom AS admin_nom, count(*) OVER ()::int AS total
       FROM journal_admin j JOIN utilisateurs a ON a.id = j.admin_id
      ORDER BY j.cree_le DESC, j.id DESC LIMIT $1 OFFSET $2`,
    [PAR_PAGE, (page - 1) * PAR_PAGE],
  )
  return {
    actions: rows.map((l) => ({
      id: String(l.id),
      action: l.action,
      libelle: LIBELLES_ACTIONS[l.action] ?? l.action,
      cible: { type: l.cible, id: l.cible_id },
      detail: l.detail,
      admin: { id: String(l.admin_id), nom: l.admin_nom },
      le: l.cree_le.toISOString(),
    })),
    total: rows[0]?.total ?? 0,
    page,
    parPage: PAR_PAGE,
  }
}

// Applique une sanction dans une transaction. Le compte est déconnecté partout ; un bannissement
// bloque son numéro, son Mobile Money, ses téléphones et son email ; une réactivation les débloque.
export async function sanctionner(client, { id, action, motif, adminId, maintenant }) {
  const regle = SANCTIONS[action]
  const { rows } = await client.query(
    `SELECT u.id, u.role, u.statut, u.nom, u.email, u.telephone, p.numero_momo
       FROM utilisateurs u LEFT JOIN profils_testeurs p ON p.utilisateur_id = u.id
      WHERE u.id = $1 AND u.role <> 'admin' FOR UPDATE OF u`,
    [id],
  )
  const compte = rows[0]
  if (!compte) throw introuvable('Compte introuvable.')
  if (!regle.depuis.includes(compte.statut)) {
    throw new ErreurHttp(409, 'statut_incompatible', { message: 'Cette action n’est pas possible pour ce compte.', statut: compte.statut })
  }
  await client.query(
    `UPDATE utilisateurs SET statut = $2, motif_sanction = $3, modifie_le = $4 WHERE id = $1`,
    [id, regle.vers, regle.vers === 'valide' ? null : motif, maintenant],
  )
  await client.query('INSERT INTO decisions_comptes (utilisateur_id, admin_id, decision, motif, cree_le) VALUES ($1, $2, $3, $4, $5)', [
    id,
    adminId,
    regle.decision,
    motif,
    maintenant,
  ])
  if (regle.vers !== 'valide') await client.query('DELETE FROM sessions WHERE utilisateur_id = $1', [id])

  if (action === 'bannissement') {
    const { rows: appareils } = await client.query('SELECT DISTINCT identifiant FROM appareils WHERE utilisateur_id = $1', [id])
    const valeurs = [
      ['telephone', compte.telephone],
      ['momo', compte.numero_momo],
      ['email', compte.email],
      ...appareils.map((a) => ['appareil', a.identifiant]),
    ].filter(([, v]) => v)
    for (const [type, valeur] of valeurs) {
      await client.query('INSERT INTO blocages (type, valeur, utilisateur_id, cree_le) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', [
        type,
        valeur,
        id,
        maintenant,
      ])
    }
  }
  if (action === 'reactivation') await client.query('DELETE FROM blocages WHERE utilisateur_id = $1', [id])

  await journaliser(client, { adminId, action: `compte_${regle.decision}`, cible: 'compte', cibleId: id, detail: motif, maintenant })
  return compte
}

// Un nouveau compte ne peut pas reprendre un numéro, un Mobile Money, un téléphone ou un email bannis.
export async function exigerNonBloque(db, valeurs) {
  const liste = Object.entries(valeurs).filter(([, v]) => v)
  if (!liste.length) return
  const { rows } = await db.query(
    `SELECT 1 FROM blocages b JOIN unnest($1::text[], $2::text[]) AS v(type, valeur) ON v.type = b.type AND v.valeur = b.valeur LIMIT 1`,
    [liste.map(([t]) => t), liste.map(([, v]) => v)],
  )
  if (rows.length) throw new ErreurHttp(403, 'compte_bloque', { message: 'Inscription impossible : ces informations sont liées à un compte banni.' })
}

export function messageSanction(compte, { action, motif }) {
  const textes = {
    suspension: `Votre compte Nakayo est suspendu. Motif : ${motif} Vos gains sont bloqués le temps de l’examen. Pour en parler, contactez le support.`,
    bannissement: `Votre compte Nakayo est fermé définitivement. Motif : ${motif}`,
    reactivation: 'Votre compte Nakayo est de nouveau actif. Vous pouvez vous reconnecter.',
  }
  if (compte.role === 'testeur') return { canal: 'sms', a: compte.telephone, texte: `Nakayo : ${textes[action]}` }
  return {
    canal: 'emails',
    a: compte.email,
    sujet: { suspension: 'Votre compte Nakayo est suspendu', bannissement: 'Votre compte Nakayo est fermé', reactivation: 'Votre compte Nakayo est réactivé' }[action],
    texte: ['Bonjour,', '', textes[action], '', 'L’équipe Nakayo'].join('\n'),
  }
}
