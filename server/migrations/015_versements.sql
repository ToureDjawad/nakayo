-- Versements Mobile Money aux testeurs (US-22, docs/api-sprint4.md §2).
-- Un versement par affectation qui a ses 14 jours à la clôture de la campagne (J16).
CREATE TYPE statut_versement AS ENUM ('a_verser', 'en_cours', 'verse', 'echoue');

CREATE TABLE versements (
  id BIGSERIAL PRIMARY KEY,
  -- Référence envoyée à l'agrégateur, qui la garde pour ne jamais payer deux fois : VER-<16 caractères>.
  reference TEXT NOT NULL UNIQUE,
  affectation_id BIGINT NOT NULL UNIQUE REFERENCES affectations(id) ON DELETE RESTRICT,
  campagne_id BIGINT NOT NULL REFERENCES campagnes(id) ON DELETE RESTRICT,
  testeur_id BIGINT NOT NULL REFERENCES utilisateurs(id) ON DELETE RESTRICT,
  montant INTEGER NOT NULL CHECK (montant > 0),
  devise TEXT NOT NULL DEFAULT 'XOF',
  -- Numéro et opérateur copiés à la création : le versement garde la trace du compte payé.
  numero_momo TEXT NOT NULL,
  operateur_momo operateur_momo NOT NULL,
  statut statut_versement NOT NULL DEFAULT 'a_verser',
  tentatives SMALLINT NOT NULL DEFAULT 0,
  prochaine_tentative_le TIMESTAMPTZ,
  derniere_tentative_le TIMESTAMPTZ,
  dernier_motif TEXT,
  reference_fournisseur TEXT,
  cree_le TIMESTAMPTZ NOT NULL,
  verse_le TIMESTAMPTZ,
  alerte_le TIMESTAMPTZ
);
CREATE INDEX versements_a_traiter ON versements (prochaine_tentative_le) WHERE statut = 'a_verser';
CREATE INDEX versements_testeur ON versements (testeur_id, cree_le DESC);
CREATE INDEX versements_statut ON versements (statut, cree_le DESC);
