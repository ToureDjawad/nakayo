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
