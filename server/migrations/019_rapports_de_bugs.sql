-- Rapports de bugs avec captures (US-33, docs/api-bugs.md) : offres Pro et Lancement Afrique.
-- Le développeur accepte ou refuse chaque bug (US-34) ; un bug accepté rapporte un bonus au testeur,
-- ajouté à son versement de clôture.
CREATE TABLE bugs (
  id BIGSERIAL PRIMARY KEY,
  affectation_id BIGINT NOT NULL REFERENCES affectations(id) ON DELETE CASCADE,
  campagne_id BIGINT NOT NULL REFERENCES campagnes(id) ON DELETE CASCADE,
  app_id BIGINT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  testeur_id BIGINT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  titre TEXT NOT NULL CHECK (char_length(titre) BETWEEN 5 AND 120),
  etapes TEXT NOT NULL CHECK (char_length(etapes) BETWEEN 10 AND 2000),
  resultat_attendu TEXT NOT NULL CHECK (char_length(resultat_attendu) BETWEEN 5 AND 1000),
  resultat_obtenu TEXT NOT NULL CHECK (char_length(resultat_obtenu) BETWEEN 5 AND 1000),
  gravite TEXT NOT NULL CHECK (gravite IN ('mineure', 'genante', 'bloquante')),
  version_app TEXT NOT NULL CHECK (char_length(version_app) BETWEEN 1 AND 50),
  -- Chemins relatifs au dossier des documents (hors du dossier public), 5 au plus.
  captures TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(captures) <= 5),
  statut TEXT NOT NULL DEFAULT 'nouveau' CHECK (statut IN ('nouveau', 'accepte', 'refuse')),
  motif_refus TEXT CHECK (char_length(motif_refus) <= 500),
  decide_le TIMESTAMPTZ,
  signale_le TIMESTAMPTZ NOT NULL,
  CONSTRAINT decision_complete CHECK ((statut = 'nouveau') = (decide_le IS NULL))
);
CREATE INDEX bugs_app ON bugs (app_id, signale_le DESC);
CREATE INDEX bugs_affectation ON bugs (affectation_id, signale_le DESC);
