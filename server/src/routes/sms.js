import { randomInt } from 'node:crypto'
import { Router } from 'express'
import { ErreurHttp } from '../lib/erreurs.js'
import { genererJeton, hacherJeton } from '../lib/jetons.js'
import { lireAppareil, normaliserTelephone, validerCodeSms, validerTelephone } from '../lib/testeurs.js'
import { corps, exigerChamps } from '../lib/validation.js'
import { ouvrirSession } from '../services/sessions.js'
import { enregistrerAppareil, lireProfilTesteur } from '../services/testeurs.js'
import { transaction } from './auth.js'

export const DUREE_CODE_S = 10 * 60
export const DUREE_JETON_INSCRIPTION_S = 30 * 60
const TENTATIVES_MAX = 5

const empreinteCode = (telephone, code) => hacherJeton(`${telephone}:${code}`)

export function routesSms(deps) {
  const { pool, sms, limites, maintenant, journal } = deps
  const routeur = Router()

  // §4.1 Envoi d'un code à 6 chiffres, valable 10 min. Un nouveau code remplace le précédent.
  routeur.post('/sms/envoi', async (req, res) => {
    const telephone = normaliserTelephone(corps(req).telephone)
    exigerChamps({ telephone: validerTelephone(telephone) && 'format_invalide' })
    limites.smsMinute.verifier(telephone)
    limites.smsHeure.verifier(telephone)

    const instant = maintenant()
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
    const { rows } = await transaction(pool, async (client) => {
      await client.query('UPDATE codes_sms SET utilise_le = $2 WHERE telephone = $1 AND utilise_le IS NULL', [
        telephone,
        instant,
      ])
      return client.query(
        'INSERT INTO codes_sms (telephone, code_hash, expire_le, cree_le) VALUES ($1, $2, $3, $4) RETURNING id',
        [telephone, empreinteCode(telephone, code), new Date(instant.getTime() + DUREE_CODE_S * 1000), instant],
      )
    })

    try {
      await sms.envoyer({ a: telephone, texte: `Nakayo : votre code est ${code}. Il expire dans 10 minutes.`, code })
    } catch (erreur) {
      journal.error(erreur)
      await pool.query('UPDATE codes_sms SET utilise_le = $2 WHERE id = $1', [rows[0].id, instant])
      throw new ErreurHttp(503, 'service_indisponible', { message: "L'envoi du SMS a échoué." })
    }
    limites.smsMinute.compter(telephone)
    limites.smsHeure.compter(telephone)
    res.status(202).json({ expireDans: DUREE_CODE_S, renvoiPossibleDans: 60 })
  })

  // §4.2 Vérification du code : connecte un testeur connu, sinon donne un jeton d'inscription.
  routeur.post('/sms/verification', async (req, res) => {
    const donnees = corps(req)
    const telephone = normaliserTelephone(donnees.telephone)
    const code = typeof donnees.code === 'string' ? donnees.code.trim() : ''
    const { appareil, erreur: erreurAppareil } = lireAppareil(donnees.appareil)
    exigerChamps({
      telephone: validerTelephone(telephone) && 'format_invalide',
      code: validerCodeSms(code),
      appareil: erreurAppareil,
    })
    const instant = maintenant()

    // Le compteur de tentatives doit être enregistré même quand le code est faux :
    // la transaction renvoie l'issue, l'erreur est levée après le COMMIT.
    const issue = await transaction(pool, async (client) => {
      const { rows } = await client.query(
        `SELECT id, code_hash, expire_le, tentatives FROM codes_sms
          WHERE telephone = $1 AND utilise_le IS NULL ORDER BY cree_le DESC, id DESC LIMIT 1 FOR UPDATE`,
        [telephone],
      )
      const ligne = rows[0]
      if (!ligne || ligne.expire_le <= instant) return { erreur: 'expire' }
      if (!ligne.code_hash.equals(empreinteCode(telephone, code))) {
        const tentatives = ligne.tentatives + 1
        const epuise = tentatives >= TENTATIVES_MAX
        await client.query('UPDATE codes_sms SET tentatives = $2, utilise_le = $3 WHERE id = $1', [
          ligne.id,
          tentatives,
          epuise ? instant : null,
        ])
        return { erreur: epuise ? 'epuise' : 'invalide', tentativesRestantes: TENTATIVES_MAX - tentatives }
      }
      await client.query('UPDATE codes_sms SET utilise_le = $2 WHERE id = $1', [ligne.id, instant])

      const { rows: comptes } = await client.query(
        "SELECT id, statut FROM utilisateurs WHERE telephone = $1 AND role = 'testeur'",
        [telephone],
      )
      const compte = comptes[0]
      if (compte) {
        if (compte.statut === 'suspendu') return { erreur: 'suspendu' }
        await enregistrerAppareil(client, { utilisateurId: compte.id, appareil, maintenant: instant })
        const { jeton } = await ouvrirSession(client, { utilisateurId: compte.id, client: 'android', maintenant: instant })
        return { resultat: 'connecte', jeton, utilisateurId: compte.id }
      }

      const jetonInscription = genererJeton()
      await client.query(
        `INSERT INTO jetons_inscription (telephone, jeton_hash, appareil, expire_le, cree_le) VALUES ($1, $2, $3, $4, $5)`,
        [
          telephone,
          hacherJeton(jetonInscription),
          appareil,
          new Date(instant.getTime() + DUREE_JETON_INSCRIPTION_S * 1000),
          instant,
        ],
      )
      return { resultat: 'inscription', jetonInscription }
    })

    if (issue.erreur === 'expire') {
      throw new ErreurHttp(410, 'code_expire', { message: 'Code expiré ou absent : demandez-en un nouveau.' })
    }
    if (issue.erreur === 'invalide') {
      throw new ErreurHttp(400, 'code_invalide', {
        message: 'Code incorrect.',
        tentativesRestantes: issue.tentativesRestantes,
      })
    }
    if (issue.erreur === 'epuise') {
      throw new ErreurHttp(429, 'trop_de_requetes', {
        message: 'Trop de codes faux : demandez un nouveau code.',
        retryAfter: 1,
      })
    }
    if (issue.erreur === 'suspendu') throw new ErreurHttp(403, 'compte_suspendu', { message: 'Compte suspendu.' })

    if (issue.resultat === 'connecte') {
      const utilisateur = await lireProfilTesteur(pool, issue.utilisateurId)
      return res.json({ resultat: 'connecte', jeton: issue.jeton, utilisateur })
    }
    res.json({ resultat: 'inscription', jetonInscription: issue.jetonInscription, expireDans: DUREE_JETON_INSCRIPTION_S })
  })

  return routeur
}
