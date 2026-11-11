import { hacherMotDePasse } from '../lib/motsDePasse.js'
import { normaliserEmail, texte, validerEmail, validerMotDePasse } from '../lib/validation.js'

// Crée un compte admin déjà validé, email vérifié (réponse à la question ouverte n° 2).
// Si l'email existe déjà avec le rôle admin, met à jour le mot de passe.
export async function creerAdmin(pool, { email, nom, motDePasse, maintenant = new Date() }) {
  const emailPropre = normaliserEmail(email)
  const nomPropre = texte(nom) || 'Administration Nakayo'
  const erreurs = {
    email: validerEmail(emailPropre),
    motDePasse: validerMotDePasse(motDePasse),
    nom: nomPropre.length < 2 || nomPropre.length > 80 ? 'longueur' : null,
  }
  const enErreur = Object.entries(erreurs).filter(([, code]) => code)
  if (enErreur.length) {
    throw new Error(`Champs invalides : ${enErreur.map(([champ, code]) => `${champ} (${code})`).join(', ')}`)
  }

  const empreinte = await hacherMotDePasse(motDePasse)
  const { rows: existants } = await pool.query('SELECT id, role FROM utilisateurs WHERE email = $1', [emailPropre])
  if (existants.length && existants[0].role !== 'admin') {
    throw new Error(`L'adresse ${emailPropre} appartient déjà à un compte ${existants[0].role}.`)
  }
  if (existants.length) {
    await pool.query('UPDATE utilisateurs SET mot_de_passe_hash = $2, nom = $3, modifie_le = $4 WHERE id = $1', [
      existants[0].id,
      empreinte,
      nomPropre,
      maintenant,
    ])
    return { id: String(existants[0].id), cree: false }
  }
  const { rows } = await pool.query(
    `INSERT INTO utilisateurs (email, mot_de_passe_hash, role, statut, nom, email_verifie_le, cree_le, modifie_le)
     VALUES ($1, $2, 'admin', 'valide', $3, $4, $4, $4) RETURNING id`,
    [emailPropre, empreinte, nomPropre, maintenant],
  )
  return { id: String(rows[0].id), cree: true }
}
