import { aujourdhuiBenin } from '../lib/format.js'
import { CODES_PAYS } from '../lib/pays.js'
import {
  nettoyerFonctionnalites,
  normaliserLienTest,
  normaliserWhatsapp,
  validerComptePlay,
  validerFonctionnalites,
  validerIdentifiants,
  validerLienTest,
  validerNomApp,
  validerPackage,
  validerTexteApp,
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

// Apps des développeurs (docs/api-sprint2.md §1).
function apps() {
  const b = base()
  b.apps ??= []
  return b.apps
}

function versApp(a) {
  const copie = {
    ...a,
    testObligatoire: a.comptePlay === 'personnel_recent',
    motifRefus: a.motifRefus ?? null,
    preparation: a.preparation ?? { elements: [], complete: false, completeLe: null },
  }
  delete copie.developpeurId
  delete copie.decideLe
  return copie
}

function exigerDeveloppeur() {
  const utilisateur = utilisateurConnecte()
  if (!utilisateur) return { refus: erreur(401, 'non_authentifie') }
  if (utilisateur.role !== 'developpeur') return { refus: erreur(403, 'interdit') }
  return { utilisateur }
}

function lireCorpsApp(corps = {}) {
  const connexionRequise = corps.connexionRequise
  const valeurs = {
    nom: (corps.nom ?? '').trim().replace(/\s+/g, ' '),
    package: (corps.package ?? '').trim(),
    lienTestFerme: normaliserLienTest(corps.lienTestFerme ?? ''),
    description: (corps.description ?? '').trim(),
    instructions: (corps.instructions ?? '').trim(),
    fonctionnalites: nettoyerFonctionnalites(Array.isArray(corps.fonctionnalites) ? corps.fonctionnalites : []),
    connexionRequise: connexionRequise === true,
    identifiantsTest: connexionRequise === true ? (corps.identifiantsTest ?? '').trim() : null,
    comptePlay: corps.comptePlay,
  }
  const erreurs = {
    nom: validerNomApp(valeurs.nom),
    package: validerPackage(valeurs.package),
    lienTestFerme: validerLienTest(valeurs.lienTestFerme, valeurs),
    description: validerTexteApp(valeurs.description),
    instructions: validerTexteApp(valeurs.instructions),
    fonctionnalites: Array.isArray(corps.fonctionnalites) ? validerFonctionnalites(corps.fonctionnalites) : 'requis',
    connexionRequise: typeof connexionRequise === 'boolean' ? null : 'requis',
    identifiantsTest: validerIdentifiants(valeurs.identifiantsTest ?? '', { connexionRequise: connexionRequise === true ? 'oui' : 'non' }),
    comptePlay: validerComptePlay(valeurs.comptePlay),
  }
  const champs = Object.fromEntries(Object.entries(erreurs).filter(([, code]) => code))
  return { valeurs, champs }
}

const packagePris = (pkg, saufId) =>
  apps().some((a) => a.id !== saufId && a.statut !== 'refusee' && a.package.toLowerCase() === pkg.toLowerCase())

function appDuDeveloppeur(id, utilisateur) {
  return apps().find((a) => a.id === id && a.developpeurId === utilisateur.id) ?? null
}

// Paiements de l'offre (docs/api-sprint2.md §2). Le mode simulation est le seul ici.
const OFFRE = {
  code: 'standard',
  nom: 'Offre Standard',
  description: '12 testeurs vérifiés pendant 14 jours, rapports quotidiens et brouillon pour Google.',
  prix: { carte: { montant: 2900, devise: 'USD' }, mobile_money: { montant: 17500, devise: 'XOF' } },
  garantie:
    'Si Google refuse l’accès à la production à cause d’un manque d’engagement des testeurs, nous relançons une nouvelle campagne sans frais.',
}

function paiements() {
  const b = base()
  b.paiements ??= []
  b.compteurFactures ??= 0
  return b.paiements
}

function versPaiement(p) {
  const app = apps().find((a) => a.id === p.appId)
  const lisible =
    p.devise === 'XOF' ? `${new Intl.NumberFormat('fr-FR').format(p.montant).replace(/\s/g, ' ')} FCFA` : `${(p.montant / 100).toFixed(2).replace('.', ',')} $ US`
  return {
    reference: p.reference,
    appId: p.appId,
    appNom: app?.nom ?? p.appNom,
    offre: 'standard',
    moyen: p.moyen,
    montant: p.montant,
    devise: p.devise,
    montantLisible: lisible,
    statut: p.statut,
    facture: p.facture,
    creeLe: p.creeLe,
    confirmeLe: p.confirmeLe,
    rembourseLe: null,
  }
}

function paiementDuDeveloppeur(reference, utilisateur) {
  return paiements().find((p) => p.reference === reference && p.developpeurId === utilisateur.id) ?? null
}

// Un PDF minimal : le vrai document est produit par le serveur (services/factures.js).
function pdfFacture(numero) {
  const contenu = `%PDF-1.4\n% Facture ${numero} (API simulée)\n%%EOF\n`
  return new Blob([contenu], { type: 'application/pdf' })
}

// Vérification des apps payées par l'admin (docs/api-sprint2.md §4).
function versAppAdmin(a) {
  const dev = base().utilisateurs.find((u) => u.id === a.developpeurId)
  const paiement = paiements()
    .filter((p) => p.appId === a.id && ['reussi', 'rembourse'].includes(p.statut))
    .at(-1)
  const p = paiement ? versPaiement(paiement) : null
  return {
    ...versApp(a),
    decideLe: a.decideLe ?? null,
    developpeur: { id: dev.id, nom: dev.nom, email: dev.email, pays: dev.pays, lienFicheDeveloppeur: dev.lienFicheDeveloppeur },
    paiement: p
      ? { reference: p.reference, moyen: p.moyen, montant: p.montant, devise: p.devise, montantLisible: p.montantLisible, statut: p.statut, facture: p.facture, confirmeLe: p.confirmeLe, rembourseLe: paiement.rembourseLe ?? null }
      : null,
  }
}

function deciderApp(id, decision, motif = null) {
  const refus = exigerAdmin()
  if (refus) return refus
  const app = apps().find((a) => a.id === id && a.statut !== 'brouillon')
  if (!app) return erreur(404, 'introuvable')
  if (app.statut !== 'en_verification') return erreur(409, 'statut_incompatible', { statut: app.statut })
  const maintenant = horodatage()
  Object.assign(app, { statut: decision, motifRefus: motif, decideLe: maintenant, modifieLe: maintenant })
  if (decision === 'refusee') {
    const paye = paiements().find((p) => p.appId === id && p.statut === 'reussi')
    if (paye) Object.assign(paye, { statut: 'rembourse', rembourseLe: maintenant })
  }
  sauver()
  console.info(`[mocks] Email de décision envoyé pour « ${app.nom} » (${decision})`)
  return ok({ app: versAppAdmin(app), historique: [] })
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
    methode: 'GET',
    chemin: '/api/apps',
    traiter() {
      const { refus, utilisateur } = exigerDeveloppeur()
      if (refus) return refus
      const miennes = apps()
        .filter((a) => a.developpeurId === utilisateur.id)
        .sort((a, b) => b.creeLe.localeCompare(a.creeLe))
      return ok({ apps: miennes.map(versApp) })
    },
  },
  {
    methode: 'POST',
    chemin: '/api/apps',
    traiter({ corps }) {
      const { refus, utilisateur } = exigerDeveloppeur()
      if (refus) return refus
      if (utilisateur.statut !== 'valide') return erreur(403, 'compte_non_valide')
      const { valeurs, champs } = lireCorpsApp(corps)
      if (Object.keys(champs).length) return erreur(422, 'validation', { champs })
      if (packagePris(valeurs.package)) return erreur(409, 'conflit', { champs: { package: 'deja_utilise' } })
      const maintenant = horodatage()
      const app = { id: nouvelId(), developpeurId: utilisateur.id, ...valeurs, statut: 'brouillon', creeLe: maintenant, modifieLe: maintenant }
      apps().push(app)
      sauver()
      return ok({ app: versApp(app) }, 201)
    },
  },
  {
    methode: 'GET',
    chemin: '/api/apps/:id',
    traiter({ params }) {
      const { refus, utilisateur } = exigerDeveloppeur()
      if (refus) return refus
      const app = appDuDeveloppeur(params.id, utilisateur)
      return app ? ok({ app: versApp(app) }) : erreur(404, 'introuvable')
    },
  },
  {
    methode: 'PUT',
    chemin: '/api/apps/:id',
    traiter({ params, corps }) {
      const { refus, utilisateur } = exigerDeveloppeur()
      if (refus) return refus
      if (utilisateur.statut !== 'valide') return erreur(403, 'compte_non_valide')
      const app = appDuDeveloppeur(params.id, utilisateur)
      if (!app) return erreur(404, 'introuvable')
      if (app.statut !== 'brouillon') return erreur(409, 'statut_incompatible', { statut: app.statut })
      const { valeurs, champs } = lireCorpsApp(corps)
      if (Object.keys(champs).length) return erreur(422, 'validation', { champs })
      if (packagePris(valeurs.package, app.id)) return erreur(409, 'conflit', { champs: { package: 'deja_utilise' } })
      Object.assign(app, valeurs, { modifieLe: horodatage() })
      sauver()
      return ok({ app: versApp(app) })
    },
  },
  {
    methode: 'DELETE',
    chemin: '/api/apps/:id',
    traiter({ params }) {
      const { refus, utilisateur } = exigerDeveloppeur()
      if (refus) return refus
      const app = appDuDeveloppeur(params.id, utilisateur)
      if (!app) return erreur(404, 'introuvable')
      if (app.statut !== 'brouillon') return erreur(409, 'statut_incompatible', { statut: app.statut })
      base().apps = apps().filter((a) => a !== app)
      sauver()
      return vide()
    },
  },
  {
    methode: 'GET',
    chemin: '/api/offres',
    traiter() {
      return ok({ offres: [OFFRE] })
    },
  },
  {
    methode: 'POST',
    chemin: '/api/apps/:id/paiements',
    traiter({ params, corps = {} }) {
      const { refus, utilisateur } = exigerDeveloppeur()
      if (refus) return refus
      if (utilisateur.statut !== 'valide') return erreur(403, 'compte_non_valide')
      const { moyen } = corps
      const numero = moyen === 'mobile_money' ? normaliserWhatsapp(corps.numeroMomo) : null
      const champs = Object.fromEntries(
        Object.entries({
          moyen: !moyen ? 'requis' : OFFRE.prix[moyen] ? null : 'valeur_inconnue',
          numeroMomo: moyen === 'mobile_money' ? validerWhatsapp(numero) : null,
        }).filter(([, code]) => code),
      )
      if (Object.keys(champs).length) return erreur(422, 'validation', { champs })
      const app = appDuDeveloppeur(params.id, utilisateur)
      if (!app) return erreur(404, 'introuvable')
      if (app.statut !== 'brouillon') return erreur(409, 'statut_incompatible', { statut: app.statut })
      const reference = `PAY-${Array.from({ length: 16 }, () => '0123456789ABCDEF'[Math.floor(Math.random() * 16)]).join('')}`
      const paiement = {
        reference,
        appId: app.id,
        appNom: app.nom,
        developpeurId: utilisateur.id,
        moyen,
        ...OFFRE.prix[moyen],
        numeroMomo: numero,
        statut: 'en_attente',
        facture: null,
        creeLe: horodatage(),
        confirmeLe: null,
      }
      paiements().push(paiement)
      sauver()
      return ok({ paiement: versPaiement(paiement), redirection: `/paiement/simulation/${reference}` }, 201)
    },
  },
  {
    methode: 'GET',
    chemin: '/api/paiements',
    traiter() {
      const { refus, utilisateur } = exigerDeveloppeur()
      if (refus) return refus
      const miens = paiements()
        .filter((p) => p.developpeurId === utilisateur.id)
        .sort((a, b) => b.creeLe.localeCompare(a.creeLe))
      return ok({ paiements: miens.map(versPaiement) })
    },
  },
  {
    methode: 'GET',
    chemin: '/api/paiements/:reference',
    traiter({ params }) {
      const { refus, utilisateur } = exigerDeveloppeur()
      if (refus) return refus
      const paiement = paiementDuDeveloppeur(params.reference, utilisateur)
      return paiement ? ok({ paiement: versPaiement(paiement) }) : erreur(404, 'introuvable')
    },
  },
  {
    methode: 'POST',
    chemin: '/api/paiements/:reference/simulation',
    traiter({ params, corps = {} }) {
      const { refus, utilisateur } = exigerDeveloppeur()
      if (refus) return refus
      const paiement = paiementDuDeveloppeur(params.reference, utilisateur)
      if (!paiement) return erreur(404, 'introuvable')
      if (!['reussi', 'echoue'].includes(corps.resultat)) return erreur(422, 'validation', { champs: { resultat: 'valeur_inconnue' } })
      if (paiement.statut === 'en_attente') {
        const app = apps().find((a) => a.id === paiement.appId)
        paiement.confirmeLe = horodatage()
        if (corps.resultat === 'echoue') paiement.statut = 'echoue'
        else if (!app || app.statut !== 'brouillon') paiement.statut = 'doublon'
        else {
          paiement.statut = 'reussi'
          app.statut = 'en_verification'
          app.modifieLe = paiement.confirmeLe
          base().compteurFactures = (base().compteurFactures ?? 0) + 1
          paiement.facture = `NKY-${paiement.confirmeLe.slice(0, 4)}-${String(base().compteurFactures).padStart(5, '0')}`
          console.info(`[mocks] Reçu de paiement envoyé (facture ${paiement.facture})`)
        }
        sauver()
      }
      return ok({ paiement: versPaiement(paiement) })
    },
  },
  {
    methode: 'GET',
    chemin: '/api/factures/:numero',
    traiter({ params }) {
      const { refus, utilisateur } = exigerDeveloppeur()
      if (refus) return refus
      const paiement = paiements().find((p) => p.facture === params.numero && p.developpeurId === utilisateur.id)
      if (!paiement) return erreur(404, 'introuvable')
      return { statut: 200, corps: null, brut: pdfFacture(params.numero), entetes: { 'Content-Type': 'application/pdf' } }
    },
  },
  {
    methode: 'GET',
    chemin: '/api/admin/apps',
    traiter({ query }) {
      const refus = exigerAdmin()
      if (refus) return refus
      const statut = query.get('statut') || 'en_verification'
      if (!['en_verification', 'validee', 'refusee'].includes(statut)) return erreur(422, 'validation', { champs: { statut: 'valeur_inconnue' } })
      const page = Number(query.get('page') || 1)
      const liste = apps()
        .filter((a) => a.statut === statut)
        .sort((a, b) => (statut === 'en_verification' ? a.modifieLe.localeCompare(b.modifieLe) : (b.decideLe ?? '').localeCompare(a.decideLe ?? '')))
      return ok({ apps: liste.slice((page - 1) * 20, page * 20).map(versAppAdmin), total: liste.length, page, parPage: 20 })
    },
  },
  {
    methode: 'POST',
    chemin: '/api/admin/apps/:id/validation',
    traiter({ params }) {
      return deciderApp(params.id, 'validee')
    },
  },
  {
    methode: 'POST',
    chemin: '/api/admin/apps/:id/refus',
    traiter({ params, corps }) {
      const motif = (corps?.motif ?? '').trim()
      const code = validerMotifRefus(motif)
      if (code) return erreur(422, 'validation', { champs: { motif: code } })
      return deciderApp(params.id, 'refusee', motif)
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
