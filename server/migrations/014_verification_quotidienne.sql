-- Vérification de chaque nuit (US-20, docs/api-sprint3.md §3).

-- Une ligne par affectation et par jour vérifié : la clé rend la vérification rejouable sans
-- compter deux fois le même jour.
CREATE TABLE journees (
  affectation_id BIGINT NOT NULL REFERENCES affectations(id) ON DELETE CASCADE,
  jour DATE NOT NULL,
  connexion BOOLEAN NOT NULL,
  usage_secondes INTEGER NOT NULL,
  rapport BOOLEAN NOT NULL,
  valide BOOLEAN NOT NULL,
  verifie_le TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (affectation_id, jour)
);

-- Jours entièrement vérifiés.
CREATE TABLE verifications_quotidiennes (
  jour DATE PRIMARY KEY,
  terminee_le TIMESTAMPTZ NOT NULL,
  affectations INTEGER NOT NULL,
  jours_valides INTEGER NOT NULL,
  remises INTEGER NOT NULL
);

ALTER TABLE affectations ADD COLUMN derniere_remise_jour DATE;
