-- US-30 : garantie. Si Google refuse l'accès à la production, le développeur demande une
-- nouvelle campagne offerte (ou un remboursement). Une seule garantie par app.
CREATE TABLE garanties (
  id BIGSERIAL PRIMARY KEY,
  app_id BIGINT NOT NULL UNIQUE REFERENCES apps(id) ON DELETE CASCADE,
  campagne_id BIGINT NOT NULL REFERENCES campagnes(id),
  developpeur_id BIGINT NOT NULL REFERENCES utilisateurs(id),
  choix TEXT NOT NULL CHECK (choix IN ('nouvelle_campagne', 'remboursement')),
  motif_google TEXT NOT NULL CHECK (motif_google IN ('engagement_insuffisant', 'testeurs_insuffisants')),
  email_google TEXT NOT NULL CHECK (char_length(email_google) BETWEEN 30 AND 5000),
  statut TEXT NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'acceptee', 'refusee')),
  motif_refus TEXT,
  decide_par BIGINT REFERENCES utilisateurs(id),
  decide_le TIMESTAMPTZ,
  campagne_offerte_id BIGINT REFERENCES campagnes(id),
  paiement_rembourse_id BIGINT REFERENCES paiements(id),
  cree_le TIMESTAMPTZ NOT NULL,
  CHECK (statut <> 'refusee' OR motif_refus IS NOT NULL)
);
CREATE INDEX garanties_statut ON garanties (statut, cree_le);

-- Une campagne offerte se reconnaît : pas de versement de paiement associé, et elle compte à part.
ALTER TABLE campagnes ADD COLUMN offerte BOOLEAN NOT NULL DEFAULT false;
