-- Apps soumises par les développeurs (US-11). Une app reste en brouillon tant que l'offre
-- n'est pas payée (US-12) ; l'admin la vérifie ensuite avant le lancement (US-14).
CREATE TYPE statut_app AS ENUM ('brouillon', 'en_verification', 'validee', 'refusee');

-- Type du compte développeur Google Play : seuls les comptes personnels créés après le
-- 13/11/2023 doivent faire tester leur app par 12 testeurs pendant 14 jours.
CREATE TYPE compte_play AS ENUM ('personnel_recent', 'personnel_ancien', 'organisation');

CREATE TABLE apps (
  id BIGSERIAL PRIMARY KEY,
  developpeur_id BIGINT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  nom TEXT NOT NULL CHECK (char_length(nom) BETWEEN 2 AND 50),
  package TEXT NOT NULL CHECK (char_length(package) BETWEEN 3 AND 150),
  lien_test_ferme TEXT NOT NULL CHECK (char_length(lien_test_ferme) <= 300),
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 20 AND 2000),
  instructions TEXT NOT NULL CHECK (char_length(instructions) BETWEEN 20 AND 2000),
  fonctionnalites TEXT[] NOT NULL CHECK (cardinality(fonctionnalites) BETWEEN 3 AND 10),
  connexion_requise BOOLEAN NOT NULL,
  identifiants_test TEXT CHECK (char_length(identifiants_test) BETWEEN 5 AND 500),
  compte_play compte_play NOT NULL,
  statut statut_app NOT NULL DEFAULT 'brouillon',
  cree_le TIMESTAMPTZ NOT NULL DEFAULT now(),
  modifie_le TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT identifiants_si_connexion CHECK (connexion_requise = (identifiants_test IS NOT NULL))
);

-- Un package ne peut être testé que par un seul compte à la fois (une app refusée libère le package).
CREATE UNIQUE INDEX apps_package_unique ON apps (lower(package)) WHERE statut <> 'refusee';
CREATE INDEX apps_developpeur ON apps (developpeur_id, cree_le DESC);
CREATE INDEX apps_file_admin ON apps (statut, modifie_le);
