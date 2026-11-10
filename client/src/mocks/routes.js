import { CODES_PAYS } from '../lib/pays.js'
import { validerEmail, validerLienFiche, validerMotDePasse, validerNom } from '../lib/validation.js'
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
    methode: 'POST',
    chemin: '/api/auth/deconnexion',
    traiter() {
      base().sessionId = null
      sauver()
      return vide()
    },
  },
]
