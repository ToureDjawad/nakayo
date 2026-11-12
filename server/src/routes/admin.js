import { Router } from 'express'
import { ErreurHttp, erreurValidation, introuvable } from '../lib/erreurs.js'
import { corps, exigerChamps, texte } from '../lib/validation.js'
import { exigerRole } from '../middlewares/authentification.js'
import { lireCompte, listerComptes, VISIBLE } from '../services/comptesAdmin.js'
import { cheminAbsolu } from '../services/documents.js'
import { listerTicketsAdmin, STATUTS_TICKET, traiterTicket } from '../services/tickets.js'
import {
  enregistrerWhatsapp,
  lireSupportAdmin,
  normaliserWhatsapp,
  publierWhatsapp,
  retirerWhatsapp,
  validerWhatsapp,
} from '../services/support.js'
import { deciderApp, lireAppAdmin, listerAppsAdmin, messageDecisionApp, STATUTS_FILE } from '../services/verificationApps.js'
import { transaction } from './auth.js'

const STATUTS = ['en_attente', 'valide', 'refuse', 'suspendu']
const ROLES = ['developpeur', 'testeur']
const TRIS = ['ancien', 'recent']
const TYPES_DOCUMENT = { 'piece-identite': 'piece_identite', selfie: 'selfie' }

// Date AAAA-MM-JJ qui existe vraiment (refuse 2026-02-30).
function dateValide(valeur) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valeur)) return false
  const date = new Date(`${valeur}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(valeur)
}

function entier(valeur, defaut) {
  if (valeur === undefined || valeur === '') return defaut
  return /^\d+$/.test(String(valeur)) ? Number(valeur) : NaN
}

export function lireFiltres(query) {
  const statut = texte(query.statut) || 'en_attente'
  const role = texte(query.role)
  const du = texte(query.du)
  const au = texte(query.au)
  const tri = texte(query.tri) || 'ancien'
  const page = entier(query.page, 1)
  const parPage = entier(query.parPage, 20)
  const champs = {}
  if (!STATUTS.includes(statut)) champs.statut = 'valeur_inconnue'
  if (role && !ROLES.includes(role)) champs.role = 'valeur_inconnue'
  if (du && !dateValide(du)) champs.du = 'format_invalide'
  if (au && !dateValide(au)) champs.au = 'format_invalide'
  if (!champs.du && !champs.au && du && au && du > au) champs.au = 'avant_debut'
  if (!TRIS.includes(tri)) champs.tri = 'valeur_inconnue'
  if (!Number.isInteger(page) || page < 1 || page > 100000) champs.page = 'format_invalide'
  if (!Number.isInteger(parPage) || parPage < 1 || parPage > 50) champs.parPage = 'format_invalide'
  if (Object.keys(champs).length) throw erreurValidation(champs)
  return { statut, role, du, au, tri, page, parPage }
}

export function validerMotifRefus(valeur) {
  if (!valeur) return 'requis'
  if (valeur.length < 10) return 'trop_court'
  if (valeur.length > 500) return 'trop_long'
  return null
}

function idCompte(req) {
  if (!/^\d{1,18}$/.test(req.params.id)) throw introuvable('Compte introuvable.')
  return req.params.id
}

// Messages envoyés à la personne après la décision (email au développeur, SMS au testeur).
export function messageDecision(compte, { decision, motif, clientUrl }) {
  if (compte.role === 'developpeur') {
    return decision === 'valide'
      ? {
          canal: 'emails',
          a: compte.email,
          sujet: 'Votre compte Nakayo est validé',
          texte: [
            'Bonjour,',
            '',
            'Votre compte développeur Nakayo est validé. Vous pouvez vous connecter et préparer votre première campagne de test :',
            `${clientUrl}/connexion`,
          ].join('\n'),
        }
      : {
          canal: 'emails',
          a: compte.email,
          sujet: 'Votre demande de compte Nakayo',
          texte: [
            'Bonjour,',
            '',
            "Votre demande de compte développeur Nakayo n'a pas été acceptée.",
            `Motif : ${motif}`,
            '',
            'Vous pouvez vous connecter pour revoir ce motif :',
            `${clientUrl}/connexion`,
          ].join('\n'),
        }
  }
  return decision === 'valide'
    ? {
        canal: 'sms',
        a: compte.telephone,
        texte: "Nakayo : votre compte testeur est validé. Ouvrez l'application pour voir les campagnes.",
      }
    : {
        canal: 'sms',
        a: compte.telephone,
        texte: `Nakayo : votre inscription n'a pas été acceptée. Motif : ${motif}`,
      }
}

export function routesAdmin(deps) {
  const { pool, config, maintenant, journal } = deps
  const routeur = Router()
  routeur.use(exigerRole('admin'))

  routeur.get('/comptes', async (req, res) => {
    res.json(await listerComptes(pool, lireFiltres(req.query)))
  })

  routeur.get('/comptes/:id', async (req, res) => {
    const compte = await lireCompte(pool, idCompte(req))
    if (!compte) throw introuvable('Compte introuvable.')
    res.json({ compte })
  })

  // §5.2 Photos d'un testeur : jamais publiques, jamais en cache.
  routeur.get('/comptes/:id/documents/:type', async (req, res) => {
    const type = TYPES_DOCUMENT[req.params.type]
    if (!type) throw introuvable('Document introuvable.')
    const { rows } = await pool.query(
      'SELECT chemin, type_mime FROM documents_identite WHERE utilisateur_id = $1 AND type = $2',
      [idCompte(req), type],
    )
    if (!rows.length) throw introuvable('Document introuvable.')
    res.set({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' })
    res.type(rows[0].type_mime)
    res.sendFile(cheminAbsolu(config.dossierDocuments, rows[0].chemin), (erreur) => {
      if (erreur && !res.headersSent) {
        journal.error(erreur)
        res.status(404).json({ erreur: { code: 'introuvable', message: 'Document introuvable.' } })
      }
    })
  })

  // Décision admin : un seul admin peut décider, le second reçoit 409 statut_incompatible.
  async function decider(req, res, decision, motif = null) {
    const id = idCompte(req)
    const instant = maintenant()
    const adminId = req.session.utilisateur.id
    const compte = await transaction(pool, async (client) => {
      const { rows } = await client.query(
        `UPDATE utilisateurs u SET statut = $2, motif_refus = $3, decide_par = $4, decide_le = $5, modifie_le = $5
          WHERE u.id = $1 AND u.statut = 'en_attente' AND ${VISIBLE}
          RETURNING u.id, u.role, u.email, u.telephone`,
        [id, decision, motif, adminId, instant],
      )
      if (!rows.length) return null
      await client.query(
        'INSERT INTO decisions_comptes (utilisateur_id, admin_id, decision, motif, cree_le) VALUES ($1, $2, $3, $4, $5)',
        [id, adminId, decision, motif, instant],
      )
      return rows[0]
    })

    if (!compte) {
      const existe = await lireCompte(pool, id)
      if (!existe) throw introuvable('Compte introuvable.')
      throw new ErreurHttp(409, 'statut_incompatible', {
        message: 'Ce compte a déjà été traité.',
        statut: existe.statut,
      })
    }

    const { canal, ...message } = messageDecision(compte, { decision, motif, clientUrl: config.clientUrl })
    try {
      await deps[canal].envoyer(message)
    } catch (erreur) {
      // La décision est enregistrée ; l'envoi raté est journalisé pour être refait à la main.
      journal.error(erreur)
    }
    res.json({ compte: await lireCompte(pool, id) })
  }

  routeur.post('/comptes/:id/validation', (req, res) => decider(req, res, 'valide'))

  routeur.post('/comptes/:id/refus', async (req, res) => {
    const motif = texte(corps(req).motif)
    exigerChamps({ motif: validerMotifRefus(motif) })
    await decider(req, res, 'refuse', motif)
  })

  // Sprint 2 §5 : vérification des apps payées (US-14).
  const idApp = (req) => {
    if (!/^\d{1,18}$/.test(req.params.id)) throw introuvable('App introuvable.')
    return req.params.id
  }

  routeur.get('/apps', async (req, res) => {
    const statut = texte(req.query.statut) || 'en_verification'
    const page = entier(req.query.page, 1)
    const parPage = entier(req.query.parPage, 20)
    const champs = {}
    if (!STATUTS_FILE.includes(statut)) champs.statut = 'valeur_inconnue'
    if (!Number.isInteger(page) || page < 1 || page > 100000) champs.page = 'format_invalide'
    if (!Number.isInteger(parPage) || parPage < 1 || parPage > 50) champs.parPage = 'format_invalide'
    exigerChamps(champs)
    res.json(await listerAppsAdmin(pool, { statut, page, parPage }))
  })

  routeur.get('/apps/:id', async (req, res) => {
    res.json(await lireAppAdmin(pool, idApp(req)))
  })

  async function deciderSurApp(req, res, decision, motif = null) {
    const id = idApp(req)
    const ligne = await transaction(pool, (client) =>
      deciderApp(client, { id, adminId: req.session.utilisateur.id, decision, motif, maintenant: maintenant() }),
    )
    try {
      await deps.emails.envoyer(messageDecisionApp(ligne, { clientUrl: config.clientUrl }))
    } catch (erreur) {
      // La décision est enregistrée ; l'envoi raté est journalisé pour être refait à la main.
      journal.error(erreur)
    }
    res.json(await lireAppAdmin(pool, id))
  }

  routeur.post('/apps/:id/validation', (req, res) => deciderSurApp(req, res, 'validee'))

  routeur.post('/apps/:id/refus', async (req, res) => {
    const motif = texte(corps(req).motif)
    exigerChamps({ motif: validerMotifRefus(motif) })
    await deciderSurApp(req, res, 'refusee', motif)
  })

  // §12.2 Messages envoyés au support.
  routeur.get('/tickets', async (req, res) => {
    const statut = texte(req.query.statut) || 'ouvert'
    const page = entier(req.query.page, 1)
    const parPage = entier(req.query.parPage, 20)
    const champs = {}
    if (!STATUTS_TICKET.includes(statut)) champs.statut = 'valeur_inconnue'
    if (!Number.isInteger(page) || page < 1 || page > 100000) champs.page = 'format_invalide'
    if (!Number.isInteger(parPage) || parPage < 1 || parPage > 50) champs.parPage = 'format_invalide'
    exigerChamps(champs)
    res.json(await listerTicketsAdmin(pool, { statut, page, parPage }))
  })

  routeur.post('/tickets/:id/traitement', async (req, res) => {
    if (!/^\d{1,18}$/.test(req.params.id)) throw introuvable('Message introuvable.')
    const adminId = req.session.utilisateur.id
    res.json({ ticket: await traiterTicket(pool, { id: req.params.id, adminId, maintenant: maintenant() }) })
  })

  // §11.2 Numéro WhatsApp du support : enregistré, puis publié ou retiré.
  routeur.get('/support', async (_req, res) => {
    res.json({ support: await lireSupportAdmin(pool) })
  })

  routeur.put('/support', async (req, res) => {
    const whatsapp = normaliserWhatsapp(corps(req).whatsapp)
    exigerChamps({ whatsapp: validerWhatsapp(whatsapp) })
    const adminId = req.session.utilisateur.id
    res.json({ support: await enregistrerWhatsapp(pool, { whatsapp, adminId, maintenant: maintenant() }) })
  })

  routeur.post('/support/publication', async (req, res) => {
    const adminId = req.session.utilisateur.id
    res.json({ support: await publierWhatsapp(pool, { adminId, maintenant: maintenant() }) })
  })

  routeur.delete('/support/publication', async (req, res) => {
    const adminId = req.session.utilisateur.id
    res.json({ support: await retirerWhatsapp(pool, { adminId, maintenant: maintenant() }) })
  })

  return routeur
}
