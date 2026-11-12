import { aujourdhuiBenin } from '../lib/format.js'
import { CODES_PAYS } from '../lib/pays.js'
import {
  normaliserWhatsapp,
  validerEmail,
  validerLienFiche,
  validerMotDePasse,
  validerMotifRefus,
  validerNom,
  validerPeriode,
  validerMessage,
  validerSujet,
  validerWhatsapp,
} from '../lib/validation.js'
import { photoDemo } from './comptesDemo.js'
import { base, horodatage, nouvelId, sauver } from './base.js'
import { erreur, ok, RESEAU_COUPE, vide } from './http.js'

// Scénarios déclenchés par l'adresse email saisie (voir README.md du dossier).
function scenario(email) {
  if (typeof email !== 'string') return null
  if (email.includes('+reseau')) return RESEAU_COUPE
  if (email.includes('+serveur')) return erreur(500, 'erreur_interne')
  if (email.includes('+limite')) return erreur(429, 'trop_de_requetes', { retryAfter: 300 })
  return null
}

function publique(u) {
  const copie = { ...u }
  delete copie.motDePasse
  return copie
}

function utilisateurConnecte() {
  const b = base()
  return b.utilisateurs.find((u) => u.id === b.sessionId) ?? null
}

function creerJeton(type, utilisateurId, dureeMs = 24 * 3600 * 1000) {
  const jeton = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  base().jetons[jeton] = { type, utilisateurId, expireLe: Date.now() + dureeMs }
  return jeton
}

// Échecs de connexion par email : 5 en 15 minutes donnent un 429.
const echecsConnexion = new Map()

const derniersRenvois = new Map()

function exigerAdmin() {
  const utilisateur = utilisateurConnecte()
  if (!utilisateur) return erreur(401, 'non_authentifie')
  if (utilisateur.role !== 'admin') return erreur(403, 'interdit')
  return null
}

// Seuls les comptes dont l'email (développeur) ou le téléphone (testeur) est vérifié sont visibles.
function visiblePourAdmin(u) {
  if (u.role === 'developpeur') return u.emailVerifie
  return u.role === 'testeur'
}

function versCompteAdmin(u) {
  return {
    id: u.id,
    role: u.role,
    statut: u.statut,
    nom: u.nom,
    creeLe: u.creeLe,
    developpeur:
      u.role === 'developpeur' ? { email: u.email, pays: u.pays, lienFicheDeveloppeur: u.lienFicheDeveloppeur } : null,
    testeur:
      u.role === 'testeur'
        ? {
            telephone: u.telephone,
            ville: u.ville,
            gmail: u.gmail,
            numeroMomo: u.numeroMomo,
            operateurMomo: u.operateurMomo,
            appareil: u.appareil,
          }
        : null,
    controles: u.controles ?? { etat: 'en_cours', liste: [] },
  }
}

// Messages au support (§12) : absents des anciennes sauvegardes, créés à la première lecture.
function tickets() {
  const b = base()
  b.tickets ??= []
  return b.tickets
}

function versTicket(t) {
  return { id: t.id, sujet: t.sujet, message: t.message, statut: t.statut, creeLe: t.creeLe, traiteLe: t.traiteLe }
}

// Contact du support (§11) : absent des anciennes sauvegardes, créé à la première lecture.
function support() {
  const b = base()
  b.support ??= { whatsapp: null, whatsappPublie: null, modifieLe: null, publieLe: null }
  return b.support
}

function trouverCompte(id) {
  return base().utilisateurs.find((u) => u.id === id && u.role !== 'admin' && visiblePourAdmin(u)) ?? null
}

// Décision sur un compte en attente. Renvoie une réponse d'erreur, ou null si la décision est appliquée.
function decider(id, appliquer) {
  const refus = exigerAdmin()
  if (refus) return { reponse: refus }
  const compte = trouverCompte(id)
  if (!compte) return { reponse: erreur(404, 'introuvable') }
  if (compte.simulerConflit) {
    compte.statut = 'valide'
    compte.simulerConflit = false
    sauver()
  }
  if (compte.statut !== 'en_attente') return { reponse: erreur(409, 'statut_incompatible') }
  appliquer(compte)
  sauver()
  return { reponse: ok({ compte: versCompteAdmin(compte) }) }
}

export const routes = [
  {
    methode: 'POST',
    chemin: '/api/auth/inscription',
    traiter({ corps }) {
      const special = scenario(corps?.email)
      if (special) return special

      const champs = {}
      const email = (corps?.email ?? '').trim().toLowerCase()
      const e1 = validerEmail(email)
      if (e1) champs.email = e1
      const e2 = validerMotDePasse(corps?.motDePasse ?? '')
      if (e2) champs.motDePasse = e2
      const e3 = validerNom(corps?.nom ?? '')
      if (e3) champs.nom = e3
      if (!corps?.pays) champs.pays = 'requis'
      else if (!CODES_PAYS.has(corps.pays)) champs.pays = 'valeur_inconnue'
      const e4 = validerLienFiche(corps?.lienFicheDeveloppeur ?? '')
      if (e4) champs.lienFicheDeveloppeur = e4
      if (corps?.accepteConditions !== true) champs.accepteConditions = 'doit_etre_accepte'
      if (Object.keys(champs).length) return erreur(422, 'validation', { champs })

      const b = base()
      if (b.utilisateurs.some((u) => u.email === email)) {
        return erreur(409, 'conflit', { champs: { email: 'deja_utilise' } })
      }

      const utilisateur = {
        id: nouvelId(),
        role: 'developpeur',
        statut: 'en_attente',
        emailVerifie: false,
        email,
        motDePasse: corps.motDePasse,
        nom: corps.nom.trim(),
        pays: corps.pays,
        lienFicheDeveloppeur: corps.lienFicheDeveloppeur,
        motifRefus: null,
        creeLe: horodatage(),
        controles: { etat: 'en_cours', liste: [] },
      }
      b.utilisateurs.push(utilisateur)
      const jeton = creerJeton('verification-email', utilisateur.id)
      sauver()
      console.info(`[mocks] Email de vérification pour ${email} : ${location.origin}/verification-email?jeton=${jeton}`)
      return ok({ utilisateur: publique(utilisateur) }, 201)
    },
  },
  {
    methode: 'POST',
    chemin: '/api/auth/verification-email',
    traiter({ corps }) {
      const jeton = corps?.jeton
      if (jeton === 'expire') return erreur(410, 'jeton_expire')
      if (jeton === 'reseau') return RESEAU_COUPE
      const b = base()
      const entree = b.jetons[jeton]
      if (!entree || entree.type !== 'verification-email') return erreur(400, 'jeton_invalide')
      if (entree.expireLe < Date.now()) return erreur(410, 'jeton_expire')
      const utilisateur = b.utilisateurs.find((u) => u.id === entree.utilisateurId)
      utilisateur.emailVerifie = true
      delete b.jetons[jeton]
      b.sessionId = utilisateur.id
      sauver()
      return ok({ utilisateur: publique(utilisateur) })
    },
  },
  {
    methode: 'POST',
    chemin: '/api/auth/verification-email/renvoi',
    traiter({ corps }) {
      const special = scenario(corps?.email)
      if (special) return special
      const email = (corps?.email ?? '').trim().toLowerCase()
      const e = validerEmail(email)
      if (e) return erreur(422, 'validation', { champs: { email: e } })

      const dernier = derniersRenvois.get(email)
      if (dernier && Date.now() - dernier < 60000) {
        return erreur(429, 'trop_de_requetes', { retryAfter: Math.ceil((60000 - (Date.now() - dernier)) / 1000) })
      }
      derniersRenvois.set(email, Date.now())

      const b = base()
      const utilisateur = b.utilisateurs.find((u) => u.email === email && !u.emailVerifie)
      if (utilisateur) {
        const jeton = creerJeton('verification-email', utilisateur.id)
        sauver()
        console.info(`[mocks] Nouvel email de vérification pour ${email} : ${location.origin}/verification-email?jeton=${jeton}`)
      }
      return ok({}, 202)
    },
  },
  {
    methode: 'POST',
    chemin: '/api/auth/connexion',
    traiter({ corps }) {
      const special = scenario(corps?.email)
      if (special) return special
      const email = (corps?.email ?? '').trim().toLowerCase()
      const champs = {}
      const e = validerEmail(email)
      if (e) champs.email = e
      if (!corps?.motDePasse) champs.motDePasse = 'requis'
      if (Object.keys(champs).length) return erreur(422, 'validation', { champs })

      const maintenant = Date.now()
      const echecs = (echecsConnexion.get(email) ?? []).filter((t) => maintenant - t < 15 * 60000)
      if (echecs.length >= 5) {
        return erreur(429, 'trop_de_requetes', { retryAfter: Math.ceil((15 * 60000 - (maintenant - echecs[0])) / 1000) })
      }

      const b = base()
      const utilisateur = b.utilisateurs.find((u) => u.email === email && u.role !== 'testeur')
      if (!utilisateur || utilisateur.motDePasse !== corps.motDePasse) {
        echecsConnexion.set(email, [...echecs, maintenant])
        return erreur(401, 'identifiants_invalides')
      }
      echecsConnexion.delete(email)
      if (!utilisateur.emailVerifie) return erreur(403, 'email_non_verifie')
      if (utilisateur.statut === 'suspendu') return erreur(403, 'compte_suspendu')
      b.sessionId = utilisateur.id
      sauver()
      return ok({ utilisateur: publique(utilisateur) })
    },
  },
  {
    methode: 'POST',
    chemin: '/api/auth/mot-de-passe/oubli',
    traiter({ corps }) {
      const special = scenario(corps?.email)
      if (special) return special
      const email = (corps?.email ?? '').trim().toLowerCase()
      const e = validerEmail(email)
      if (e) return erreur(422, 'validation', { champs: { email: e } })
      const utilisateur = base().utilisateurs.find((u) => u.email === email && u.role !== 'testeur')
      if (utilisateur) {
        const jeton = creerJeton('reinitialisation', utilisateur.id, 3600 * 1000)
        sauver()
        console.info(`[mocks] Email de réinitialisation pour ${email} : ${location.origin}/reinitialiser-mot-de-passe?jeton=${jeton}`)
      }
      return ok({}, 202)
    },
  },
  {
    methode: 'POST',
    chemin: '/api/auth/mot-de-passe/reinitialisation',
    traiter({ corps }) {
      if (corps?.jeton === 'expire') return erreur(410, 'jeton_expire')
      const b = base()
      const entree = b.jetons[corps?.jeton]
      if (!entree || entree.type !== 'reinitialisation') return erreur(400, 'jeton_invalide')
      if (entree.expireLe < Date.now()) return erreur(410, 'jeton_expire')
      const code = validerMotDePasse(corps?.motDePasse ?? '')
      if (code) return erreur(422, 'validation', { champs: { motDePasse: code } })
      const utilisateur = b.utilisateurs.find((u) => u.id === entree.utilisateurId)
      utilisateur.motDePasse = corps.motDePasse
      delete b.jetons[corps.jeton]
      // Toutes les sessions sont fermées.
      if (b.sessionId === utilisateur.id) b.sessionId = null
      sauver()
      return vide()
    },
  },
  {
    methode: 'GET',
    chemin: '/api/auth/moi',
    traiter() {
      const utilisateur = utilisateurConnecte()
      if (!utilisateur) return erreur(401, 'non_authentifie')
      return ok({ utilisateur: publique(utilisateur) })
    },
  },
  {
    methode: 'GET',
    chemin: '/api/admin/comptes',
    traiter({ query }) {
      const refus = exigerAdmin()
      if (refus) return refus

      const statut = query.get('statut') ?? 'en_attente'
      const role = query.get('role') ?? ''
      const du = query.get('du') ?? ''
      const au = query.get('au') ?? ''
      const tri = query.get('tri') ?? 'ancien'
      const page = Number(query.get('page') ?? 1)
      const parPage = Number(query.get('parPage') ?? 20)

      const champs = { ...validerPeriode(du, au) }
      if (!['en_attente', 'valide', 'refuse', 'suspendu'].includes(statut)) champs.statut = 'valeur_inconnue'
      if (role && !['developpeur', 'testeur'].includes(role)) champs.role = 'valeur_inconnue'
      if (!['ancien', 'recent'].includes(tri)) champs.tri = 'valeur_inconnue'
      if (!Number.isInteger(page) || page < 1) champs.page = 'format_invalide'
      if (!Number.isInteger(parPage) || parPage < 1 || parPage > 50) champs.parPage = 'format_invalide'
      if (Object.keys(champs).length) return erreur(422, 'validation', { champs })

      const jourBenin = (iso) => aujourdhuiBenin(new Date(iso))
      const filtres = base()
        .utilisateurs.filter((u) => u.role !== 'admin' && visiblePourAdmin(u) && u.statut === statut)
        .filter((u) => !role || u.role === role)
        .filter((u) => !du || jourBenin(u.creeLe) >= du)
        .filter((u) => !au || jourBenin(u.creeLe) <= au)
        .sort((a, b) => (tri === 'recent' ? b.creeLe.localeCompare(a.creeLe) : a.creeLe.localeCompare(b.creeLe)))

      const debut = (page - 1) * parPage
      return ok({
        comptes: filtres.slice(debut, debut + parPage).map(versCompteAdmin),
        total: filtres.length,
        page,
        parPage,
      })
    },
  },
  {
    methode: 'GET',
    chemin: '/api/admin/comptes/:id',
    traiter({ params }) {
      const refus = exigerAdmin()
      if (refus) return refus
      const compte = trouverCompte(params.id)
      if (!compte) return erreur(404, 'introuvable')
      const detail = versCompteAdmin(compte)
      if (compte.role === 'testeur' && compte.controles?.liste?.some((c) => c.code === 'photos_presentes')) {
        detail.documents = {
          pieceIdentite: photoDemo('Pièce d’identité', compte.nom),
          selfie: photoDemo('Selfie', compte.nom),
        }
      }
      return ok({ compte: detail })
    },
  },
  {
    methode: 'POST',
    chemin: '/api/admin/comptes/:id/validation',
    traiter({ params }) {
      return decider(params.id, (compte) => {
        compte.statut = 'valide'
        console.info(`[mocks] Décision envoyée à ${compte.nom} : compte validé`)
      }).reponse
    },
  },
  {
    methode: 'POST',
    chemin: '/api/admin/comptes/:id/refus',
    traiter({ params, corps }) {
      const motif = typeof corps?.motif === 'string' ? corps.motif.trim() : ''
      const codeMotif = validerMotifRefus(motif)
      if (codeMotif) return erreur(422, 'validation', { champs: { motif: codeMotif } })
      return decider(params.id, (compte) => {
        compte.statut = 'refuse'
        compte.motifRefus = motif
        console.info(`[mocks] Décision envoyée à ${compte.nom} : refus, motif « ${motif} »`)
      }).reponse
    },
  },
  {
    methode: 'POST',
    chemin: '/api/auth/deconnexion',
    traiter() {
      base().sessionId = null
      sauver()
      return vide()
    },
  },
  {
    methode: 'GET',
    chemin: '/api/support',
    traiter() {
      return ok({ support: { whatsapp: support().whatsappPublie } })
    },
  },
  {
    methode: 'GET',
    chemin: '/api/admin/support',
    traiter() {
      return exigerAdmin() ?? ok({ support: { ...support() } })
    },
  },
  {
    methode: 'PUT',
    chemin: '/api/admin/support',
    traiter({ corps }) {
      const refus = exigerAdmin()
      if (refus) return refus
      const code = validerWhatsapp(corps?.whatsapp ?? '')
      if (code) return erreur(422, 'validation', { champs: { whatsapp: code } })
      Object.assign(support(), { whatsapp: normaliserWhatsapp(corps.whatsapp), modifieLe: horodatage() })
      sauver()
      return ok({ support: { ...support() } })
    },
  },
  {
    methode: 'POST',
    chemin: '/api/admin/support/publication',
    traiter() {
      const refus = exigerAdmin()
      if (refus) return refus
      if (!support().whatsapp) return erreur(409, 'rien_a_publier')
      Object.assign(support(), { whatsappPublie: support().whatsapp, publieLe: horodatage() })
      sauver()
      return ok({ support: { ...support() } })
    },
  },
  {
    methode: 'DELETE',
    chemin: '/api/admin/support/publication',
    traiter() {
      const refus = exigerAdmin()
      if (refus) return refus
      Object.assign(support(), { whatsappPublie: null, publieLe: horodatage() })
      sauver()
      return ok({ support: { ...support() } })
    },
  },
  {
    methode: 'POST',
    chemin: '/api/tickets',
    traiter({ corps }) {
      const utilisateur = utilisateurConnecte()
      if (!utilisateur) return erreur(401, 'non_authentifie')
      if (utilisateur.role === 'admin') return erreur(403, 'interdit')
      const sujet = (corps?.sujet ?? '').trim().replace(/\s+/g, ' ')
      const message = (corps?.message ?? '').trim()
      const champs = Object.fromEntries(
        Object.entries({ sujet: validerSujet(sujet), message: validerMessage(message) }).filter(([, code]) => code),
      )
      if (Object.keys(champs).length) return erreur(422, 'validation', { champs })
      const ticket = { id: nouvelId(), utilisateurId: utilisateur.id, sujet, message, statut: 'ouvert', creeLe: horodatage(), traiteLe: null }
      tickets().push(ticket)
      sauver()
      return ok({ ticket: versTicket(ticket) }, 201)
    },
  },
  {
    methode: 'GET',
    chemin: '/api/tickets/moi',
    traiter() {
      const utilisateur = utilisateurConnecte()
      if (!utilisateur) return erreur(401, 'non_authentifie')
      const miens = tickets()
        .filter((t) => t.utilisateurId === utilisateur.id)
        .sort((a, b) => b.creeLe.localeCompare(a.creeLe))
      return ok({ tickets: miens.slice(0, 20).map(versTicket) })
    },
  },
  {
    methode: 'GET',
    chemin: '/api/admin/tickets',
    traiter({ query }) {
      const refus = exigerAdmin()
      if (refus) return refus
      const statut = query.get('statut') ?? 'ouvert'
      const page = Number(query.get('page') ?? 1)
      if (!['ouvert', 'traite'].includes(statut)) return erreur(422, 'validation', { champs: { statut: 'valeur_inconnue' } })
      const liste = tickets()
        .filter((t) => t.statut === statut)
        .sort((a, b) => (statut === 'ouvert' ? a.creeLe.localeCompare(b.creeLe) : b.traiteLe.localeCompare(a.traiteLe)))
      const auteur = (id) => {
        const u = base().utilisateurs.find((x) => x.id === id)
        return { id: u.id, role: u.role, nom: u.nom, email: u.email ?? null, telephone: u.telephone ?? null }
      }
      return ok({
        tickets: liste.slice((page - 1) * 20, page * 20).map((t) => ({ ...versTicket(t), auteur: auteur(t.utilisateurId) })),
        total: liste.length,
        page,
        parPage: 20,
      })
    },
  },
  {
    methode: 'POST',
    chemin: '/api/admin/tickets/:id/traitement',
    traiter({ params }) {
      const refus = exigerAdmin()
      if (refus) return refus
      const t = tickets().find((x) => x.id === params.id)
      if (!t) return erreur(404, 'introuvable')
      if (t.statut !== 'ouvert') return erreur(409, 'statut_incompatible', { statut: t.statut })
      Object.assign(t, { statut: 'traite', traiteLe: horodatage() })
      sauver()
      const u = base().utilisateurs.find((x) => x.id === t.utilisateurId)
      return ok({ ticket: { ...versTicket(t), auteur: { id: u.id, role: u.role, nom: u.nom, email: u.email ?? null, telephone: u.telephone ?? null } } })
    },
  },
]
