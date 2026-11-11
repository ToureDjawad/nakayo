import { Router } from 'express'
import { ErreurHttp } from '../lib/erreurs.js'
import { consommerEnvoiEmail } from '../lib/limitesApi.js'
import { hacherMotDePasse } from '../lib/motsDePasse.js'
import { COLONNES_UTILISATEUR, versUtilisateurApi } from '../lib/utilisateurs.js'
import {
  corps,
  exigerChamps,
  normaliserEmail,
  normaliserLienFiche,
  texte,
  validerEmail,
  validerLienFiche,
  validerMotDePasse,
  validerNom,
  validerPays,
} from '../lib/validation.js'
import { ouvrirSession } from '../services/sessions.js'
import { consommerJetonEmail, creerJetonEmail, poserCookieSession, transaction } from './auth.js'

const DUREE_VERIFICATION_MS = 24 * 60 * 60 * 1000

const conflit = (champs) => new ErreurHttp(409, 'conflit', { message: 'Valeur déjà utilisée.', champs })

// Contraintes d'unicité de la base et champ de l'API correspondant.
const CONTRAINTES = {
  utilisateurs_email_key: 'email',
  utilisateurs_fiche_unique: 'lienFicheDeveloppeur',
}

export function routesInscription(deps) {
  const { pool, config, emails, limites, maintenant, journal } = deps
  const routeur = Router()

  async function envoyerVerification(db, { utilisateurId, email, instant }) {
    const jeton = await creerJetonEmail(db, {
      utilisateurId,
      type: 'verification_email',
      dureeMs: DUREE_VERIFICATION_MS,
      maintenant: instant,
    })
    const lien = `${config.clientUrl}/verification-email?jeton=${jeton}`
    return {
      a: email,
      sujet: 'Confirmez votre adresse email Nakayo',
      texte: [
        'Bonjour,',
        '',
        'Pour terminer votre inscription sur Nakayo, confirmez votre adresse email avec ce lien, valable 24 heures :',
        lien,
        '',
        "Votre compte sera ensuite vérifié par notre équipe avant de pouvoir publier une campagne de test.",
        "Si vous n'avez pas créé de compte, ignorez cet email.",
      ].join('\n'),
      lien,
    }
  }

  // L'inscription réussit même si l'envoi échoue : le front propose « Renvoyer l'email ».
  async function envoyerSansBloquer(message) {
    try {
      await emails.envoyer(message)
    } catch (erreur) {
      journal.error(erreur)
    }
  }

  // §2.1 Inscription d'un développeur.
  routeur.post('/inscription', async (req, res) => {
    const donnees = corps(req)
    const email = normaliserEmail(donnees.email)
    const nom = texte(donnees.nom)
    const pays = texte(donnees.pays).toUpperCase()
    const lienFicheDeveloppeur = normaliserLienFiche(donnees.lienFicheDeveloppeur)
    exigerChamps({
      email: validerEmail(email),
      motDePasse: validerMotDePasse(donnees.motDePasse),
      nom: validerNom(nom),
      pays: validerPays(pays),
      lienFicheDeveloppeur: validerLienFiche(lienFicheDeveloppeur),
      accepteConditions: donnees.accepteConditions === true ? null : 'doit_etre_accepte',
    })

    limites.inscriptionIp.verifier(req.ip)

    // Contrôle préalable pour signaler tous les doublons d'un coup ; la base reste la garde.
    const { rows: doublons } = await pool.query(
      `SELECT email = $1 AS email, lien_fiche_developpeur = $2 AND statut <> 'refuse' AS fiche
         FROM utilisateurs WHERE email = $1 OR (lien_fiche_developpeur = $2 AND statut <> 'refuse')`,
      [email, lienFicheDeveloppeur],
    )
    const champsConflit = {}
    if (doublons.some((d) => d.email)) champsConflit.email = 'deja_utilise'
    if (doublons.some((d) => d.fiche)) champsConflit.lienFicheDeveloppeur = 'deja_utilise'
    if (Object.keys(champsConflit).length) throw conflit(champsConflit)

    const empreinte = await hacherMotDePasse(donnees.motDePasse)
    const instant = maintenant()
    let resultat
    try {
      resultat = await transaction(pool, async (client) => {
        const { rows } = await client.query(
          `INSERT INTO utilisateurs AS u (email, mot_de_passe_hash, role, statut, nom, pays, lien_fiche_developpeur,
                                          cree_le, modifie_le)
           VALUES ($1, $2, 'developpeur', 'en_attente', $3, $4, $5, $6, $6)
           RETURNING ${COLONNES_UTILISATEUR}`,
          [email, empreinte, nom, pays, lienFicheDeveloppeur, instant],
        )
        const message = await envoyerVerification(client, { utilisateurId: rows[0].id, email, instant })
        return { utilisateur: rows[0], message }
      })
    } catch (erreur) {
      // Deux inscriptions simultanées avec le même email ou la même fiche.
      if (erreur.code === '23505' && CONTRAINTES[erreur.constraint]) {
        throw conflit({ [CONTRAINTES[erreur.constraint]]: 'deja_utilise' })
      }
      throw erreur
    }

    limites.inscriptionIp.compter(req.ip)
    await envoyerSansBloquer(resultat.message)
    res.status(201).json({ utilisateur: versUtilisateurApi(resultat.utilisateur) })
  })

  // §2.2 Lien de vérification : confirme l'email et ouvre une session web.
  routeur.post('/verification-email', async (req, res) => {
    const instant = maintenant()
    const utilisateur = await transaction(pool, async (client) => {
      const jeton = await consommerJetonEmail(client, {
        jeton: corps(req).jeton,
        type: 'verification_email',
        maintenant: instant,
      })
      const { rows } = await client.query(
        `UPDATE utilisateurs AS u SET email_verifie_le = COALESCE(email_verifie_le, $2), modifie_le = $2
          WHERE id = $1 RETURNING ${COLONNES_UTILISATEUR}`,
        [jeton.utilisateur_id, instant],
      )
      return rows[0]
    })
    const { jeton } = await ouvrirSession(pool, { utilisateurId: utilisateur.id, client: 'web', maintenant: instant })
    poserCookieSession(res, config, jeton)
    res.json({ utilisateur: versUtilisateurApi(utilisateur) })
  })

  // §2.3 Renvoi du lien : 202 dans tous les cas, sans dire si le compte existe.
  routeur.post('/verification-email/renvoi', async (req, res) => {
    const email = normaliserEmail(corps(req).email)
    exigerChamps({ email: validerEmail(email) && 'format_invalide' })
    consommerEnvoiEmail(limites, 'verification', email)

    const { rows } = await pool.query(
      `SELECT id FROM utilisateurs
        WHERE email = $1 AND role = 'developpeur' AND email_verifie_le IS NULL AND statut <> 'suspendu'`,
      [email],
    )
    if (rows.length) {
      const message = await envoyerVerification(pool, { utilisateurId: rows[0].id, email, instant: maintenant() })
      await envoyerSansBloquer(message)
    }
    res.status(202).json({})
  })

  return routeur
}
