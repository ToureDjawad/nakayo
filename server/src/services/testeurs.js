// Lecture du profil testeur (contrat §4.4) et enregistrement de l'appareil.
import { niveauTesteur } from '../lib/niveaux.js'

export async function enregistrerAppareil(db, { utilisateurId, appareil, maintenant }) {
  await db.query(
    `INSERT INTO appareils (utilisateur_id, identifiant, fabricant, modele, version_android, niveau_api,
                            premiere_vue_le, derniere_vue_le, ram_mo)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8)
     ON CONFLICT (utilisateur_id, identifiant) DO UPDATE
       SET fabricant = EXCLUDED.fabricant, modele = EXCLUDED.modele, version_android = EXCLUDED.version_android,
           niveau_api = EXCLUDED.niveau_api, derniere_vue_le = EXCLUDED.derniere_vue_le,
           ram_mo = COALESCE(EXCLUDED.ram_mo, appareils.ram_mo)`,
    [
      utilisateurId,
      appareil.identifiant,
      appareil.fabricant,
      appareil.modele,
      appareil.versionAndroid,
      appareil.niveauApi,
      maintenant,
      appareil.ramMo ?? null,
    ],
  )
}

export function versDemandeApi(ligne) {
  return {
    id: String(ligne.id),
    numeroMomo: ligne.numero_momo,
    operateurMomo: ligne.operateur_momo,
    statut: ligne.statut,
    creeLe: new Date(ligne.cree_le).toISOString(),
  }
}

export async function lireProfilTesteur(db, utilisateurId) {
  const { rows } = await db.query(
    `SELECT u.id, u.role, u.statut, u.telephone, u.nom, u.motif_refus, u.cree_le,
            p.ville, p.gmail, p.numero_momo, p.operateur_momo, p.langues,
            a.fabricant, a.modele, a.version_android, a.niveau_api,
            d.id AS demande_id, d.numero_momo AS demande_numero, d.operateur_momo AS demande_operateur,
            d.statut AS demande_statut, d.cree_le AS demande_cree_le,
            st.terminees, st.remplacees, st.remises,
            (SELECT count(*) FROM bugs b WHERE b.testeur_id = u.id AND b.statut = 'accepte')::int AS bugs_acceptes
       FROM utilisateurs u
       JOIN profils_testeurs p ON p.utilisateur_id = u.id
       LEFT JOIN LATERAL (
         SELECT * FROM appareils WHERE utilisateur_id = u.id ORDER BY derniere_vue_le DESC, id DESC LIMIT 1
       ) a ON true
       LEFT JOIN demandes_changement_momo d ON d.utilisateur_id = u.id AND d.statut = 'en_attente'
       CROSS JOIN LATERAL (
         SELECT count(*) FILTER (WHERE statut = 'terminee')::int AS terminees,
                count(*) FILTER (WHERE statut = 'remplacee')::int AS remplacees,
                COALESCE(sum(nombre_remises), 0)::int AS remises
           FROM affectations WHERE testeur_id = u.id
       ) st
      WHERE u.id = $1 AND u.role = 'testeur'`,
    [utilisateurId],
  )
  const l = rows[0]
  if (!l) return null
  return {
    id: String(l.id),
    role: l.role,
    statut: l.statut,
    telephone: l.telephone,
    nom: l.nom,
    ville: l.ville,
    gmail: l.gmail,
    numeroMomo: l.numero_momo,
    operateurMomo: l.operateur_momo,
    langues: l.langues,
    appareil: l.modele
      ? { fabricant: l.fabricant, modele: l.modele, versionAndroid: l.version_android, niveauApi: l.niveau_api }
      : null,
    demandeChangementMomo: l.demande_id
      ? versDemandeApi({
          id: l.demande_id,
          numero_momo: l.demande_numero,
          operateur_momo: l.demande_operateur,
          statut: l.demande_statut,
          cree_le: l.demande_cree_le,
        })
      : null,
    motifRefus: l.motif_refus,
    creeLe: new Date(l.cree_le).toISOString(),
    // US-38 : niveau Bronze, Argent ou Or, et ce qu'il manque pour le suivant.
    niveau: niveauTesteur({ terminees: l.terminees, remplacees: l.remplacees, remises: l.remises, bugsAcceptes: l.bugs_acceptes }),
  }
}
