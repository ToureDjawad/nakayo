import { ErreurHttp } from '../lib/erreurs.js'
import { ABONNEMENT, montantLisible } from '../lib/offres.js'
import { nouvelleReference } from './paiements.js'

// US-45 : abonnement mensuel (docs/abonnement.md). L'état est déduit des mois payés : actif
// jusqu'à l'échéance, en grâce pendant 3 jours, puis suspendu jusqu'au prochain paiement.
const JOUR_MS = 24 * 60 * 60 * 1000
const iso = (d) => d?.toISOString() ?? null

export function moisSuivant(date) {
  const d = new Date(date)
  const jour = d.getUTCDate()
  d.setUTCMonth(d.getUTCMonth() + 1)
  // 31 janvier + 1 mois : fin février, pas début mars.
  if (d.getUTCDate() < jour) d.setUTCDate(0)
  return d
}

async function lireLigne(db, developpeurId) {
  const { rows } = await db.query('SELECT * FROM abonnements WHERE developpeur_id = $1', [developpeurId])
  return rows[0] ?? null
}

// État calculé : null si aucun mois n'a jamais été payé.
export async function etatAbonnement(db, { developpeurId, maintenant }) {
  const ligne = await lireLigne(db, developpeurId)
  if (!ligne) return null
  const { rows: periodes } = await db.query('SELECT * FROM periodes_abonnement WHERE abonnement_id = $1 ORDER BY debut', [ligne.id])
  if (!periodes.length) return null
  const echeance = periodes.at(-1).fin
  const finGrace = new Date(echeance.getTime() + ABONNEMENT.graceJours * JOUR_MS)
  const statut = maintenant < echeance ? 'actif' : maintenant < finGrace ? 'en_grace' : 'suspendu'
  // Mois en cours : le dernier commencé (pendant la grâce, le mois qui vient de finir).
  const courante = [...periodes].reverse().find((p) => p.debut <= maintenant) ?? periodes[0]
  const { rows } = await db.query(
    `SELECT count(*)::int AS n FROM apps WHERE abonnement_id = $1 AND statut <> 'refusee'
        AND abonnement_utilise_le >= $2 AND abonnement_utilise_le < $3`,
    [ligne.id, courante.debut, new Date(courante.fin.getTime() + ABONNEMENT.graceJours * JOUR_MS)],
  )
  const utilisees = rows[0].n
  return {
    id: ligne.id,
    statut,
    periode: { debut: courante.debut, fin: courante.fin },
    echeance,
    finGrace,
    campagnesIncluses: ABONNEMENT.campagnes,
    campagnesUtilisees: utilisees,
    campagnesRestantes: statut === 'suspendu' ? 0 : Math.max(0, ABONNEMENT.campagnes - utilisees),
    renouvelable: maintenant.getTime() >= echeance.getTime() - ABONNEMENT.renouvelableJours * JOUR_MS,
    telephoneRappels: ligne.telephone_rappels,
  }
}

export function versAbonnementApi(e) {
  if (!e) return null
  return {
    statut: e.statut,
    periodeDebut: iso(e.periode.debut),
    periodeFin: iso(e.periode.fin),
    echeance: iso(e.echeance),
    finGrace: iso(e.finGrace),
    campagnesIncluses: e.campagnesIncluses,
    campagnesUtilisees: e.campagnesUtilisees,
    campagnesRestantes: e.campagnesRestantes,
    renouvelable: e.renouvelable,
    telephoneRappels: e.telephoneRappels,
  }
}

export function offreAbonnement() {
  return {
    code: ABONNEMENT.code,
    nom: ABONNEMENT.nom,
    description: ABONNEMENT.description,
    campagnes: ABONNEMENT.campagnes,
    graceJours: ABONNEMENT.graceJours,
    prix: Object.fromEntries(Object.entries(ABONNEMENT.prix).map(([m, p]) => [m, { ...p, lisible: montantLisible(p.montant, p.devise) }])),
  }
}

// Paiement d'un mois. Le renouvellement s'ouvre 7 jours avant l'échéance (ou à tout moment
// une fois l'abonnement suspendu) ; on ne paie pas plusieurs mois d'avance.
export async function creerPaiementAbonnement(client, { developpeurId, moyen, numeroMomo, telephoneRappels, fournisseur, fcfa, maintenant }) {
  const etat = await etatAbonnement(client, { developpeurId, maintenant })
  if (etat && !etat.renouvelable) {
    throw new ErreurHttp(409, 'renouvellement_trop_tot', {
      message: `Le renouvellement s’ouvre ${ABONNEMENT.renouvelableJours} jours avant l’échéance.`,
      echeance: iso(etat.echeance),
    })
  }
  await client.query(
    `INSERT INTO abonnements (developpeur_id, telephone_rappels, cree_le) VALUES ($1, $2, $3)
     ON CONFLICT (developpeur_id) DO UPDATE SET telephone_rappels = COALESCE(EXCLUDED.telephone_rappels, abonnements.telephone_rappels)`,
    [developpeurId, telephoneRappels ?? numeroMomo ?? null, maintenant],
  )
  const { montant, devise } = ABONNEMENT.prix[fcfa ? 'mobile_money' : moyen]
  const { rows } = await client.query(
    `INSERT INTO paiements (reference, app_id, developpeur_id, offre, nature, moyen, montant, devise, fournisseur, numero_momo, cree_le)
     VALUES ($1, NULL, $2, 'standard', 'abonnement', $3, $4, $5, $6, $7, $8) RETURNING *`,
    [nouvelleReference(), developpeurId, moyen, montant, devise, fournisseur, numeroMomo ?? null, maintenant],
  )
  return rows[0]
}

// Appelé à la confirmation d'un paiement d'abonnement (dans sa transaction) : ajoute un mois.
// Payé avant l'échéance ou pendant la grâce, le mois suit le précédent ; sinon il commence maintenant.
export async function ajouterMois(client, { paiement, maintenant }) {
  const { rows } = await client.query('SELECT * FROM abonnements WHERE developpeur_id = $1 FOR UPDATE', [paiement.developpeur_id])
  const ligne = rows[0]
  const { rows: dernieres } = await client.query('SELECT fin FROM periodes_abonnement WHERE abonnement_id = $1 ORDER BY fin DESC LIMIT 1', [ligne.id])
  const derniere = dernieres[0]?.fin
  const continuite = derniere && maintenant.getTime() < derniere.getTime() + ABONNEMENT.graceJours * JOUR_MS
  const debut = continuite ? derniere : maintenant
  const fin = moisSuivant(debut)
  await client.query('INSERT INTO periodes_abonnement (abonnement_id, paiement_id, debut, fin) VALUES ($1, $2, $3, $4)', [ligne.id, paiement.id, debut, fin])
  return { debut, fin }
}

// Une campagne Standard prise sur l'abonnement : l'app passe en vérification sans paiement.
export async function utiliserAbonnement(client, { app, developpeurId, maintenant }) {
  if (app.statut !== 'brouillon') throw new ErreurHttp(409, 'statut_incompatible', { message: 'Cette app est déjà payée.', statut: app.statut })
  await client.query('SELECT 1 FROM abonnements WHERE developpeur_id = $1 FOR UPDATE', [developpeurId])
  const etat = await etatAbonnement(client, { developpeurId, maintenant })
  if (!etat) throw new ErreurHttp(409, 'sans_abonnement', { message: 'Vous n’avez pas d’abonnement.' })
  if (etat.statut === 'suspendu') throw new ErreurHttp(409, 'abonnement_suspendu', { message: 'Votre abonnement est suspendu : renouvelez-le pour continuer.' })
  if (!etat.campagnesRestantes) {
    throw new ErreurHttp(409, 'quota_atteint', { message: `Vos ${ABONNEMENT.campagnes} campagnes du mois sont utilisées.`, echeance: iso(etat.echeance) })
  }
  await client.query(
    `UPDATE apps SET statut = 'en_verification', offre = 'standard', abonnement_id = $2, abonnement_utilise_le = $3, modifie_le = $3 WHERE id = $1`,
    [app.id, etat.id, maintenant],
  )
}

const RAPPELS = {
  j_moins_3: {
    sujet: 'Votre abonnement Nakayo arrive à échéance dans 3 jours',
    texte: (e, prix) => `Votre abonnement arrive à échéance le ${dateFr(e)}. Renouvelez-le (${prix}) pour garder vos 3 campagnes par mois.`,
  },
  jour_j: {
    sujet: 'Votre abonnement Nakayo arrive à échéance aujourd’hui',
    texte: () =>
      `Votre abonnement arrive à échéance aujourd’hui. Vous avez ${ABONNEMENT.graceJours} jours pour le renouveler ; ensuite, il est suspendu. Vos campagnes en cours continuent.`,
  },
  suspension: {
    sujet: 'Votre abonnement Nakayo est suspendu',
    texte: () => 'Votre abonnement n’a pas été renouvelé : il est suspendu. Vos campagnes en cours continuent ; renouvelez-le pour en lancer de nouvelles.',
  },
}
const formatDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Porto-Novo' })
const dateFr = (d) => formatDate.format(d)

// Passage de nuit : rappels par email et SMS 3 jours avant l'échéance, le jour même, puis à la suspension.
export async function envoyerRappelsAbonnements({ pool, emails, sms, config, journal }, { maintenant }) {
  const { rows } = await pool.query(
    `SELECT ab.id, ab.telephone_rappels, u.email, (SELECT max(fin) FROM periodes_abonnement p WHERE p.abonnement_id = ab.id) AS echeance
       FROM abonnements ab JOIN utilisateurs u ON u.id = ab.developpeur_id WHERE u.statut = 'valide'`,
  )
  const prix = `${montantLisible(ABONNEMENT.prix.mobile_money.montant, 'XOF')} ou ${montantLisible(ABONNEMENT.prix.carte.montant, 'USD')}`
  let envoyes = 0
  for (const l of rows) {
    if (!l.echeance) continue
    const t = maintenant.getTime()
    const e = l.echeance.getTime()
    const g = e + ABONNEMENT.graceJours * JOUR_MS
    const type = t >= e - 3 * JOUR_MS && t < e ? 'j_moins_3' : t >= e && t < g ? 'jour_j' : t >= g && t < g + 7 * JOUR_MS ? 'suspension' : null
    if (!type) continue
    const { rowCount } = await pool.query(
      'INSERT INTO rappels_abonnement (abonnement_id, echeance, type, envoye_le) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
      [l.id, l.echeance, type, maintenant],
    )
    if (!rowCount) continue
    const texte = RAPPELS[type].texte(l.echeance, prix)
    try {
      await emails.envoyer({
        a: l.email,
        sujet: RAPPELS[type].sujet,
        texte: ['Bonjour,', '', texte, '', `Votre abonnement : ${config.clientUrl}/mon-compte/abonnement`, '', 'L’équipe Nakayo'].join('\n'),
      })
      if (l.telephone_rappels) await sms.envoyer({ a: l.telephone_rappels, texte: `Nakayo : ${texte}` })
      envoyes++
    } catch (erreur) {
      journal.error(erreur)
    }
  }
  return envoyes
}
