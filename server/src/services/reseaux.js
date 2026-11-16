// US-16 : réseaux Wi-Fi vus pour chaque testeur (docs/api-reseaux.md).
export async function noterReseau(db, { testeurId, empreinte, maintenant }) {
  if (!empreinte) return
  await db.query(
    `INSERT INTO reseaux_testeurs (testeur_id, empreinte, premier_vu_le, dernier_vu_le) VALUES ($1, $2, $3, $3)
     ON CONFLICT (testeur_id, empreinte) DO UPDATE SET dernier_vu_le = GREATEST(reseaux_testeurs.dernier_vu_le, EXCLUDED.dernier_vu_le)`,
    [testeurId, empreinte, maintenant],
  )
}
