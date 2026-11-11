import { rm } from 'node:fs/promises'
import path from 'node:path'
import { deflateSync } from 'node:zlib'
import { hacherMotDePasse } from '../lib/motsDePasse.js'
import { normaliserGmail } from '../lib/testeurs.js'
import { executerControles } from './controles.js'
import { ecrireDocument } from './documents.js'
import { enregistrerAppareil } from './testeurs.js'

// Comptes de démonstration pour essayer le site en local. Jamais en production.
// Les identifiants sont repris dans le README (section « Comptes de démonstration »).
export const MOT_DE_PASSE_DEMO = 'nakayo-demo-2026'
export const DOMAINE_DEMO = '@nakayo.test'

const MOTIF_REFUS_DEMO =
  'La fiche Google Play indiquée ne correspond pas au nom de développeur. Vous pouvez recréer un compte avec le bon lien.'

export const COMPTES_DEMO = [
  { email: `admin${DOMAINE_DEMO}`, role: 'admin', statut: 'valide', nom: 'Administration Nakayo' },
  { email: `dev.valide${DOMAINE_DEMO}`, role: 'developpeur', statut: 'valide', nom: 'Studio Awa' },
  { email: `dev.attente${DOMAINE_DEMO}`, role: 'developpeur', statut: 'en_attente', nom: 'Atelier Kpakpa' },
  {
    email: `dev.refuse${DOMAINE_DEMO}`,
    role: 'developpeur',
    statut: 'refuse',
    nom: 'Lagune Apps',
    motifRefus: MOTIF_REFUS_DEMO,
  },
  {
    email: `dev.nonverifie${DOMAINE_DEMO}`,
    role: 'developpeur',
    statut: 'en_attente',
    nom: 'Ganvié Mobile',
    emailNonVerifie: true,
  },
]

export const TESTEURS_DEMO = [
  {
    telephone: '+2290197100001',
    nom: 'Koffi Agbo',
    ville: 'Cotonou',
    gmail: 'koffi.agbo.demo@gmail.com',
    numeroMomo: '+2290196100001',
    operateurMomo: 'mtn',
    appareil: { fabricant: 'Tecno', modele: 'Spark 20', versionAndroid: '14', niveauApi: 34, identifiant: 'demo-appareil-1' },
    couleur: [214, 228, 240],
  },
  {
    telephone: '+2290197100002',
    nom: 'Aïcha Dossou',
    ville: 'Porto-Novo',
    gmail: 'aicha.dossou.demo@gmail.com',
    numeroMomo: '+2290196100002',
    operateurMomo: 'moov',
    appareil: { fabricant: 'Samsung', modele: 'Galaxy A15', versionAndroid: '14', niveauApi: 34, identifiant: 'demo-appareil-2' },
    couleur: [232, 222, 206],
  },
  {
    telephone: '+2290197100003',
    nom: 'Romuald Hounkpè',
    ville: 'Parakou',
    gmail: 'romuald.hounkpe.demo@gmail.com',
    numeroMomo: '+2290196100003',
    operateurMomo: 'mtn',
    // Même appareil que le premier testeur : le contrôle « appareil partagé » le signale.
    appareil: { fabricant: 'Tecno', modele: 'Spark 20', versionAndroid: '14', niveauApi: 34, identifiant: 'demo-appareil-1' },
    couleur: [220, 236, 222],
  },
]

const JOUR = 24 * 3600 * 1000

// Image PNG unie, pour que l'admin voie de vraies photos dans le back-office.
export function pngUni(largeur, hauteur, [r, v, b]) {
  const ligne = Buffer.alloc(1 + largeur * 3)
  for (let x = 0; x < largeur; x++) ligne.set([r, v, b], 1 + x * 3)
  const brut = Buffer.concat(Array.from({ length: hauteur }, () => ligne))
  const entete = Buffer.alloc(13)
  entete.writeUInt32BE(largeur, 0)
  entete.writeUInt32BE(hauteur, 4)
  entete.set([8, 2, 0, 0, 0], 8)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloc('IHDR', entete),
    bloc('IDAT', deflateSync(brut)),
    bloc('IEND', Buffer.alloc(0)),
  ])
}

function bloc(type, donnees) {
  const longueur = Buffer.alloc(4)
  longueur.writeUInt32BE(donnees.length)
  const corps = Buffer.concat([Buffer.from(type, 'ascii'), donnees])
  const somme = Buffer.alloc(4)
  somme.writeUInt32BE(crc32(corps))
  return Buffer.concat([longueur, corps, somme])
}

function crc32(octets) {
  let crc = 0xffffffff
  for (const octet of octets) {
    crc ^= octet
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

async function supprimerDemo(pool, dossierDocuments) {
  const { rows } = await pool.query(
    'SELECT id FROM utilisateurs WHERE email LIKE $1 OR telephone = ANY($2)',
    [`%${DOMAINE_DEMO}`, TESTEURS_DEMO.map((t) => t.telephone)],
  )
  const ids = rows.map((r) => r.id)
  if (!ids.length) return
  await pool.query('DELETE FROM decisions_comptes WHERE admin_id = ANY($1)', [ids])
  await pool.query('UPDATE utilisateurs SET decide_par = NULL WHERE decide_par = ANY($1)', [ids])
  await pool.query('DELETE FROM utilisateurs WHERE id = ANY($1)', [ids])
  await Promise.all(ids.map((id) => rm(path.join(dossierDocuments, String(id)), { recursive: true, force: true })))
}

// Recrée les comptes de démonstration (les anciens sont supprimés avant). Idempotent.
export async function remplirDemo(pool, { dossierDocuments, maintenant = new Date(), parametresHachage } = {}) {
  await supprimerDemo(pool, dossierDocuments)
  const empreinte = await hacherMotDePasse(MOT_DE_PASSE_DEMO, parametresHachage)
  const ids = {}

  for (const [i, compte] of COMPTES_DEMO.entries()) {
    const creeLe = new Date(maintenant.getTime() - (i + 1) * JOUR)
    const { rows } = await pool.query(
      `INSERT INTO utilisateurs (email, mot_de_passe_hash, role, statut, nom, pays, lien_fiche_developpeur,
                                 email_verifie_le, motif_refus, cree_le, modifie_le)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10) RETURNING id`,
      [
        compte.email,
        empreinte,
        compte.role,
        compte.statut,
        compte.nom,
        compte.role === 'developpeur' ? 'BJ' : null,
        compte.role === 'developpeur'
          ? `https://play.google.com/store/apps/dev?id=${8000000000000000000n + BigInt(i)}`
          : null,
        compte.emailNonVerifie ? null : creeLe,
        compte.motifRefus ?? null,
        creeLe,
      ],
    )
    ids[compte.email] = rows[0].id
  }

  const admin = ids[`admin${DOMAINE_DEMO}`]
  for (const compte of COMPTES_DEMO.filter((c) => c.role !== 'admin' && c.statut !== 'en_attente')) {
    await pool.query('UPDATE utilisateurs SET decide_par = $2, decide_le = $3 WHERE id = $1', [
      ids[compte.email],
      admin,
      maintenant,
    ])
    await pool.query(
      'INSERT INTO decisions_comptes (utilisateur_id, admin_id, decision, motif, cree_le) VALUES ($1, $2, $3, $4, $5)',
      [ids[compte.email], admin, compte.statut, compte.motifRefus ?? null, maintenant],
    )
  }

  const testeurs = []
  for (const [i, t] of TESTEURS_DEMO.entries()) {
    const creeLe = new Date(maintenant.getTime() - (i + 1) * 0.5 * JOUR - JOUR)
    const { rows } = await pool.query(
      `INSERT INTO utilisateurs (role, statut, nom, telephone, telephone_verifie_le, cree_le, modifie_le)
       VALUES ('testeur', 'en_attente', $1, $2, $3, $3, $3) RETURNING id`,
      [t.nom, t.telephone, creeLe],
    )
    const id = rows[0].id
    testeurs.push(id)
    await pool.query(
      `INSERT INTO profils_testeurs (utilisateur_id, ville, gmail, gmail_normalise, numero_momo, operateur_momo,
                                     langues, consentement_suivi_le, conditions_acceptees_le)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
      [id, t.ville, t.gmail, normaliserGmail(t.gmail), t.numeroMomo, t.operateurMomo, ['fr'], creeLe],
    )
    await enregistrerAppareil(pool, { utilisateurId: id, appareil: t.appareil, maintenant: creeLe })
    for (const [type, [largeur, hauteur]] of [
      ['piece_identite', [480, 300]],
      ['selfie', [300, 400]],
    ]) {
      const contenu = pngUni(largeur, hauteur, t.couleur)
      const chemin = await ecrireDocument(dossierDocuments, { utilisateurId: id, type, typeMime: 'image/png', contenu })
      await pool.query(
        `INSERT INTO documents_identite (utilisateur_id, type, chemin, type_mime, taille_octets, cree_le)
         VALUES ($1, $2, $3, 'image/png', $4, $5)`,
        [id, type, chemin, contenu.length, creeLe],
      )
    }
  }

  // Contrôles automatiques des comptes en attente, sans appel réseau (fiches Google Play fictives).
  for (const id of [ids[`dev.attente${DOMAINE_DEMO}`], ids[`dev.nonverifie${DOMAINE_DEMO}`], ...testeurs]) {
    await executerControles(pool, id, { maintenant: () => maintenant, reseau: false })
  }

  return { comptes: COMPTES_DEMO.length, testeurs: testeurs.length }
}
