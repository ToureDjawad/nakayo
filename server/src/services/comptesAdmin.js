import { lireControles } from './controles.js'

// Comptes visibles par l'admin : email vérifié (développeur) ou téléphone vérifié (testeur).
export const VISIBLE = `u.role <> 'admin' AND (
  (u.role = 'developpeur' AND u.email_verifie_le IS NOT NULL) OR (u.role = 'testeur' AND u.telephone_verifie_le IS NOT NULL)
)`

const COLONNES = `u.id, u.role, u.statut, u.nom, u.email, u.pays, u.lien_fiche_developpeur, u.telephone, u.cree_le, u.motif_sanction,
  p.ville, p.gmail, p.numero_momo, p.operateur_momo,
  a.fabricant, a.modele, a.version_android, a.niveau_api`

const JOINTURES = `LEFT JOIN profils_testeurs p ON p.utilisateur_id = u.id
  LEFT JOIN LATERAL (
    SELECT * FROM appareils WHERE utilisateur_id = u.id ORDER BY derniere_vue_le DESC, id DESC LIMIT 1
  ) a ON true`

function versCompte(l, controles) {
  return {
    id: String(l.id),
    role: l.role,
    statut: l.statut,
    motifSanction: l.motif_sanction ?? null,
    nom: l.nom,
    creeLe: new Date(l.cree_le).toISOString(),
    developpeur:
      l.role === 'developpeur' ? { email: l.email, pays: l.pays, lienFicheDeveloppeur: l.lien_fiche_developpeur } : null,
    testeur:
      l.role === 'testeur'
        ? {
            telephone: l.telephone,
            ville: l.ville,
            gmail: l.gmail,
            numeroMomo: l.numero_momo,
            operateurMomo: l.operateur_momo,
            appareil: l.modele
              ? { fabricant: l.fabricant, modele: l.modele, versionAndroid: l.version_android, niveauApi: l.niveau_api }
              : null,
          }
        : null,
    controles: controles ?? { etat: 'en_cours', liste: [] },
  }
}

// §5.1 Liste filtrée et paginée. Les dates `du` et `au` sont des jours à l'heure du Bénin.
export async function listerComptes(db, { statut, role, du, au, tri, page, parPage }) {
  const conditions = [VISIBLE, 'u.statut = $1']
  const valeurs = [statut]
  if (role) {
    valeurs.push(role)
    conditions.push(`u.role = $${valeurs.length}`)
  }
  if (du) {
    valeurs.push(du)
    conditions.push(`(u.cree_le AT TIME ZONE 'Africa/Porto-Novo')::date >= $${valeurs.length}::date`)
  }
  if (au) {
    valeurs.push(au)
    conditions.push(`(u.cree_le AT TIME ZONE 'Africa/Porto-Novo')::date <= $${valeurs.length}::date`)
  }
  const ordre = tri === 'recent' ? 'u.cree_le DESC, u.id DESC' : 'u.cree_le ASC, u.id ASC'
  valeurs.push(parPage, (page - 1) * parPage)
  const { rows } = await db.query(
    `SELECT ${COLONNES}, count(*) OVER ()::int AS total
       FROM utilisateurs u ${JOINTURES}
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${ordre}
      LIMIT $${valeurs.length - 1} OFFSET $${valeurs.length}`,
    valeurs,
  )
  let total = rows[0]?.total ?? 0
  if (!rows.length && page > 1) {
    // Page au-delà de la fin : on renvoie quand même le total pour que le front se recale.
    const { rows: compte } = await db.query(
      `SELECT count(*)::int AS total FROM utilisateurs u WHERE ${conditions.join(' AND ')}`,
      valeurs.slice(0, -2),
    )
    total = compte[0].total
  }
  const controles = await lireControles(
    db,
    rows.map((l) => l.id),
  )
  return { comptes: rows.map((l) => versCompte(l, controles.get(String(l.id)))), total, page, parPage }
}

// §5.2 Un compte, avec les liens vers les photos d'un testeur.
export async function lireCompte(db, id) {
  const { rows } = await db.query(`SELECT ${COLONNES} FROM utilisateurs u ${JOINTURES} WHERE u.id = $1 AND ${VISIBLE}`, [
    id,
  ])
  if (!rows.length) return null
  const controles = await lireControles(db, [rows[0].id])
  const compte = versCompte(rows[0], controles.get(String(rows[0].id)))
  if (compte.role === 'testeur') {
    const { rows: documents } = await db.query('SELECT type FROM documents_identite WHERE utilisateur_id = $1', [id])
    const types = new Set(documents.map((d) => d.type))
    compte.documents = {
      pieceIdentite: types.has('piece_identite') ? `/api/admin/comptes/${compte.id}/documents/piece-identite` : null,
      selfie: types.has('selfie') ? `/api/admin/comptes/${compte.id}/documents/selfie` : null,
    }
  }
  return compte
}
