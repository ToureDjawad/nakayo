-- Messages envoyés au support depuis l'espace développeur ou l'app testeur (US-40).
-- L'admin les lit dans le back-office et les marque comme traités.
CREATE TYPE statut_ticket AS ENUM ('ouvert', 'traite');

CREATE TABLE tickets_support (
  id BIGSERIAL PRIMARY KEY,
  utilisateur_id BIGINT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  sujet TEXT NOT NULL CHECK (char_length(sujet) BETWEEN 3 AND 120),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 10 AND 2000),
  statut statut_ticket NOT NULL DEFAULT 'ouvert',
  cree_le TIMESTAMPTZ NOT NULL DEFAULT now(),
  traite_le TIMESTAMPTZ,
  traite_par BIGINT REFERENCES utilisateurs(id) ON DELETE SET NULL,
  CHECK ((statut = 'traite') = (traite_le IS NOT NULL))
);
CREATE INDEX tickets_file_admin ON tickets_support (statut, cree_le);
CREATE INDEX tickets_utilisateur ON tickets_support (utilisateur_id, cree_le DESC);
