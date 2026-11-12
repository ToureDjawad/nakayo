import { Router } from 'express'
import { optionsCookie, poserCookieSession } from '../lib/cookies.js'
import { ErreurHttp } from '../lib/erreurs.js'
import { genererJeton, hacherJeton } from '../lib/jetons.js'
import { consommerEnvoiEmail } from '../lib/limitesApi.js'
import { empreinteFactice, hacherMotDePasse, verifierMotDePasse } from '../lib/motsDePasse.js'
import { COLONNES_UTILISATEUR, versUtilisateurApi } from '../lib/utilisateurs.js'
import { corps, exigerChamps, LIMITES, normaliserEmail, validerEmail, validerMotDePasse } from '../lib/validation.js'
import { exigerSession } from '../middlewares/authentification.js'
import {
  NOM_COOKIE,
  ouvrirSession,
  revoquerSession,
  revoquerSessionsUtilisateur,
} from '../services/sessions.js'
import { lireProfilTesteur } from '../services/testeurs.js'

const DUREE_REINITIALISATION_MS = 60 * 60 * 1000

export const identifiantsInvalides = () =>
  new ErreurHttp(401, 'identifiants_invalides', { message: 'Email ou mot de passe incorrect.' })
export const jetonInvalide = () => new ErreurHttp(400, 'jeton_invalide', { message: 'Lien inconnu ou déjà utilisé.' })
export const jetonExpire = () => new ErreurHttp(410, 'jeton_expire', { message: 'Lien expiré.' })

export { poserCookieSession }

// Lit un jeton d'email encore utilisable, verrouillé jusqu'à la fin de la transaction.
export async function consommerJetonEmail(client, { jeton, type, maintenant }) {
  if (typeof jeton !== 'string' || !jeton || jeton.length > 200) throw jetonInvalide()
  const { rows } = await client.query(
    `SELECT id, utilisateur_id, expire_le, utilise_le FROM jetons_email
      WHERE jeton_hash = $1 AND type = $2 FOR UPDATE`,
    [hacherJeton(jeton), type],
  )
  const ligne = rows[0]
  if (!ligne || ligne.utilise_le) throw jetonInvalide()
  if (ligne.expire_le <= maintenant) throw jetonExpire()
  await client.query('UPDATE jetons_email SET utilise_le = $2 WHERE id = $1', [ligne.id, maintenant])
  return ligne
}

// Crée un jeton d'email ; les liens précédents du même type ne marchent plus.
export async function creerJetonEmail(db, { utilisateurId, type, dureeMs, maintenant }) {
  await db.query(
    `UPDATE jetons_email SET utilise_le = $3
      WHERE utilisateur_id = $1 AND type = $2 AND utilise_le IS NULL`,
    [utilisateurId, type, maintenant],
  )
  const jeton = genererJeton()
  await db.query(
    `INSERT INTO jetons_email (utilisateur_id, type, jeton_hash, expire_le, cree_le) VALUES ($1, $2, $3, $4, $5)`,
    [utilisateurId, type, hacherJeton(jeton), new Date(maintenant.getTime() + dureeMs), maintenant],
  )
  return jeton
}

export async function transaction(pool, travail) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const resultat = await travail(client)
    await client.query('COMMIT')
    return resultat
  } catch (erreur) {
    await client.query('ROLLBACK').catch(() => {})
    throw erreur
  } finally {
    client.release()
  }
}

export function routesAuth(deps) {
  const { pool, config, emails, limites, maintenant } = deps
  const routeur = Router()

  // §3.1 Connexion des développeurs et des admins (site web).
  routeur.post('/connexion', async (req, res) => {
    const donnees = corps(req)
    const email = normaliserEmail(donnees.email)
    const motDePasse = typeof donnees.motDePasse === 'string' ? donnees.motDePasse : ''
    exigerChamps({
      email: validerEmail(email),
      motDePasse: !motDePasse ? 'requis' : motDePasse.length > LIMITES.motDePasseMax ? 'trop_long' : null,
    })

    const ip = req.ip
    limites.connexionEmail.verifier(email)
    limites.connexionIp.verifier(ip)

    const { rows } = await pool.query(
      `SELECT ${COLONNES_UTILISATEUR}, u.mot_de_passe_hash FROM utilisateurs u
        WHERE u.email = $1 AND u.role IN ('developpeur', 'admin')`,
      [email],
    )
    const ligne = rows[0]
    const correct = await verifierMotDePasse(motDePasse, ligne?.mot_de_passe_hash ?? (await empreinteFactice()))
    if (!ligne || !correct) {
      limites.connexionEmail.compter(email)
      limites.connexionIp.compter(ip)
      throw identifiantsInvalides()
    }
    limites.connexionEmail.effacer(email)

    if (ligne.email_verifie_le === null) {
      throw new ErreurHttp(403, 'email_non_verifie', { message: 'Adresse email pas encore vérifiée.' })
    }
    if (ligne.statut === 'suspendu') {
      throw new ErreurHttp(403, 'compte_suspendu', { message: 'Compte suspendu.' })
    }

    const { jeton } = await ouvrirSession(pool, { utilisateurId: ligne.id, client: 'web', maintenant: maintenant() })
    poserCookieSession(res, config, jeton)
    res.json({ utilisateur: versUtilisateurApi(ligne) })
  })

  // §3.2 Déconnexion : 204 même sans session valide.
  routeur.post('/deconnexion', async (req, res) => {
    if (req.session) await revoquerSession(pool, { sessionId: req.session.sessionId, maintenant: maintenant() })
    res.clearCookie(NOM_COOKIE, optionsCookie(config))
    res.status(204).end()
  })

  // §3.3 Utilisateur de la session courante.
  routeur.get('/moi', exigerSession, async (req, res) => {
    const { utilisateur } = req.session
    // Un testeur reçoit son profil complet (§4.4), comme après la connexion par SMS.
    const profil = utilisateur.role === 'testeur' ? await lireProfilTesteur(pool, utilisateur.id) : null
    res.json({ utilisateur: profil ?? versUtilisateurApi(utilisateur) })
  })

  // §3.4 Mot de passe oublié : 202 dans tous les cas, sans dire si le compte existe.
  routeur.post('/mot-de-passe/oubli', async (req, res) => {
    const email = normaliserEmail(corps(req).email)
    exigerChamps({ email: validerEmail(email) && 'format_invalide' })
    consommerEnvoiEmail(limites, 'oubli', email)

    const { rows } = await pool.query(
      `SELECT id FROM utilisateurs
        WHERE email = $1 AND role IN ('developpeur', 'admin') AND mot_de_passe_hash IS NOT NULL
          AND statut <> 'suspendu'`,
      [email],
    )
    if (rows.length) {
      const jeton = await creerJetonEmail(pool, {
        utilisateurId: rows[0].id,
        type: 'reinitialisation_mot_de_passe',
        dureeMs: DUREE_REINITIALISATION_MS,
        maintenant: maintenant(),
      })
      const lien = `${config.clientUrl}/reinitialiser-mot-de-passe?jeton=${jeton}`
      await emails.envoyer({
        a: email,
        sujet: 'Choisir un nouveau mot de passe Nakayo',
        texte: [
          'Bonjour,',
          '',
          'Vous avez demandé à changer votre mot de passe Nakayo. Ce lien est valable 1 heure :',
          lien,
          '',
          "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre mot de passe ne change pas.",
        ].join('\n'),
        lien,
      })
    }
    res.status(202).json({})
  })

  // §3.5 Nouveau mot de passe : invalide le lien et toutes les sessions ouvertes.
  routeur.post('/mot-de-passe/reinitialisation', async (req, res) => {
    const donnees = corps(req)
    if (typeof donnees.jeton !== 'string' || !donnees.jeton) throw jetonInvalide()
    exigerChamps({ motDePasse: validerMotDePasse(donnees.motDePasse) })
    const empreinte = await hacherMotDePasse(donnees.motDePasse)
    const instant = maintenant()

    await transaction(pool, async (client) => {
      const ligne = await consommerJetonEmail(client, {
        jeton: donnees.jeton,
        type: 'reinitialisation_mot_de_passe',
        maintenant: instant,
      })
      await client.query('UPDATE utilisateurs SET mot_de_passe_hash = $2, modifie_le = $3 WHERE id = $1', [
        ligne.utilisateur_id,
        empreinte,
        instant,
      ])
      await revoquerSessionsUtilisateur(client, { utilisateurId: ligne.utilisateur_id, maintenant: instant })
    })
    res.status(204).end()
  })

  return routeur
}
