import { Router } from 'express'
import { deciderAlerte, listerAlertes, STATUTS_ALERTES } from '../services/fraude.js'
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
import { lireCampagne, listerCampagnesAdmin, messageNouvelleApp, remplacerTesteur, telephonesTesteurs } from '../services/campagnes.js'
import { listerVersementsAdmin, relancerVersement, traiterVersements } from '../services/versements.js'
import { lireTableauDeBord } from '../services/tableauDeBord.js'
import { transaction } from './auth.js'
import { journaliser, lireJournal, messageSanction, sanctionner, SANCTIONS } from '../services/sanctions.js'
import { deciderGarantie, listerGaranties, messageDecisionGarantie, STATUTS_GARANTIE } from '../services/garanties.js'
import { validerMessage, validerPrix } from '../lib/devis.js'
import { OFFRE_AFRIQUE } from '../lib/offres.js'
import { lireDevisAdmin, listerDevisAdmin, messageDevis, repondreDevis, STATUTS_DEVIS, versDevisApi } from '../services/devis.js'

const STATUTS = ['en_attente', 'valide', 'refuse', 'suspendu', 'banni']
const STATUTS_VERSEMENT = ['a_verser', 'en_cours', 'verse', 'echoue']
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
      await journaliser(client, { adminId, action: decision === 'valide' ? 'compte_valide' : 'compte_refuse', cible: 'compte', cibleId: id, detail: motif, maintenant: instant })
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
    const instant = maintenant()
    const adminId = req.session.utilisateur.id
    const ligne = await transaction(pool, async (client) => {
      const resultat = await deciderApp(client, { id, adminId, decision, motif, maintenant: instant })
      await journaliser(client, { adminId, action: decision === 'validee' ? 'app_validee' : 'app_refusee', cible: 'app', cibleId: id, detail: motif, maintenant: instant })
      return resultat
    })
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

  // docs/api-offres.md §4.2 : devis de l'Offre Plus (US-37).
  const idDevis = (req) => {
    if (!/^\d{1,18}$/.test(req.params.id)) throw introuvable('Devis introuvable.')
    return req.params.id
  }

  routeur.get('/devis', async (req, res) => {
    const statut = texte(req.query.statut) || 'demande'
    exigerChamps({ statut: STATUTS_DEVIS.includes(statut) ? null : 'valeur_inconnue' })
    res.json({ devis: await listerDevisAdmin(pool, { statut }) })
  })

  routeur.get('/devis/:id', async (req, res) => {
    res.json({ devis: versDevisApi(await lireDevisAdmin(pool, idDevis(req)), 'admin') })
  })

  async function repondre(req, res, decision, { prix = null, message }) {
    const id = idDevis(req)
    const ligne = await transaction(pool, (client) =>
      repondreDevis(client, { id, adminId: req.session.utilisateur.id, decision, prix, message, maintenant: maintenant() }),
    )
    try {
      await deps.emails.envoyer(messageDevis(ligne, { clientUrl: config.clientUrl }))
    } catch (erreur) {
      // La réponse est enregistrée ; l'envoi raté est journalisé pour être refait à la main.
      journal.error(erreur)
    }
    res.json({ devis: versDevisApi(ligne, 'admin') })
  }

  // Prix en plus petite unité : centimes de dollar pour la carte, francs pour Mobile Money.
  routeur.post('/devis/:id/proposition', async (req, res) => {
    const { prixCarte, prixMobileMoney } = corps(req)
    const message = texte(corps(req).message)
    const depart = OFFRE_AFRIQUE.prix
    exigerChamps({
      prixCarte: validerPrix(prixCarte, depart.carte.montant, 1000000),
      prixMobileMoney: validerPrix(prixMobileMoney, depart.mobile_money.montant, 600000000),
      message: validerMessage(message, false),
    })
    await repondre(req, res, 'propose', { prix: { carte: prixCarte, mobileMoney: prixMobileMoney }, message })
  })

  routeur.post('/devis/:id/refus', async (req, res) => {
    const message = texte(corps(req).message)
    exigerChamps({ message: validerMessage(message, true) })
    await repondre(req, res, 'refuse', { message })
  })

  // docs/api-sprint3.md §1.4 : suivi des campagnes et remplacement manuel (US-43).
  const STATUTS_CAMPAGNE = ['en_cours', 'terminee', 'annulee']
  const idCampagne = (req) => {
    if (!/^\d{1,18}$/.test(req.params.id)) throw introuvable('Campagne introuvable.')
    return req.params.id
  }

  routeur.get('/campagnes', async (req, res) => {
    const statut = texte(req.query.statut) || 'en_cours'
    const page = entier(req.query.page, 1)
    const parPage = entier(req.query.parPage, 20)
    const champs = {}
    if (!STATUTS_CAMPAGNE.includes(statut)) champs.statut = 'valeur_inconnue'
    if (!Number.isInteger(page) || page < 1 || page > 100000) champs.page = 'format_invalide'
    if (!Number.isInteger(parPage) || parPage < 1 || parPage > 50) champs.parPage = 'format_invalide'
    exigerChamps(champs)
    res.json(await listerCampagnesAdmin(pool, { statut, page, parPage, maintenant: maintenant() }))
  })

  routeur.get('/campagnes/:id', async (req, res) => {
    res.json({ campagne: await lireCampagne(pool, idCampagne(req), { maintenant: maintenant(), vue: 'admin' }) })
  })

  routeur.post('/campagnes/:id/affectations/:affectationId/remplacement', async (req, res) => {
    const id = idCampagne(req)
    if (!/^\d{1,18}$/.test(req.params.affectationId)) throw introuvable('Testeur introuvable dans cette campagne.')
    const motif = texte(corps(req).motif)
    exigerChamps({ motif: validerMotifRefus(motif) })
    const instant = maintenant()
    const { testeurId } = await transaction(pool, async (client) => {
      const resultat = await remplacerTesteur(client, { campagneId: id, affectationId: req.params.affectationId, motif, maintenant: instant })
      await journaliser(client, { adminId: req.session.utilisateur.id, action: 'testeur_remplace', cible: 'campagne', cibleId: id, detail: motif, maintenant: instant })
      return resultat
    })
    // US-43 : le testeur remplacé quitte le groupe, le remplaçant y entre.
    deps.synchroGroupes.lancer()
    const campagne = await lireCampagne(pool, id, { maintenant: instant, vue: 'admin' })
    try {
      for (const telephone of await telephonesTesteurs(pool, id, [testeurId])) {
        await deps.sms.envoyer({ a: telephone, texte: messageNouvelleApp(campagne.app.nom) })
      }
    } catch (erreur) {
      journal.error(erreur)
    }
    res.json({ campagne })
  })

  // Sprint 4 §5 Tableau de bord global (US-24).
  routeur.get('/tableau-de-bord', async (_req, res) => {
    res.json({ tableauDeBord: await lireTableauDeBord(pool, { maintenant: maintenant() }) })
  })

  // Sprint 4 §2.4 Versements aux testeurs : liste (par défaut ceux en échec) et relance.
  routeur.get('/versements', async (req, res) => {
    const statut = texte(req.query.statut) || 'echoue'
    exigerChamps({ statut: !STATUTS_VERSEMENT.includes(statut) && statut !== 'tous' && 'valeur_inconnue' })
    res.json({ versements: await listerVersementsAdmin(pool, { statut: statut === 'tous' ? null : statut }) })
  })

  routeur.post('/versements/:reference/relance', async (req, res) => {
    const reference = req.params.reference
    if (!/^VER-[0-9A-F]{16}$/.test(reference)) throw introuvable('Versement introuvable.')
    await transaction(pool, async (client) => {
      await relancerVersement(client, { reference, maintenant: maintenant() })
      await journaliser(client, { adminId: req.session.utilisateur.id, action: 'versement_relance', cible: 'versement', cibleId: reference, maintenant: maintenant() })
    })
    // Nouvelle tentative tout de suite, sans attendre le prochain passage.
    await traiterVersements(deps)
    const versements = await listerVersementsAdmin(pool, { statut: null, reference })
    res.json({ versement: versements[0] })
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

  // US-28 (docs/anti-fraude.md) : alertes de comportements suspects, confirmées ou écartées.
  routeur.get('/alertes', async (req, res) => {
    const statut = texte(req.query.statut) || 'ouverte'
    const page = entier(req.query.page, 1)
    const champs = {}
    if (!STATUTS_ALERTES.includes(statut)) champs.statut = 'valeur_inconnue'
    if (!Number.isInteger(page) || page < 1 || page > 100000) champs.page = 'format_invalide'
    exigerChamps(champs)
    res.json(await listerAlertes(pool, { statut, page }))
  })

  routeur.post('/alertes/:id/decision', async (req, res) => {
    const { decision } = corps(req)
    const note = texte(corps(req).note) || null
    exigerChamps({
      decision: !decision ? 'requis' : ['confirmee', 'ecartee'].includes(decision) ? null : 'valeur_inconnue',
      note: note && note.length > 500 ? 'trop_long' : null,
    })
    const adminId = req.session.utilisateur.id
    const alerte = await deciderAlerte(pool, { id: req.params.id, decision, note, adminId, maintenant: maintenant() })
    await journaliser(pool, { adminId, action: `alerte_${decision}`, cible: 'alerte', cibleId: alerte.id, detail: note, maintenant: maintenant() })
    res.json({ alerte })
  })

  // US-29 (docs/sanctions.md) : suspendre, bannir ou réactiver un compte, avec un motif.
  routeur.post('/comptes/:id/sanction', async (req, res) => {
    const donnees = corps(req)
    const action = texte(donnees.action)
    const motif = texte(donnees.motif) || null
    exigerChamps({
      action: !action ? 'requis' : SANCTIONS[action] ? null : 'valeur_inconnue',
      motif: action === 'reactivation' ? (motif && motif.length > 500 ? 'trop_long' : null) : validerMotifRefus(motif),
    })
    const compte = await transaction(pool, (client) =>
      sanctionner(client, { id: idCompte(req), action, motif, adminId: req.session.utilisateur.id, maintenant: maintenant() }),
    )
    const { canal, ...message } = messageSanction(compte, { action, motif })
    try {
      await deps[canal].envoyer(message)
    } catch (erreur) {
      journal.error(erreur)
    }
    res.json({ compte: await lireCompte(pool, idCompte(req)) })
  })

  // US-30 (docs/garantie.md) : demandes de garantie après un refus de Google.
  routeur.get('/garanties', async (req, res) => {
    const statut = texte(req.query.statut) || 'en_attente'
    const page = entier(req.query.page, 1)
    exigerChamps({
      statut: STATUTS_GARANTIE.includes(statut) ? null : 'valeur_inconnue',
      page: !Number.isInteger(page) || page < 1 || page > 100000 ? 'format_invalide' : null,
    })
    res.json(await listerGaranties(pool, { statut, page }))
  })

  routeur.post('/garanties/:id/decision', async (req, res) => {
    if (!/^\d{1,18}$/.test(req.params.id)) throw introuvable('Demande introuvable.')
    const { decision } = corps(req)
    const motif = texte(corps(req).motif) || null
    exigerChamps({
      decision: !decision ? 'requis' : ['acceptee', 'refusee'].includes(decision) ? null : 'valeur_inconnue',
      motif: decision === 'refusee' ? validerMotifRefus(motif) : null,
    })
    const instant = maintenant()
    const adminId = req.session.utilisateur.id
    const { garantie, paiement } = await transaction(pool, async (client) => {
      const resultat = await deciderGarantie(client, { id: req.params.id, decision, motif, adminId, maintenant: instant })
      await journaliser(client, { adminId, action: `garantie_${decision}`, cible: 'app', cibleId: resultat.garantie.app.id, detail: motif, maintenant: instant })
      return resultat
    })
    try {
      await deps.emails.envoyer(messageDecisionGarantie(garantie, { paiement, clientUrl: config.clientUrl }))
    } catch (erreur) {
      journal.error(erreur)
    }
    res.json({ garantie })
  })

  routeur.get('/journal', async (req, res) => {
    const page = entier(req.query.page, 1)
    exigerChamps({ page: !Number.isInteger(page) || page < 1 || page > 100000 ? 'format_invalide' : null })
    res.json(await lireJournal(pool, { page }))
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
