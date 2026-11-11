import { hacherMotDePasse } from '../src/lib/motsDePasse.js'
import { pool } from '../src/db/pool.js'

// Paramètres scrypt allégés pour les comptes de test : le format stocké garde les
// paramètres, la vérification marche donc comme en production, en plus rapide.
const SCRYPT_RAPIDE = { N: 2 ** 10, r: 8, p: 1 }

let compteur = 0

// Insère un utilisateur directement en base. Par défaut : développeur, email vérifié.
export async function creerUtilisateur({
  email = `dev${++compteur}@studio.bj`,
  motDePasse = 'motdepasse-valide',
  role = 'developpeur',
  statut = 'en_attente',
  nom = 'Studio Awa',
  pays = 'BJ',
  emailVerifie = true,
  motifRefus = null,
  telephone = null,
} = {}) {
  const empreinte = motDePasse ? await hacherMotDePasse(motDePasse, SCRYPT_RAPIDE) : null
  const { rows } = await pool.query(
    `INSERT INTO utilisateurs (email, mot_de_passe_hash, role, statut, nom, pays, email_verifie_le, motif_refus, telephone)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [email, empreinte, role, statut, nom, pays, emailVerifie ? new Date() : null, motifRefus, telephone],
  )
  return { ...rows[0], motDePasse }
}

// Extrait la valeur du cookie de session d'une réponse Supertest.
export function cookieSession(reponse) {
  const entete = (reponse.headers['set-cookie'] ?? []).find((c) => c.startsWith('nakayo_session='))
  return entete ? entete.split(';')[0] : null
}

export const APPAREIL = {
  fabricant: 'Tecno',
  modele: 'Spark 20',
  versionAndroid: '14',
  niveauApi: 34,
  identifiant: 'app-8f3c2b1a9d',
}

// Petites images valides (en-têtes JPEG et PNG suffisent pour la détection du type).
export const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)])
export const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 2)])

export const FORMULAIRE_TESTEUR = {
  nom: 'Koffi Agbo',
  ville: 'Cotonou',
  gmail: 'koffi.agbo@gmail.com',
  numeroMomo: '+2290196000000',
  operateurMomo: 'mtn',
  consentementSuivi: 'true',
  accepteConditions: 'true',
}

// Testeur inscrit directement en base, avec une session Android ouverte.
export async function creerTesteur({
  telephone = '+2290197000000',
  nom = 'Koffi Agbo',
  gmail = 'koffi.agbo@gmail.com',
  numeroMomo = '+2290196000000',
  operateurMomo = 'mtn',
  statut = 'en_attente',
  appareil = APPAREIL,
} = {}) {
  const { ouvrirSession } = await import('../src/services/sessions.js')
  const { enregistrerAppareil } = await import('../src/services/testeurs.js')
  const { normaliserGmail } = await import('../src/lib/testeurs.js')
  const { rows } = await pool.query(
    `INSERT INTO utilisateurs (role, statut, nom, telephone, telephone_verifie_le)
     VALUES ('testeur', $1, $2, $3, now()) RETURNING id`,
    [statut, nom, telephone],
  )
  const id = rows[0].id
  await pool.query(
    `INSERT INTO profils_testeurs (utilisateur_id, ville, gmail, gmail_normalise, numero_momo, operateur_momo,
                                   consentement_suivi_le, conditions_acceptees_le)
     VALUES ($1, 'Cotonou', $2, $3, $4, $5, now(), now())`,
    [id, gmail, normaliserGmail(gmail), numeroMomo, operateurMomo],
  )
  if (appareil) await enregistrerAppareil(pool, { utilisateurId: id, appareil, maintenant: new Date() })
  const { jeton } = await ouvrirSession(pool, { utilisateurId: id, client: 'android', maintenant: new Date() })
  return { id: String(id), jeton }
}
