// Offres par app (US-12, US-32 ; docs/api-offres.md). Montants en plus petite unité
// (centimes pour USD, francs pour XOF) ; 1 $ = 600 FCFA, comme dans le modèle économique.
// `remuneration` : ce que gagne chaque testeur qui a ses 14 jours (US-22).
// `testeursConfirmes` : les campagnes sont d'abord confiées aux testeurs qui ont déjà mené
// une campagne au bout (les « mieux notés », US-32).
export const OFFRE_STANDARD = {
  code: 'standard',
  nom: 'Offre Standard',
  description: '15 testeurs vérifiés pendant 14 jours, rapports quotidiens et brouillon pour Google.',
  prix: {
    carte: { montant: 2900, devise: 'USD' },
    mobile_money: { montant: 17400, devise: 'XOF' },
  },
  garantie:
    'Si Google refuse l’accès à la production à cause d’un manque d’engagement des testeurs, nous relançons une nouvelle campagne sans frais.',
  remuneration: { montant: 500, devise: 'XOF' },
  testeurs: 15,
  testeursConfirmes: false,
  rapportsDeBugs: false,
  telephonesEntreeDeGamme: 0,
  questionnaireTerrain: false,
}

export const OFFRE_PRO = {
  code: 'pro',
  nom: 'Offre Pro',
  description:
    'Tout Standard, avec les testeurs les mieux notés, des rapports de bugs avec captures et au moins 5 téléphones d’entrée de gamme.',
  prix: {
    carte: { montant: 5900, devise: 'USD' },
    mobile_money: { montant: 35400, devise: 'XOF' },
  },
  garantie: OFFRE_STANDARD.garantie,
  remuneration: { montant: 800, devise: 'XOF' },
  testeurs: 15,
  testeursConfirmes: true,
  // US-33 : les testeurs envoient des rapports de bugs avec captures.
  rapportsDeBugs: true,
  // US-35 : au moins 5 testeurs sur des téléphones d'entrée de gamme.
  telephonesEntreeDeGamme: 5,
  questionnaireTerrain: false,
}

// Lancement Afrique (US-37) : sur devis. Le développeur décrit son besoin, l'équipe propose un prix
// (au moins le prix de départ ci-dessous), puis le développeur paie ce prix. 20 testeurs, payés
// 1 500 FCFA, qui répondent en plus à un questionnaire terrain (réseau, téléphone, langue).
export const OFFRE_AFRIQUE = {
  code: 'afrique',
  nom: 'Offre Lancement Afrique',
  description:
    'Tout Pro, avec 20 testeurs dans plusieurs villes et sur plusieurs réseaux, des scénarios sur mesure et un rapport sur l’usage réel : réseau lent, petits téléphones, compréhension de la langue.',
  prix: {
    carte: { montant: 9900, devise: 'USD' },
    mobile_money: { montant: 59400, devise: 'XOF' },
  },
  surDevis: true,
  garantie: OFFRE_STANDARD.garantie,
  remuneration: { montant: 1500, devise: 'XOF' },
  testeurs: 20,
  testeursConfirmes: true,
  rapportsDeBugs: true,
  telephonesEntreeDeGamme: 5,
  questionnaireTerrain: true,
}

export const OFFRES = { standard: OFFRE_STANDARD, pro: OFFRE_PRO, afrique: OFFRE_AFRIQUE }
export const CODES_OFFRES = Object.keys(OFFRES)
export const offre = (code) => OFFRES[code] ?? OFFRE_STANDARD

export const MOYENS_PAIEMENT = Object.keys(OFFRE_STANDARD.prix)

// Règles internes, retirées de la réponse publique de GET /api/offres.
export function offrePublique({ remuneration: _r, testeursConfirmes: _t, rapportsDeBugs: _b, telephonesEntreeDeGamme: _e, questionnaireTerrain: _q, ...o }) {
  return o
}

// Montée en gamme d'une app Standard déjà payée : la différence de prix, dans le même moyen.
export function prixMonteeEnGamme(moyen, vers = 'pro') {
  const cible = OFFRES[vers].prix[moyen]
  return { montant: cible.montant - OFFRE_STANDARD.prix[moyen].montant, devise: cible.devise }
}

// Montant lisible : « 29,00 $ US » ou « 17 400 FCFA ».
export function montantLisible(montant, devise) {
  if (devise === 'XOF') return `${new Intl.NumberFormat('fr-FR').format(montant).replace(/ /g, ' ')} FCFA`
  return `${(montant / 100).toFixed(2).replace('.', ',')} $ US`
}

// US-35 : un téléphone d'entrée de gamme a 3 Go de mémoire vive ou moins. Android annonce un
// peu moins que la capacité vendue (environ 2,8 Go pour 3 Go) : le seuil reste donc à 3 Go pile.
export const RAM_ENTREE_DE_GAMME_MO = 3 * 1024
export const estEntreeDeGamme = (ramMo) => ramMo != null && Number(ramMo) <= RAM_ENTREE_DE_GAMME_MO

// Bonus d'un testeur par bug accepté par le développeur (US-33), ajouté à son versement de clôture.
export const BONUS_BUG = { montant: 200, devise: 'XOF' }

// Rémunération d'un testeur (US-22) : selon l'offre de l'app, versée à la clôture de la campagne.
export const REMUNERATION_TESTEUR = OFFRE_STANDARD.remuneration
export const remuneration = (codeOffre) => offre(codeOffre).remuneration

// Taux du modèle économique pour ramener les paiements par carte en FCFA (1 $ = 600 FCFA).
export const TAUX_USD_FCFA = 600
