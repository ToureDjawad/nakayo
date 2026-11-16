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

// Liste de vérification avant le lancement (docs/api-sprint2.md §5).
const ELEMENTS_PREPARATION = ['testeurs_ajoutes', 'fiche_complete', 'version_publiee', 'pays_coches', 'pas_de_test_interne', 'mises_a_jour_prevues']

// Apps des développeurs (docs/api-sprint2.md §1).
function apps() {
  const b = base()
  b.apps ??= []
  return b.apps
}

function versApp(a) {
  const copie = {
    ...a,
    offre: a.offre ?? 'standard',
    testObligatoire: a.comptePlay === 'personnel_recent',
    motifRefus: a.motifRefus ?? null,
    preparation: a.preparation ?? { elements: [], complete: false, completeLe: null },
    campagne: null,
    devis: devisDeLApp(a.id) ? { statut: devisDeLApp(a.id).statut } : null,
  }
  const campagne = campagneDeLApp(a.id)
  if (campagne) copie.campagne = { id: campagne.id, statut: campagne.statut, demarreeLe: campagne.demarreeLe }
  delete copie.developpeurId
  delete copie.decideLe
  return copie
}

// Campagnes de test (docs/api-sprint3.md §1). Les testeurs sont simulés côté navigateur.
const JOURS_CAMPAGNE = 16
const VILLES = ['Cotonou', 'Porto-Novo', 'Parakou', 'Abomey-Calavi', 'Bohicon']
const MODELES = ['Tecno Spark 10', 'Infinix Hot 30', 'Samsung Galaxy A14', 'Itel A70', 'Xiaomi Redmi 12C']

function campagnes() {
  const b = base()
  b.campagnes ??= []
  return b.campagnes
}

function testeurSimule(n, maintenant) {
  return {
    id: nouvelId(),
    testeurId: nouvelId(),
    statut: 'active',
    nom: `Testeur simulé ${n}`,
    telephone: `+2290197${String(100000 + n).slice(-6)}`,
    ville: VILLES[n % VILLES.length],
    modele: MODELES[n % MODELES.length],
    gmail: `testeur.simule${n}@gmail.com`,
    affecteLe: maintenant,
    inscriptionConfirmeeLe: null,
    installationConfirmeeLe: null,
    joursValides: 0,
    nombreRemises: 0,
    remplaceeLe: null,
    motifRemplacement: null,
  }
}

function jourCampagne(c) {
  const ecart = Math.floor((Date.now() - new Date(c.demarreeLe).getTime()) / (24 * 3600 * 1000))
  return Math.min(JOURS_CAMPAGNE, Math.max(1, ecart + 1))
}

function versCampagne(c, vue = 'developpeur') {
  const app = apps().find((a) => a.id === c.appId)
  const actifs = c.testeurs.filter((t) => t.statut !== 'remplacee')
  const inscrits = actifs.filter((t) => t.inscriptionConfirmeeLe).length
  const jour = jourCampagne(c)
  const admin = vue === 'admin'
  const dev = admin ? base().utilisateurs.find((u) => u.id === c.developpeurId) : null
  return {
    id: c.id,
    app: { id: app.id, nom: app.nom, package: app.package, offre: app.offre ?? 'standard' },
    ...(admin ? { developpeur: { id: dev.id, nom: dev.nom, email: dev.email } } : {}),
    statut: c.statut,
    jour,
    joursCampagne: JOURS_CAMPAGNE,
    joursExiges: 14,
    testeursVises: c.testeursVises ?? 15,
    groupeGoogle: 'testeurs@nakayo.test',
    demarreeLe: c.demarreeLe,
    finPrevueLe: new Date(new Date(c.demarreeLe).getTime() + JOURS_CAMPAGNE * 24 * 3600 * 1000).toISOString(),
    termineeLe: c.termineeLe ?? null,
    compteurs: { affectes: actifs.length, inscritsConfirmes: inscrits, installes: actifs.filter((t) => t.installationConfirmeeLe).length },
    alerteInscrits: c.statut === 'en_cours' && jour >= 2 && inscrits < 13,
    remplacementPossible: admin && c.statut === 'en_cours' && jour <= 2,
    testeurs: (admin ? c.testeurs : actifs).map((t, i) => {
      const commun = {
        id: t.id,
        statut: t.statut,
        ville: t.ville,
        gmail: t.gmail,
        inscriptionConfirmee: Boolean(t.inscriptionConfirmeeLe),
        installationConfirmee: Boolean(t.installationConfirmeeLe),
        joursValides: t.joursValides,
      }
      if (!admin) return { ...commun, numero: i + 1 }
      return { ...commun, ...t }
    }),
  }
}

function campagneDeLApp(appId) {
  return campagnes()
    .filter((c) => c.appId === appId)
    .at(-1)
}

// Bugs signalés (docs/api-bugs.md §2). Les testeurs simulés n'envoient pas de captures.
function bugs() {
  const b = base()
  b.bugs ??= []
  return b.bugs
}

function bugsSimules(app, campagne, maintenant) {
  const [t1, t2] = campagne.testeurs
  bugs().push(
    {
      id: nouvelId(),
      appId: app.id,
      campagneId: campagne.id,
      numero: 1,
      titre: 'L’app se ferme à l’ouverture du panier',
      etapes: '1. Ajouter un article. 2. Toucher l’icône du panier.',
      resultatAttendu: 'Le panier s’affiche.',
      resultatObtenu: 'L’app se ferme.',
      gravite: 'bloquante',
      versionApp: '1.0.0',
      modele: t1?.modele ?? null,
      versionAndroid: '13',
      statut: 'nouveau',
      motifRefus: null,
      signaleLe: maintenant,
      decideLe: null,
    },
    {
      id: nouvelId(),
      appId: app.id,
      campagneId: campagne.id,
      numero: 2,
      titre: 'Texte coupé sur l’écran d’accueil',
      etapes: '1. Ouvrir l’app sur un petit écran.',
      resultatAttendu: 'Le titre tient sur une ligne.',
      resultatObtenu: 'Le titre est coupé.',
      gravite: 'mineure',
      versionApp: '1.0.0',
      modele: t2?.modele ?? null,
      versionAndroid: '12',
      statut: 'nouveau',
      motifRefus: null,
      signaleLe: maintenant,
      decideLe: null,
    },
  )
}

function versBug(b) {
  const campagne = campagnes().find((c) => c.id === b.campagneId)
  return {
    id: b.id,
    titre: b.titre,
    etapes: b.etapes,
    resultatAttendu: b.resultatAttendu,
    resultatObtenu: b.resultatObtenu,
    gravite: b.gravite,
    versionApp: b.versionApp,
    captures: [],
    statut: b.statut,
    motifRefus: b.motifRefus,
    signaleLe: b.signaleLe,
    decideLe: b.decideLe,
    testeur: { numero: b.numero, modele: b.modele, versionAndroid: b.versionAndroid },
    decidable: b.statut === 'nouveau' && campagne?.statut === 'en_cours',
  }
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
  description: '15 testeurs vérifiés pendant 14 jours, rapports quotidiens et brouillon pour Google.',
  prix: { carte: { montant: 2900, devise: 'USD' }, mobile_money: { montant: 17400, devise: 'XOF' } },
  garantie:
    'Si Google refuse l’accès à la production à cause d’un manque d’engagement des testeurs, nous relançons une nouvelle campagne sans frais.',
}
// Offre Pro (docs/api-offres.md §1) ; la montée en gamme coûte la différence de prix (§2).
const OFFRE_PRO = {
  code: 'pro',
  nom: 'Offre Pro',
  description:
    'Tout Standard, avec les testeurs les mieux notés, des rapports de bugs avec captures et au moins 5 téléphones d’entrée de gamme.',
  prix: { carte: { montant: 5900, devise: 'USD' }, mobile_money: { montant: 35400, devise: 'XOF' } },
  garantie: OFFRE.garantie,
  monteeEnGamme: { prix: { carte: { montant: 3000, devise: 'USD' }, mobile_money: { montant: 18000, devise: 'XOF' } } },
}
// Offre Plus (docs/api-offres.md §4) : sur devis, à partir de 99 $.
const OFFRE_AFRIQUE = {
  code: 'afrique',
  nom: 'Offre Plus',
  description:
    'Tout Pro, avec 20 testeurs dans plusieurs villes et sur plusieurs réseaux, des scénarios sur mesure et un rapport sur l’usage réel : réseau lent, petits téléphones, compréhension de la langue.',
  prix: { carte: { montant: 9900, devise: 'USD' }, mobile_money: { montant: 59400, devise: 'XOF' } },
  surDevis: true,
  testeurs: 20,
  garantie: OFFRE.garantie,
}
const OFFRES = { standard: OFFRE, pro: OFFRE_PRO, afrique: OFFRE_AFRIQUE }

// Devis Offre Plus (docs/api-offres.md §4) : un par app, gardé dans la base simulée.
function devisListe() {
  const b = base()
  b.devis ??= []
  return b.devis
}
const devisDeLApp = (appId) => devisListe().find((d) => d.appId === appId) ?? null
const lisible = (montant, devise) =>
  devise === 'XOF' ? `${new Intl.NumberFormat('fr-FR').format(montant).replace(/\s/g, ' ')} FCFA` : `${(montant / 100).toFixed(2).replace('.', ',')} $ US`
function versDevis(d, vue = 'developpeur') {
  const { appId, developpeurId, prixCarte, prixMobileMoney, ...reste } = d
  const devis = {
    ...reste,
    appId,
    prix:
      d.statut === 'propose'
        ? {
            carte: { montant: prixCarte, devise: 'USD', montantLisible: lisible(prixCarte, 'USD') },
            mobile_money: { montant: prixMobileMoney, devise: 'XOF', montantLisible: lisible(prixMobileMoney, 'XOF') },
          }
        : null,
  }
  if (vue !== 'admin') return devis
  const app = apps().find((a) => a.id === appId)
  const dev = base().utilisateurs.find((u) => u.id === developpeurId)
  return {
    ...devis,
    app: { id: app.id, nom: app.nom, package: app.package, statut: app.statut },
    developpeur: { id: dev.id, nom: dev.nom, email: dev.email, pays: dev.pays ?? null },
  }
}
const PAYS_DEVIS = ['BJ', 'TG', 'CI', 'SN', 'BF', 'NG', 'NE', 'ML', 'GH']
const LANGUES_DEVIS = ['fr', 'en', 'fon', 'yo']
function lireBesoin(corps) {
  const liste = (v, connus, max) => {
    if (!Array.isArray(v) || !v.length) return 'requis'
    if (v.length > max) return 'trop_nombreux'
    return v.every((c) => connus.includes(c)) ? null : 'valeur_inconnue'
  }
  const texte = (v, [min, max]) => {
    const t = (v ?? '').trim()
    return !t ? 'requis' : t.length < min ? 'trop_court' : t.length > max ? 'trop_long' : null
  }
  return Object.fromEntries(
    Object.entries({
      pays: liste(corps.pays, PAYS_DEVIS, 6),
      langues: liste(corps.langues, LANGUES_DEVIS, 4),
      profils: texte(corps.profils, [10, 1000]),
      scenarios: texte(corps.scenarios, [10, 2000]),
    }).filter(([, c]) => c),
  )
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
    offre: p.offre ?? 'standard',
    nature: p.nature ?? 'offre',
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

// Achat de l'offre d'une app en brouillon, ou montée en gamme d'une app déjà payée (§2).
function lancerPaiement(id, corps = {}, nature) {
  const { refus, utilisateur } = exigerDeveloppeur()
  if (refus) return refus
  if (utilisateur.statut !== 'valide') return erreur(403, 'compte_non_valide')
  const { moyen } = corps
  const code = corps.offre ?? (nature === 'offre' ? 'standard' : 'pro')
  const numero = moyen === 'mobile_money' ? normaliserWhatsapp(corps.numeroMomo) : null
  const champs = Object.fromEntries(
    Object.entries({
      offre: OFFRES[code] && (nature === 'offre' || code === 'pro') ? null : 'valeur_inconnue',
      moyen: !moyen ? 'requis' : OFFRE.prix[moyen] ? null : 'valeur_inconnue',
      numeroMomo: moyen === 'mobile_money' ? validerWhatsapp(numero) : null,
    }).filter(([, c]) => c),
  )
  if (Object.keys(champs).length) return erreur(422, 'validation', { champs })
  const app = appDuDeveloppeur(id, utilisateur)
  if (!app) return erreur(404, 'introuvable')
  if (nature === 'offre' && app.statut !== 'brouillon') return erreur(409, 'statut_incompatible', { statut: app.statut })
  if (nature === 'montee_en_gamme') {
    if (['brouillon', 'refusee'].includes(app.statut)) return erreur(409, 'statut_incompatible', { statut: app.statut })
    if ((app.offre ?? 'standard') !== 'standard') return erreur(409, 'deja_dans_cette_offre')
    if (campagneDeLApp(app.id)?.statut === 'terminee') return erreur(409, 'campagne_terminee')
  }
  // Offre Plus : le prix du devis proposé (§4.3).
  const devis = devisDeLApp(app.id)
  if (OFFRES[code].surDevis && devis?.statut !== 'propose') return erreur(409, 'devis_requis')
  const prix = OFFRES[code].surDevis
    ? moyen === 'carte'
      ? { montant: devis.prixCarte, devise: 'USD' }
      : { montant: devis.prixMobileMoney, devise: 'XOF' }
    : nature === 'offre'
      ? OFFRES[code].prix[moyen]
      : OFFRES[code].monteeEnGamme.prix[moyen]
  const reference = `PAY-${Array.from({ length: 16 }, () => '0123456789ABCDEF'[Math.floor(Math.random() * 16)]).join('')}`
  const paiement = {
    reference,
    appId: app.id,
    appNom: app.nom,
    developpeurId: utilisateur.id,
    offre: code,
    nature,
    moyen,
    ...prix,
    numeroMomo: numero,
    statut: 'en_attente',
    facture: null,
    creeLe: horodatage(),
    confirmeLe: null,
  }
  paiements().push(paiement)
  sauver()
  return ok({ paiement: versPaiement(paiement), redirection: `/paiement/simulation/${reference}` }, 201)
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
    methode: 'GET',
    chemin: '/api/apps/:id/preparation',
    traiter({ params }) {
      const { refus, utilisateur } = exigerDeveloppeur()
      if (refus) return refus
      const app = appDuDeveloppeur(params.id, utilisateur)
      if (!app) return erreur(404, 'introuvable')
      return ok({ preparation: versApp(app).preparation, elements: ELEMENTS_PREPARATION, groupeTesteurs: 'testeurs@nakayo.test' })
    },
  },
  {
    // US-36 : le rapport de fin est prêt au 14e jour ; en démo, une campagne vient de démarrer.
    methode: 'GET',
    chemin: '/api/apps/:id/campagne/rapport',
    traiter({ params }) {
      const { refus, utilisateur } = exigerDeveloppeur()
      if (refus) return refus
      const app = appDuDeveloppeur(params.id, utilisateur)
      const campagne = app && campagneDeLApp(app.id)
      if (!campagne) return erreur(404, 'introuvable')
      const debut = new Date(campagne.demarreeLe).getTime() + 3600 * 1000
      const disponibleLe = new Date(debut + 13 * 24 * 3600 * 1000).toISOString().slice(0, 10)
      return ok({ rapport: { pret: false, disponibleLe, bilan: null, brouillon: null, decisionGoogle: null } })
    },
  },
  {
    methode: 'PUT',
    chemin: '/api/apps/:id/campagne/decision-google',
    traiter({ params }) {
      const { refus, utilisateur } = exigerDeveloppeur()
      if (refus) return refus
      const app = appDuDeveloppeur(params.id, utilisateur)
      if (!app || !campagneDeLApp(app.id)) return erreur(404, 'introuvable')
      return erreur(409, 'rapport_pas_pret', { message: 'La décision de Google se saisit après le 14e jour du test.' })
    },
  },
  {
    methode: 'GET',
    chemin: '/api/apps/:id/bugs',
    traiter({ params }) {
      const { refus, utilisateur } = exigerDeveloppeur()
      if (refus) return refus
      const app = appDuDeveloppeur(params.id, utilisateur)
      if (!app) return erreur(404, 'introuvable')
      const ordre = { bloquante: 0, genante: 1, mineure: 2 }
      const liste = bugs()
        .filter((b) => b.appId === app.id)
        .sort((a, b) => ordre[a.gravite] - ordre[b.gravite] || b.signaleLe.localeCompare(a.signaleLe))
        .map(versBug)
      return ok({ bugs: liste, rapportsDeBugs: (app.offre ?? 'standard') !== 'standard' })
    },
  },
  {
    methode: 'GET',
    chemin: '/api/apps/:id/bugs.csv',
    traiter({ params }) {
      const { refus, utilisateur } = exigerDeveloppeur()
      if (refus) return refus
      const app = appDuDeveloppeur(params.id, utilisateur)
      if (!app) return erreur(404, 'introuvable')
      const lignes = bugs()
        .filter((b) => b.appId === app.id)
        .map((b) => [b.titre, b.gravite, b.statut].join(';'))
      const csv = `\uFEFFTitre;Gravité;Statut\r\n${lignes.join('\r\n')}\r\n`
      return { statut: 200, corps: null, brut: new Blob([csv], { type: 'text/csv' }), entetes: { 'Content-Type': 'text/csv; charset=utf-8' } }
    },
  },
  {
    methode: 'POST',
    chemin: '/api/apps/:id/bugs/:bugId/decision',
    traiter({ params, corps = {} }) {
      const { refus, utilisateur } = exigerDeveloppeur()
      if (refus) return refus
      const app = appDuDeveloppeur(params.id, utilisateur)
      if (!app) return erreur(404, 'introuvable')
      const bug = bugs().find((b) => b.id === params.bugId && b.appId === app.id)
      if (!bug) return erreur(404, 'introuvable')
      const motif = typeof corps.motif === 'string' ? corps.motif.trim() : ''
      const champs = Object.fromEntries(
        Object.entries({
          decision: ['accepte', 'refuse'].includes(corps.decision) ? null : corps.decision ? 'valeur_inconnue' : 'requis',
          motif: corps.decision !== 'refuse' ? null : !motif ? 'requis' : motif.length < 5 ? 'trop_court' : motif.length > 500 ? 'trop_long' : null,
        }).filter(([, c]) => c),
      )
      if (Object.keys(champs).length) return erreur(422, 'validation', { champs })
      if (bug.statut !== 'nouveau') return erreur(409, 'deja_decide')
      if (campagnes().find((c) => c.id === bug.campagneId)?.statut !== 'en_cours') return erreur(409, 'campagne_terminee')
      Object.assign(bug, { statut: corps.decision, motifRefus: corps.decision === 'refuse' ? motif : null, decideLe: horodatage() })
      sauver()
      return ok({ bug: versBug(bug) })
    },
  },
  {
    // US-21 : les testeurs simulés n'avancent pas ; l'avancement reste à zéro, jour par jour.
    methode: 'GET',
    chemin: '/api/apps/:id/campagne/avancement',
    traiter({ params }) {
      const { refus, utilisateur } = exigerDeveloppeur()
      if (refus) return refus
      const app = appDuDeveloppeur(params.id, utilisateur)
      const campagne = app && campagneDeLApp(app.id)
      if (!campagne) return erreur(404, 'introuvable')
      const vue = versCampagne(campagne)
      const actifs = campagne.testeurs.filter((t) => t.statut !== 'remplacee')
      const debut = new Date(campagne.demarreeLe).getTime() + 3600 * 1000
      const parJour = Array.from({ length: vue.jour }, (_, i) => ({
        jour: new Date(debut + i * 24 * 3600 * 1000).toISOString().slice(0, 10),
        numero: i + 1,
        tempsSecondes: 0,
        testeursAvecUsage: 0,
        rapports: 0,
        testeursValides: i + 1 < vue.jour ? 0 : null,
      }))
      const appareils = new Map()
      for (const t of actifs) appareils.set(t.modele, { modele: t.modele, versionAndroid: '14', testeurs: (appareils.get(t.modele)?.testeurs ?? 0) + 1 })
      return ok({
        avancement: {
          campagneId: campagne.id,
          statut: campagne.statut,
          jour: vue.jour,
          joursExiges: 14,
          finPrevueLe: vue.finPrevueLe,
          objectif: { atteint: false, testeursAtteints: 0, dateEstimee: null },
          resume: { testeursActifs: 0, installes: vue.compteurs.installes, tempsTotalSecondes: 0, rapports: 0, noteMoyenne: null, bugs: 0 },
          testeurs: actifs.map((t, i) => ({
            numero: i + 1,
            ville: t.ville,
            modele: t.modele,
            versionAndroid: '14',
            inscriptionConfirmee: Boolean(t.inscriptionConfirmeeLe),
            installationConfirmee: Boolean(t.installationConfirmeeLe),
            joursValides: t.joursValides,
            joursAcquis: false,
            dernierRapport: null,
            actif: false,
          })),
          parJour,
          couverture: app.fonctionnalites.map((f) => ({ fonctionnalite: f, testeurs: 0, rapports: 0, part: 0 })),
          appareils: [...appareils.values()].sort((a, b) => b.testeurs - a.testeurs || a.modele.localeCompare(b.modele)),
          rapports: [],
        },
      })
    },
  },
  {
    methode: 'GET',
    chemin: '/api/apps/:id/campagne',
    traiter({ params }) {
      const { refus, utilisateur } = exigerDeveloppeur()
      if (refus) return refus
      const app = appDuDeveloppeur(params.id, utilisateur)
      if (!app) return erreur(404, 'introuvable')
      const campagne = campagneDeLApp(app.id)
      return ok({ campagne: campagne ? versCampagne(campagne) : null })
    },
  },
  {
    methode: 'POST',
    chemin: '/api/apps/:id/campagne',
    traiter({ params }) {
      const { refus, utilisateur } = exigerDeveloppeur()
      if (refus) return refus
      const app = appDuDeveloppeur(params.id, utilisateur)
      if (!app) return erreur(404, 'introuvable')
      if (app.statut !== 'validee') return erreur(409, 'statut_incompatible', { statut: app.statut })
      if (!app.preparation?.complete) return erreur(409, 'preparation_incomplete')
      if (campagneDeLApp(app.id)) return erreur(409, 'campagne_existante')
      const maintenant = horodatage()
      const campagne = {
        id: nouvelId(),
        appId: app.id,
        developpeurId: utilisateur.id,
        statut: 'en_cours',
        demarreeLe: maintenant,
        testeursVises: OFFRES[app.offre ?? 'standard'].testeurs ?? 15,
        testeurs: Array.from({ length: OFFRES[app.offre ?? 'standard'].testeurs ?? 15 }, (_, i) => testeurSimule(campagnes().length * 20 + i + 1, maintenant)),
      }
      campagnes().push(campagne)
      // Offre Pro : deux testeurs simulés signalent un bug, pour voir la liste côté développeur (US-34).
      if ((app.offre ?? 'standard') !== 'standard') bugsSimules(app, campagne, maintenant)
      sauver()
      console.info(`[mocks] SMS envoyés aux ${campagne.testeurs.length} testeurs de « ${app.nom} »`)
      return ok({ campagne: versCampagne(campagne) }, 201)
    },
  },
  {
    methode: 'PUT',
    chemin: '/api/apps/:id/preparation',
    traiter({ params, corps }) {
      const { refus, utilisateur } = exigerDeveloppeur()
      if (refus) return refus
      const app = appDuDeveloppeur(params.id, utilisateur)
      if (!app) return erreur(404, 'introuvable')
      if (!['en_verification', 'validee'].includes(app.statut)) return erreur(409, 'statut_incompatible', { statut: app.statut })
      if (campagneDeLApp(app.id)) return erreur(409, 'campagne_existante')
      const elements = corps?.elements
      if (!Array.isArray(elements)) return erreur(422, 'validation', { champs: { elements: 'requis' } })
      if (elements.some((e) => !ELEMENTS_PREPARATION.includes(e))) return erreur(422, 'validation', { champs: { elements: 'valeur_inconnue' } })
      const coches = ELEMENTS_PREPARATION.filter((e) => elements.includes(e))
      const complete = coches.length === ELEMENTS_PREPARATION.length
      app.preparation = { elements: coches, complete, completeLe: complete ? (app.preparation?.completeLe ?? horodatage()) : null }
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
      return ok({ offres: Object.values(OFFRES) })
    },
  },
  {
    methode: 'GET',
    chemin: '/api/apps/:id/devis',
    traiter({ params }) {
      const { refus, utilisateur } = exigerDeveloppeur()
      if (refus) return refus
      const app = appDuDeveloppeur(params.id, utilisateur)
      if (!app) return erreur(404, 'introuvable')
      const devis = devisDeLApp(app.id)
      return ok({ devis: devis ? versDevis(devis) : null })
    },
  },
  {
    methode: 'PUT',
    chemin: '/api/apps/:id/devis',
    traiter({ params, corps }) {
      const { refus, utilisateur } = exigerDeveloppeur()
      if (refus) return refus
      if (utilisateur.statut !== 'valide') return erreur(403, 'compte_non_valide')
      const app = appDuDeveloppeur(params.id, utilisateur)
      if (!app) return erreur(404, 'introuvable')
      const champs = lireBesoin(corps)
      if (Object.keys(champs).length) return erreur(422, 'validation', { champs })
      if (app.statut !== 'brouillon') return erreur(409, 'statut_incompatible', { statut: app.statut })
      const existant = devisDeLApp(app.id)
      const besoin = {
        pays: [...new Set(corps.pays)],
        langues: [...new Set(corps.langues)],
        profils: corps.profils.trim(),
        scenarios: corps.scenarios.trim(),
        statut: 'demande',
        prixCarte: null,
        prixMobileMoney: null,
        message: null,
        demandeLe: horodatage(),
        reponduLe: null,
      }
      if (existant) Object.assign(existant, besoin)
      else devisListe().push({ id: nouvelId(), appId: app.id, developpeurId: utilisateur.id, ...besoin })
      sauver()
      return ok({ devis: versDevis(devisDeLApp(app.id)) })
    },
  },
  {
    methode: 'POST',
    chemin: '/api/apps/:id/paiements',
    traiter: ({ params, corps }) => lancerPaiement(params.id, corps, 'offre'),
  },
  {
    methode: 'POST',
    chemin: '/api/apps/:id/montee-en-gamme',
    traiter: ({ params, corps }) => lancerPaiement(params.id, corps, 'montee_en_gamme'),
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
        const montee = paiement.nature === 'montee_en_gamme'
        if (corps.resultat === 'echoue') paiement.statut = 'echoue'
        else if (!app || (montee ? (app.offre ?? 'standard') === paiement.offre : app.statut !== 'brouillon')) paiement.statut = 'doublon'
        else {
          paiement.statut = 'reussi'
          if (!montee) app.statut = 'en_verification'
          app.offre = paiement.offre ?? 'standard'
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
  // Tableau de bord global (docs/api-sprint4.md §5). Les testeurs simulés ne sont jamais payés :
  // ni versement ni échec en mode démo.
  {
    methode: 'GET',
    chemin: '/api/admin/tableau-de-bord',
    traiter() {
      const refus = exigerAdmin()
      if (refus) return refus
      const lisible = (n) => `${new Intl.NumberFormat('fr-FR').format(n).replace(/\s/g, ' ')} FCFA`
      const enFcfa = (p) => (p.devise === 'USD' ? Math.round((p.montant / 100) * 600) : p.montant)
      const reussis = paiements().filter((p) => p.statut === 'reussi')
      const liste = campagnes()
      const affectations = liste.flatMap((c) => c.testeurs)
      const enRetard = liste
        .filter((c) => c.statut === 'en_cours')
        .map((c) => {
          const jour = jourCampagne(c)
          const restants = JOURS_CAMPAGNE - jour + 1
          const enBonneVoie = c.testeurs.filter((t) => t.statut === 'active' && t.installationConfirmeeLe && t.joursValides + restants >= 14).length
          return { campagneId: c.id, appNom: apps().find((a) => a.id === c.appId)?.nom ?? '', jour, testeursEnBonneVoie: enBonneVoie }
        })
        .filter((c) => c.testeursEnBonneVoie < 12)
      const ca = reussis.reduce((s, p) => s + enFcfa(p), 0)
      const parApp = liste.map((c) => {
        const encaisse = reussis.filter((p) => p.appId === c.appId).reduce((s, p) => s + enFcfa(p), 0)
        const dev = base().utilisateurs.find((u) => u.id === c.developpeurId)
        const definitive = c.statut !== 'en_cours'
        return {
          campagneId: c.id,
          appNom: apps().find((a) => a.id === c.appId)?.nom ?? '',
          developpeur: dev?.nom ?? '',
          statut: c.statut,
          demarreeLe: c.demarreeLe,
          encaisse,
          versesTesteurs: 0,
          dusTesteurs: 0,
          marge: definitive ? encaisse : encaisse - 15 * 500,
          margeDefinitive: definitive,
        }
      })
      const remplaces = affectations.filter((t) => t.statut === 'remplacee').length
      return ok({
        tableauDeBord: {
          aujourdhui: new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Porto-Novo' }).format(new Date()),
          campagnes: {
            enCours: liste.filter((c) => c.statut === 'en_cours').length,
            terminees: liste.filter((c) => c.statut === 'terminee').length,
            annulees: liste.filter((c) => c.statut === 'annulee').length,
            enRetard: enRetard.length,
            retards: enRetard,
            decisionsGoogle: (() => {
              const acceptees = liste.filter((c) => c.decisionGoogle?.decision === 'acceptee').length
              const refusees = liste.filter((c) => c.decisionGoogle?.decision === 'refusee').length
              return { acceptees, refusees, tauxReussite: acceptees + refusees ? acceptees / (acceptees + refusees) : null }
            })(),
          },
          testeurs: {
            valides: base().utilisateurs.filter((u) => u.role === 'testeur' && u.statut === 'valide').length,
            actifs: new Set(
              liste.filter((c) => c.statut === 'en_cours').flatMap((c) => c.testeurs.filter((t) => t.statut === 'active' && t.installationConfirmeeLe).map((t) => t.testeurId)),
            ).size,
            affectations: affectations.length,
            remplaces,
            tauxAbandon: affectations.length ? remplaces / affectations.length : 0,
            avecRemise: affectations.filter((t) => t.nombreRemises > 0).length,
          },
          finances: {
            devise: 'XOF',
            tauxUsdFcfa: 600,
            chiffreAffaires: ca,
            chiffreAffairesLisible: lisible(ca),
            versesTesteurs: 0,
            versesTesteursLisible: lisible(0),
            dusTesteurs: 0,
            dusTesteursLisible: lisible(0),
            marge: ca,
            margeLisible: lisible(ca),
            parApp,
          },
          versementsEchoues: [],
          nombreVersementsEchoues: 0,
        },
      })
    },
  },
  {
    methode: 'POST',
    chemin: '/api/admin/versements/:reference/relance',
    traiter() {
      const refus = exigerAdmin()
      if (refus) return refus
      return erreur(404, 'introuvable', { message: 'Versement introuvable.' })
    },
  },
  {
    methode: 'GET',
    chemin: '/api/admin/campagnes',
    traiter({ query }) {
      const refus = exigerAdmin()
      if (refus) return refus
      const statut = query.get('statut') || 'en_cours'
      if (!['en_cours', 'terminee', 'annulee'].includes(statut)) return erreur(422, 'validation', { champs: { statut: 'valeur_inconnue' } })
      const page = Number(query.get('page') || 1)
      const liste = campagnes()
        .filter((c) => c.statut === statut)
        .sort((a, b) => (statut === 'en_cours' ? a.demarreeLe.localeCompare(b.demarreeLe) : b.demarreeLe.localeCompare(a.demarreeLe)))
      const resumes = liste.slice((page - 1) * 20, page * 20).map((c) => {
        const { testeurs: _detail, ...resume } = versCampagne(c, 'admin')
        return resume
      })
      return ok({ campagnes: resumes, total: liste.length, page, parPage: 20 })
    },
  },
  {
    methode: 'GET',
    chemin: '/api/admin/campagnes/:id',
    traiter({ params }) {
      const refus = exigerAdmin()
      if (refus) return refus
      const campagne = campagnes().find((c) => c.id === params.id)
      return campagne ? ok({ campagne: versCampagne(campagne, 'admin') }) : erreur(404, 'introuvable')
    },
  },
  {
    methode: 'POST',
    chemin: '/api/admin/campagnes/:id/affectations/:affectationId/remplacement',
    traiter({ params, corps }) {
      const refus = exigerAdmin()
      if (refus) return refus
      const campagne = campagnes().find((c) => c.id === params.id)
      if (!campagne) return erreur(404, 'introuvable')
      const motif = (corps?.motif ?? '').trim()
      const code = validerMotifRefus(motif)
      if (code) return erreur(422, 'validation', { champs: { motif: code } })
      if (campagne.statut !== 'en_cours') return erreur(409, 'statut_incompatible', { statut: campagne.statut })
      if (jourCampagne(campagne) > 2) return erreur(409, 'delai_depasse')
      const sortant = campagne.testeurs.find((t) => t.id === params.affectationId)
      if (!sortant) return erreur(404, 'introuvable')
      if (sortant.statut !== 'active') return erreur(409, 'statut_incompatible', { statut: sortant.statut })
      const maintenant = horodatage()
      const entrant = testeurSimule(campagne.testeurs.length + 100, maintenant)
      Object.assign(sortant, { statut: 'remplacee', remplaceeLe: maintenant, motifRemplacement: motif })
      campagne.testeurs.push(entrant)
      sauver()
      console.info(`[mocks] SMS envoyé au remplaçant de ${sortant.nom}`)
      return ok({ campagne: versCampagne(campagne, 'admin') })
    },
  },
  {
    methode: 'GET',
    chemin: '/api/admin/devis',
    traiter({ query }) {
      const refus = exigerAdmin()
      if (refus) return refus
      const statut = query.get('statut') || 'demande'
      if (!['demande', 'propose', 'refuse'].includes(statut)) return erreur(422, 'validation', { champs: { statut: 'valeur_inconnue' } })
      const liste = devisListe()
        .filter((d) => d.statut === statut)
        .sort((a, b) => (statut === 'demande' ? a.demandeLe.localeCompare(b.demandeLe) : b.reponduLe.localeCompare(a.reponduLe)))
      return ok({ devis: liste.map((d) => versDevis(d, 'admin')) })
    },
  },
  {
    methode: 'POST',
    chemin: '/api/admin/devis/:id/proposition',
    traiter({ params, corps }) {
      const refus = exigerAdmin()
      if (refus) return refus
      const devis = devisListe().find((d) => d.id === params.id)
      if (!devis) return erreur(404, 'introuvable')
      const prix = (v, min) => (v == null ? 'requis' : !Number.isInteger(v) ? 'format_invalide' : v < min ? 'trop_petit' : null)
      const champs = Object.fromEntries(
        Object.entries({ prixCarte: prix(corps.prixCarte, 9900), prixMobileMoney: prix(corps.prixMobileMoney, 59400) }).filter(([, c]) => c),
      )
      if (Object.keys(champs).length) return erreur(422, 'validation', { champs })
      if (devis.statut !== 'demande') return erreur(409, 'deja_repondu')
      Object.assign(devis, {
        statut: 'propose',
        prixCarte: corps.prixCarte,
        prixMobileMoney: corps.prixMobileMoney,
        message: corps.message?.trim() || null,
        reponduLe: horodatage(),
      })
      sauver()
      console.info('[mocks] Email envoyé au développeur : devis Offre Plus proposé')
      return ok({ devis: versDevis(devis, 'admin') })
    },
  },
  {
    methode: 'POST',
    chemin: '/api/admin/devis/:id/refus',
    traiter({ params, corps }) {
      const refus = exigerAdmin()
      if (refus) return refus
      const devis = devisListe().find((d) => d.id === params.id)
      if (!devis) return erreur(404, 'introuvable')
      const message = (corps.message ?? '').trim()
      if (!message) return erreur(422, 'validation', { champs: { message: 'requis' } })
      if (devis.statut !== 'demande') return erreur(409, 'deja_repondu')
      Object.assign(devis, { statut: 'refuse', message, reponduLe: horodatage() })
      sauver()
      console.info('[mocks] Email envoyé au développeur : devis Offre Plus refusé')
      return ok({ devis: versDevis(devis, 'admin') })
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
