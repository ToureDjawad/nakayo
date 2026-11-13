// Libellés des paiements (docs/api-sprint2.md §2.1).
export const MOYENS = { carte: 'Carte bancaire', mobile_money: 'Mobile Money' }

export const STATUTS_PAIEMENT = {
  en_attente: ['En attente', 'bg-ocre-clair text-alerte'],
  reussi: ['Payé', 'bg-succes-clair text-succes'],
  echoue: ['Échoué', 'bg-erreur-clair text-erreur'],
  rembourse: ['Remboursé', 'bg-indigo-clair text-[#1F3457]'],
  doublon: ['En double, remboursement prévu', 'bg-indigo-clair text-[#1F3457]'],
}

// Lien présenté comme le bouton principal.
export const LIEN_BOUTON =
  'inline-flex h-11 items-center justify-center rounded-champ bg-accent px-[18px] text-[15px] font-semibold text-white hover:bg-accent-fonce'

// Page de paiement du fournisseur (FedaPay), hors du site. Isolé pour être remplacé dans les tests.
export function ouvrirPageFournisseur(url) {
  window.location.assign(url)
}
