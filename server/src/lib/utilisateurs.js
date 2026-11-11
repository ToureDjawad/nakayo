// Objet `utilisateur` renvoyé par les routes d'authentification (contrat §1.5).
export function versUtilisateurApi(ligne) {
  return {
    id: String(ligne.id),
    role: ligne.role,
    statut: ligne.statut,
    emailVerifie: ligne.email_verifie_le !== null,
    email: ligne.email,
    nom: ligne.nom,
    pays: ligne.pays,
    lienFicheDeveloppeur: ligne.lien_fiche_developpeur,
    motifRefus: ligne.motif_refus,
    creeLe: new Date(ligne.cree_le).toISOString(),
  }
}

export const COLONNES_UTILISATEUR = `u.id, u.role, u.statut, u.email, u.nom, u.pays, u.lien_fiche_developpeur,
  u.motif_refus, u.email_verifie_le, u.cree_le`
