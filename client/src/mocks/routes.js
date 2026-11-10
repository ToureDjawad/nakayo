import { aujourdhuiBenin } from '../lib/format.js'
import { CODES_PAYS } from '../lib/pays.js'
import { validerEmail, validerLienFiche, validerMotDePasse, validerMotifRefus, validerNom, validerPeriode } from '../lib/validation.js'
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

function creerJeton(type, utilisateurId) {
  const jeton = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  base().jetons[jeton] = { type, utilisateurId, expireLe: Date.now() + 24 * 3600 * 1000 }
  return jeton
}

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
]
