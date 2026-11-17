import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { ErreurHttp, introuvable } from '../lib/erreurs.js'
import { ABONNEMENT, montantLisible, offre as lireOffre, prixMonteeEnGamme } from '../lib/offres.js'
import { ajouterMois } from './abonnements.js'

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
    // null pour un mois d'abonnement (US-45).
    appId: l.app_id ? String(l.app_id) : null,
    appNom: l.app_nom ?? null,
    offre: l.offre,
    // « offre » : achat de l'offre ; « montee_en_gamme » : passage de Standard à Pro (US-32).
    nature: l.nature,
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
  FROM paiements p LEFT JOIN apps a ON a.id = p.app_id LEFT JOIN factures f ON f.paiement_id = p.id`

// Prix à payer : l'offre entière pour une app en brouillon, la différence pour une montée en gamme.
// `fcfa` : le fournisseur n'encaisse qu'en FCFA (FedaPay) ; la carte est alors débitée du prix Mobile Money.
// `prix` : prix d'un devis (Offre Plus, US-37), à la place de celui de l'offre.
export function prixAPayer({ offre, nature, moyen, fcfa, prix = null }) {
  const moyenPrix = fcfa ? 'mobile_money' : moyen
  if (prix) return prix[moyenPrix]
  return nature === 'montee_en_gamme' ? prixMonteeEnGamme(moyenPrix, offre) : lireOffre(offre).prix[moyenPrix]
}

export async function creerPaiement(db, { app, developpeurId, offre = 'standard', nature = 'offre', moyen, numeroMomo, prix, fournisseur, fcfa, maintenant }) {
  if (nature === 'offre' && app.statut !== 'brouillon') {
    throw new ErreurHttp(409, 'statut_incompatible', { message: 'Cette app est déjà payée.', statut: app.statut })
  }
  const { montant, devise } = prixAPayer({ offre, nature, moyen, fcfa, prix })
  const { rows } = await db.query(
    `INSERT INTO paiements (reference, app_id, developpeur_id, offre, nature, moyen, montant, devise, fournisseur, numero_momo, cree_le)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
    [nouvelleReference(), app.id, developpeurId, offre, nature, moyen, montant, devise, fournisseur, numeroMomo ?? null, maintenant],
  )
  return lirePaiementParId(db, rows[0].id)
}

// Identifiant de la transaction chez le fournisseur, pour relire son statut et rapprocher ses webhooks.
export async function enregistrerReferenceFournisseur(db, { reference, referenceFournisseur }) {
  await db.query('UPDATE paiements SET reference_fournisseur = $2 WHERE reference = $1', [reference, referenceFournisseur])
}

// Fournisseur injoignable à la création : le paiement n'a jamais commencé.
export async function marquerPaiementEchoue(db, { reference, maintenant }) {
  await db.query(`UPDATE paiements SET statut = 'echoue', confirme_le = $2 WHERE reference = $1 AND statut = 'en_attente'`, [reference, maintenant])
}

// Retrouve notre référence (PAY-…) à partir de celle du fournisseur (webhook sans métadonnées).
export async function referenceDepuisFournisseur(db, { fournisseur, referenceFournisseur }) {
  const { rows } = await db.query('SELECT reference FROM paiements WHERE fournisseur = $1 AND reference_fournisseur = $2', [
    fournisseur,
    referenceFournisseur,
  ])
  return rows[0]?.reference ?? null
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

  // US-45 : un mois d'abonnement de plus, avec sa facture.
  if (paiement.nature === 'abonnement') {
    await client.query(`UPDATE paiements SET statut = 'reussi', confirme_le = $2, reference_fournisseur = $3 WHERE id = $1`, [
      paiement.id,
      maintenant,
      referenceFournisseur ?? null,
    ])
    const { debut, fin } = await ajouterMois(client, { paiement, maintenant })
    const { rows: devs } = await client.query('SELECT nom, email, pays FROM utilisateurs WHERE id = $1', [paiement.developpeur_id])
    const date = (d) => d.toISOString().slice(0, 10).split('-').reverse().join('/')
    await client.query(
      `INSERT INTO factures (numero, paiement_id, developpeur_id, client_nom, client_email, client_pays, libelle, montant, devise, emise_le)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        await prochainNumeroFacture(client, maintenant.getUTCFullYear()),
        paiement.id,
        paiement.developpeur_id,
        devs[0].nom,
        devs[0].email,
        devs[0].pays,
        `${ABONNEMENT.nom} : ${ABONNEMENT.campagnes} campagnes Standard, du ${date(debut)} au ${date(fin)}`,
        paiement.montant,
        paiement.devise,
        maintenant,
      ],
    )
    return { paiement: await lirePaiementParId(client, paiement.id), nouveau: true, email: devs[0].email }
  }

  // Achat : l'app passe en vérification avec son offre. Montée en gamme : l'app passe en Pro.
  // Si c'est déjà fait entre-temps, le paiement est un doublon (à rembourser).
  const { rows: apps } = await client.query('SELECT statut, offre FROM apps WHERE id = $1 FOR UPDATE', [paiement.app_id])
  const montee = paiement.nature === 'montee_en_gamme'
  const doublon = montee ? apps[0].offre === paiement.offre : apps[0].statut !== 'brouillon'
  await client.query(`UPDATE paiements SET statut = $2, confirme_le = $3, reference_fournisseur = $4 WHERE id = $1`, [
    paiement.id,
    doublon ? 'doublon' : 'reussi',
    maintenant,
    referenceFournisseur ?? null,
  ])
  if (doublon) return { paiement: await lirePaiementParId(client, paiement.id), nouveau: false }

  if (montee) {
    await client.query('UPDATE apps SET offre = $2, modifie_le = $3 WHERE id = $1', [paiement.app_id, paiement.offre, maintenant])
  } else {
    await client.query(`UPDATE apps SET statut = 'en_verification', offre = $2, modifie_le = $3 WHERE id = $1`, [
      paiement.app_id,
      paiement.offre,
      maintenant,
    ])
  }
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
      montee
        ? `Passage à l’${lireOffre(paiement.offre).nom} pour « ${appNom[0].nom} » (différence de prix)`
        : `${lireOffre(paiement.offre).nom} : campagne de test pour « ${appNom[0].nom} »`,
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
      paiement.nature === 'abonnement'
        ? `Nous avons bien reçu votre paiement de ${montantLisible(paiement.montant, paiement.devise)} pour un mois d’${ABONNEMENT.nom} (${ABONNEMENT.campagnes} campagnes Standard).`
        : paiement.nature === 'montee_en_gamme'
        ? `Nous avons bien reçu votre paiement de ${montantLisible(paiement.montant, paiement.devise)} pour passer l’app « ${paiement.app_nom} » à l’${lireOffre(paiement.offre).nom}.`
        : `Nous avons bien reçu votre paiement de ${montantLisible(paiement.montant, paiement.devise)} pour l’${lireOffre(paiement.offre).nom} (app « ${paiement.app_nom} »).`,
      `Facture : ${paiement.facture_numero}`,
      `Référence du paiement : ${paiement.reference}`,
      '',
      paiement.nature === 'abonnement'
        ? 'Choisissez « Utiliser mon abonnement » au moment de lancer chaque app.'
        : paiement.nature === 'montee_en_gamme'
        ? 'Votre app profite dès maintenant de l’offre Pro : rapports de bugs et testeurs les mieux notés pour les prochains remplacements.'
        : 'Notre équipe vérifie maintenant votre app avant de lancer la campagne. Vous recevrez un email dès que c’est fait.',
      '',
      `Vos factures : ${clientUrl}/mon-compte/paiements`,
      '',
      'L’équipe Nakayo',
    ].join('\n'),
  }
}
