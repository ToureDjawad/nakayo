-- Résultats des contrôles automatiques des comptes (docs/api-sprint1.md §6 et §7.4).

CREATE TYPE resultat_controle AS ENUM ('ok', 'alerte', 'echec', 'indisponible');

CREATE TABLE controles_comptes (
  id BIGSERIAL PRIMARY KEY,
  utilisateur_id BIGINT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  libelle TEXT NOT NULL,
  resultat resultat_controle NOT NULL,
  detail TEXT,
  verifie_le TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (utilisateur_id, code)
);
