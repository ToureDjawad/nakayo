-- Offre Lancement Afrique sur devis (US-37), docs/api-offres.md §4.
-- Le développeur décrit son besoin pour une app en brouillon ; l'équipe propose un prix ou refuse
-- avec un message. Le développeur paie ensuite le prix proposé.
CREATE TABLE devis (
  id BIGSERIAL PRIMARY KEY,
  app_id BIGINT NOT NULL UNIQUE REFERENCES apps(id) ON DELETE CASCADE,
  developpeur_id BIGINT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  pays TEXT[] NOT NULL CHECK (cardinality(pays) BETWEEN 1 AND 6),
  langues TEXT[] NOT NULL CHECK (cardinality(langues) BETWEEN 1 AND 4),
  profils TEXT NOT NULL CHECK (char_length(profils) BETWEEN 10 AND 1000),
  scenarios TEXT NOT NULL CHECK (char_length(scenarios) BETWEEN 10 AND 2000),
  statut TEXT NOT NULL DEFAULT 'demande' CHECK (statut IN ('demande', 'propose', 'refuse')),
  -- Prix proposés, dans la plus petite unité : au moins le prix de départ de l'offre.
  prix_carte INTEGER CHECK (prix_carte BETWEEN 9900 AND 1000000),
  prix_mobile_money INTEGER CHECK (prix_mobile_money BETWEEN 59400 AND 600000000),
  message TEXT CHECK (char_length(message) BETWEEN 1 AND 1000),
  admin_id BIGINT REFERENCES utilisateurs(id) ON DELETE SET NULL,
  demande_le TIMESTAMPTZ NOT NULL,
  repondu_le TIMESTAMPTZ,
  CONSTRAINT proposition_complete CHECK ((statut = 'propose') = (prix_carte IS NOT NULL AND prix_mobile_money IS NOT NULL)),
  CONSTRAINT refus_explique CHECK (statut <> 'refuse' OR message IS NOT NULL),
  CONSTRAINT reponse_datee CHECK ((statut = 'demande') = (repondu_le IS NULL))
);
CREATE INDEX devis_file ON devis (statut, demande_le);
