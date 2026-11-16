-- Parrainage entre testeurs (US-39, docs/api-parrainage.md). Chaque testeur a un code personnel ;
-- un nouveau testeur peut donner le code de son parrain à l'inscription. Le parrain reçoit une
-- prime quand son filleul mène sa première campagne au bout (versement de clôture créé).

-- 6 caractères sans les signes faciles à confondre (0/O, 1/I/L).
CREATE FUNCTION nouveau_code_parrainage() RETURNS TEXT AS $$
  SELECT string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
    FROM generate_series(1, 6)
$$ LANGUAGE sql VOLATILE;

ALTER TABLE profils_testeurs
  ADD COLUMN code_parrainage TEXT NOT NULL DEFAULT nouveau_code_parrainage(),
  ADD COLUMN parrain_id BIGINT REFERENCES utilisateurs(id) ON DELETE SET NULL,
  ADD CONSTRAINT profils_code_parrainage_unique UNIQUE (code_parrainage),
  ADD CONSTRAINT pas_son_propre_parrain CHECK (parrain_id IS NULL OR parrain_id <> utilisateur_id);
CREATE INDEX profils_parrain ON profils_testeurs (parrain_id) WHERE parrain_id IS NOT NULL;

-- Une prime de parrainage est un versement sans affectation, lié au filleul (une seule par filleul).
ALTER TABLE versements
  ALTER COLUMN affectation_id DROP NOT NULL,
  ADD COLUMN nature TEXT NOT NULL DEFAULT 'campagne' CHECK (nature IN ('campagne', 'parrainage')),
  ADD COLUMN filleul_id BIGINT UNIQUE REFERENCES utilisateurs(id) ON DELETE RESTRICT,
  ADD CONSTRAINT nature_coherente CHECK (
    (nature = 'campagne' AND affectation_id IS NOT NULL AND filleul_id IS NULL)
    OR (nature = 'parrainage' AND affectation_id IS NULL AND filleul_id IS NOT NULL)
  );
