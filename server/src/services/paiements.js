import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { ErreurHttp, introuvable } from '../lib/erreurs.js'
import { montantLisible, OFFRE_STANDARD } from '../lib/offres.js'

// Référence envoyée au fournisseur et lue dans son webhook : PAY-<16 caractères>.
export const nouvelleReference = () => `PAY-${randomBytes(8).toString('hex').toUpperCase()}`

// Signature d'un webhook : HMAC SHA-256 du corps brut, en hexadécimal (docs/api-sprint2.md §2.4).
export function signer(corpsBrut, secret) {
  return createHmac('sha256', secret).update(corpsBrut).digest('hex')
}

export function signatureValide(corpsBrut, entete, secret) {
  if (!secret || typeof entete !== 'string' || !corpsBrut) return false
  const recue = entete.replace(/^sha256=/, '')
  const attendue = signer(corpsBrut, secret)
  if (recue.length !== attendue.length) return false
  return timingSafeEqual(Buffer.from(recue), Buffer.from(attendue))
}

// Objet `paiement` du contrat (§2.1).
export function versPaiementApi(l) {
  return {
    reference: l.reference,
    appId: String(l.app_id),
    appNom: l.app_nom ?? null,
    offre: l.offre,
    moyen: l.moyen,
    montant: l.montant,
    devise: l.devise,
    montantLisible: montantLisible(l.montant, l.devise),
    statut: l.statut,
    facture: l.facture_numero ?? null,
    creeLe: l.cree_le.toISOString(),
    confirmeLe: l.confirme_le?.toISOString() ?? null,
    rembourseLe: l.rembourse_le?.toISOString() ?? null,
  }
}

const SELECT_PAIEMENT = `SELECT p.*, a.nom AS app_nom, f.numero AS facture_numero
  FROM paiements p JOIN apps a ON a.id = p.app_id LEFT JOIN factures f ON f.paiement_id = p.id`

export async function creerPaiement(db, { app, developpeurId, moyen, numeroMomo, fournisseur, maintenant }) {
  if (app.statut !== 'brouillon') {
    throw new ErreurHttp(409, 'statut_incompatible', { message: 'Cette app est déjà payée.', statut: app.statut })
  }
  const { montant, devise } = OFFRE_STANDARD.prix[moyen]
  const { rows } = await db.query(
    `INSERT INTO paiements (reference, app_id, developpeur_id, offre, moyen, montant, devise, fournisseur, numero_momo, cree_le)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
    [nouvelleReference(), app.id, developpeurId, OFFRE_STANDARD.code, moyen, montant, devise, fournisseur, numeroMomo ?? null, maintenant],
  )
  return lirePaiementParId(db, rows[0].id)
}

async function lirePaiementParId(db, id) {
  const { rows } = await db.query(`${SELECT_PAIEMENT} WHERE p.id = $1`, [id])
  return rows[0]
}

export async function lirePaiementDeveloppeur(db, { reference, developpeurId }) {
  const { rows } = await db.query(`${SELECT_PAIEMENT} WHERE p.reference = $1 AND p.developpeur_id = $2`, [reference, developpeurId])
  if (!rows.length) throw introuvable('Paiement introuvable.')
  return rows[0]
}

export async function listerPaiementsDeveloppeur(db, developpeurId) {
  const { rows } = await db.query(`${SELECT_PAIEMENT} WHERE p.developpeur_id = $1 ORDER BY p.cree_le DESC, p.id DESC`, [developpeurId])
  return rows.map(versPaiementApi)
}

// Numéro de facture continu par année, réservé dans la transaction du paiement.
async function prochainNumeroFacture(client, annee) {
  const { rows } = await client.query(
    `INSERT INTO compteurs_factures (annee, dernier) VALUES ($1, 1)
     ON CONFLICT (annee) DO UPDATE SET dernier = compteurs_factures.dernier + 1
     RETURNING dernier`,
    [annee],
  )
  return `NKY-${annee}-${String(rows[0].dernier).padStart(5, '0')}`
}

// Applique la confirmation d'un fournisseur (webhook ou simulation). Idempotent : un paiement
// déjà traité n'est pas modifié. Renvoie { paiement, nouveau } ; `nouveau` vaut true quand le
// paiement vient de réussir (le reçu est alors à envoyer).
export async function confirmerPaiement(client, { reference, statut, referenceFournisseur, maintenant }) {
  const { rows } = await client.query('SELECT * FROM paiements WHERE reference = $1 FOR UPDATE', [reference])
  if (!rows.length) throw introuvable('Paiement introuvable.')
  const paiement = rows[0]
  if (paiement.statut !== 'en_attente') return { paiement: await lirePaiementParId(client, paiement.id), nouveau: false }

  if (statut === 'echoue') {
    await client.query(`UPDATE paiements SET statut = 'echoue', confirme_le = $2, reference_fournisseur = $3 WHERE id = $1`, [
      paiement.id,
      maintenant,
      referenceFournisseur ?? null,
    ])
    return { paiement: await lirePaiementParId(client, paiement.id), nouveau: false }
  }

  // L'app passe en vérification ; si elle a déjà été payée entre-temps, le paiement est un doublon.
  const { rows: apps } = await client.query('SELECT statut FROM apps WHERE id = $1 FOR UPDATE', [paiement.app_id])
  const doublon = apps[0].statut !== 'brouillon'
  await client.query(`UPDATE paiements SET statut = $2, confirme_le = $3, reference_fournisseur = $4 WHERE id = $1`, [
    paiement.id,
    doublon ? 'doublon' : 'reussi',
    maintenant,
    referenceFournisseur ?? null,
  ])
  if (doublon) return { paiement: await lirePaiementParId(client, paiement.id), nouveau: false }

  await client.query(`UPDATE apps SET statut = 'en_verification', modifie_le = $2 WHERE id = $1`, [paiement.app_id, maintenant])
  const { rows: devs } = await client.query('SELECT nom, email, pays FROM utilisateurs WHERE id = $1', [paiement.developpeur_id])
  const numero = await prochainNumeroFacture(client, maintenant.getUTCFullYear())
  const { rows: appNom } = await client.query('SELECT nom FROM apps WHERE id = $1', [paiement.app_id])
  await client.query(
    `INSERT INTO factures (numero, paiement_id, developpeur_id, client_nom, client_email, client_pays, libelle, montant, devise, emise_le)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      numero,
      paiement.id,
      paiement.developpeur_id,
      devs[0].nom,
      devs[0].email,
      devs[0].pays,
      `${OFFRE_STANDARD.nom} : campagne de test pour « ${appNom[0].nom} »`,
      paiement.montant,
      paiement.devise,
      maintenant,
    ],
  )
  return { paiement: await lirePaiementParId(client, paiement.id), nouveau: true, email: devs[0].email }
}

// Reçu envoyé par email après un paiement réussi.
export function messageRecu(paiement, { email, clientUrl }) {
  return {
    a: email,
    sujet: `Reçu de paiement Nakayo ${paiement.facture_numero}`,
    texte: [
      'Bonjour,',
      '',
      `Nous avons bien reçu votre paiement de ${montantLisible(paiement.montant, paiement.devise)} pour l’${OFFRE_STANDARD.nom} (app « ${paiement.app_nom} »).`,
      `Facture : ${paiement.facture_numero}`,
      `Référence du paiement : ${paiement.reference}`,
      '',
      'Notre équipe vérifie maintenant votre app avant de lancer la campagne. Vous recevrez un email dès que c’est fait.',
      '',
      `Vos factures : ${clientUrl}/mon-compte/paiements`,
      '',
      'L’équipe Nakayo',
    ].join('\n'),
  }
}
