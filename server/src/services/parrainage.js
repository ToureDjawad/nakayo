import { montantLisible } from '../lib/offres.js'
import { nomCourt, PRIME_PARRAINAGE } from '../lib/parrainage.js'
import { nouvelleReferenceVersement } from './versements.js'

// Parrainage entre testeurs (US-39, docs/api-parrainage.md).

// Identifiant du parrain à partir de son code (null s'il n'existe pas).
export async function trouverParrain(db, code) {
  const { rows } = await db.query('SELECT utilisateur_id FROM profils_testeurs WHERE code_parrainage = $1', [code])
  return rows[0]?.utilisateur_id ?? null
}

// À la clôture d'une campagne : prime du parrain de chaque testeur payé, une seule fois par
// filleul (sa première campagne menée au bout). Le parrain doit être un testeur validé.
export async function creerPrimesParrainage(client, { filleulIds, campagneParFilleul, maintenant }) {
  if (!filleulIds.length) return 0
  const { rows } = await client.query(
    `SELECT f.utilisateur_id AS filleul_id, p.utilisateur_id AS parrain_id, p.numero_momo, p.operateur_momo
       FROM profils_testeurs f
       JOIN profils_testeurs p ON p.utilisateur_id = f.parrain_id
       JOIN utilisateurs u ON u.id = p.utilisateur_id AND u.statut = 'valide'
      WHERE f.utilisateur_id = ANY($1)
        AND NOT EXISTS (SELECT 1 FROM versements v WHERE v.filleul_id = f.utilisateur_id)`,
    [filleulIds],
  )
  let crees = 0
  for (const l of rows) {
    const { rowCount } = await client.query(
      `INSERT INTO versements (reference, nature, filleul_id, campagne_id, testeur_id, montant, devise, numero_momo, operateur_momo,
                               prochaine_tentative_le, cree_le)
       VALUES ($1, 'parrainage', $2, $3, $4, $5, $6, $7, $8, $9, $9) ON CONFLICT (filleul_id) DO NOTHING`,
      [
        nouvelleReferenceVersement(),
        l.filleul_id,
        campagneParFilleul.get(String(l.filleul_id)),
        l.parrain_id,
        PRIME_PARRAINAGE.montant,
        PRIME_PARRAINAGE.devise,
        l.numero_momo,
        l.operateur_momo,
        maintenant,
      ],
    )
    crees += rowCount
  }
  return crees
}

// État d'un filleul vu par son parrain.
function etatFilleul(l) {
  if (l.versement_statut) return l.versement_statut === 'verse' ? 'prime_versee' : 'prime_en_paiement'
  if (l.statut === 'en_attente') return 'compte_en_validation'
  if (l.statut === 'valide') return 'en_attente_de_campagne'
  return 'inactif'
}

// GET /api/testeurs/moi/parrainage : code, prime et filleuls.
export async function lireParrainage(db, testeurId) {
  const { rows: moi } = await db.query('SELECT code_parrainage FROM profils_testeurs WHERE utilisateur_id = $1', [testeurId])
  const { rows } = await db.query(
    `SELECT u.nom, u.statut, u.cree_le, v.statut AS versement_statut, v.montant
       FROM profils_testeurs f
       JOIN utilisateurs u ON u.id = f.utilisateur_id
       LEFT JOIN versements v ON v.filleul_id = f.utilisateur_id AND v.nature = 'parrainage' AND v.testeur_id = $1
      WHERE f.parrain_id = $1
      ORDER BY u.cree_le DESC, u.id DESC`,
    [testeurId],
  )
  const gagne = rows.filter((l) => l.versement_statut === 'verse').reduce((total, l) => total + l.montant, 0)
  return {
    code: moi[0]?.code_parrainage ?? null,
    prime: { ...PRIME_PARRAINAGE, montantLisible: montantLisible(PRIME_PARRAINAGE.montant, PRIME_PARRAINAGE.devise) },
    totalVerse: gagne,
    totalVerseLisible: montantLisible(gagne, PRIME_PARRAINAGE.devise),
    filleuls: rows.map((l) => ({
      nom: nomCourt(l.nom),
      inscritLe: l.cree_le.toISOString(),
      etat: etatFilleul(l),
    })),
  }
}
