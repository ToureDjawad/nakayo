-- Vérification des apps payées par l'équipe (US-14) : validation, ou refus avec motif et
-- remboursement du paiement. Chaque décision est gardée dans l'historique.
ALTER TABLE apps
  ADD COLUMN motif_refus TEXT,
  ADD COLUMN decide_par BIGINT REFERENCES utilisateurs(id),
  ADD COLUMN decide_le TIMESTAMPTZ,
  ADD CONSTRAINT motif_si_refusee CHECK (statut <> 'refusee' OR motif_refus IS NOT NULL);

CREATE TABLE decisions_apps (
  id BIGSERIAL PRIMARY KEY,
  app_id BIGINT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  admin_id BIGINT NOT NULL REFERENCES utilisateurs(id),
  decision statut_app NOT NULL CHECK (decision IN ('validee', 'refusee')),
  motif TEXT,
  -- Paiement remboursé par cette décision (refus d'une app payée).
  paiement_rembourse_id BIGINT REFERENCES paiements(id),
  cree_le TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (decision = 'validee' OR motif IS NOT NULL)
);
CREATE INDEX decisions_apps_app ON decisions_apps (app_id, cree_le DESC);
