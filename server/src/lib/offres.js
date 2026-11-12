// Offre Standard (US-12) : 29 $ par carte, ou l'équivalent en FCFA par Mobile Money.
// Montants en plus petite unité (centimes pour USD, francs pour XOF).
export const OFFRE_STANDARD = {
  code: 'standard',
  nom: 'Offre Standard',
  description: '12 testeurs vérifiés pendant 14 jours, rapports quotidiens et brouillon pour Google.',
  prix: {
    carte: { montant: 2900, devise: 'USD' },
    mobile_money: { montant: 17500, devise: 'XOF' },
  },
  garantie:
    'Si Google refuse l’accès à la production à cause d’un manque d’engagement des testeurs, nous relançons une nouvelle campagne sans frais.',
}

export const MOYENS_PAIEMENT = Object.keys(OFFRE_STANDARD.prix)

// Montant lisible : « 29,00 $ US » ou « 17 500 FCFA ».
export function montantLisible(montant, devise) {
  if (devise === 'XOF') return `${new Intl.NumberFormat('fr-FR').format(montant).replace(/ /g, ' ')} FCFA`
  return `${(montant / 100).toFixed(2).replace('.', ',')} $ US`
}
