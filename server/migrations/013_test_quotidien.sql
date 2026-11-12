-- Test quotidien des testeurs (US-17, US-18, US-19, docs/api-sprint3.md §2).

-- US-19 : un rapport par app et par jour (jour du Bénin, à la réception par le serveur).
CREATE TABLE rapports (
  id BIGSERIAL PRIMARY KEY,
  affectation_id BIGINT NOT NULL REFERENCES affectations(id) ON DELETE CASCADE,
  testeur_id BIGINT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  jour DATE NOT NULL,
  actions TEXT NOT NULL CHECK (char_length(actions) BETWEEN 10 AND 500),
  note SMALLINT NOT NULL CHECK (note BETWEEN 1 AND 5),
  bug BOOLEAN NOT NULL,
  commentaire_bug TEXT CHECK (char_length(commentaire_bug) BETWEEN 10 AND 1000),
  fonctionnalites TEXT[] NOT NULL CHECK (cardinality(fonctionnalites) >= 1),
  version_app TEXT NOT NULL CHECK (char_length(version_app) BETWEEN 1 AND 50),
  -- Position arrondie au centième de degré (environ 1 km) : assez pour la ville, pas pour l'adresse.
  latitude NUMERIC(5, 2) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude NUMERIC(5, 2) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  -- Retour écrit détaillé demandé les jours 3, 7 et 12 de la campagne.
  retour_detaille TEXT CHECK (char_length(retour_detaille) BETWEEN 100 AND 2000),
  recu_le TIMESTAMPTZ NOT NULL,
  UNIQUE (affectation_id, jour),
  CONSTRAINT commentaire_si_bug CHECK (bug = (commentaire_bug IS NOT NULL))
);
CREATE INDEX rapports_testeur ON rapports (testeur_id, jour DESC);

-- US-18 : ouvertures de l'app compagnon, horodatées par le serveur (une ligne par testeur et par jour).
CREATE TABLE connexions_compagnon (
  testeur_id BIGINT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  jour DATE NOT NULL,
  premiere_le TIMESTAMPTZ NOT NULL,
  derniere_le TIMESTAMPTZ NOT NULL,
  nombre INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (testeur_id, jour)
);

-- US-18 : temps passé chaque jour dans l'app testée, mesuré par l'app compagnon.
CREATE TABLE usages_quotidiens (
  affectation_id BIGINT NOT NULL REFERENCES affectations(id) ON DELETE CASCADE,
  jour DATE NOT NULL,
  secondes INTEGER NOT NULL CHECK (secondes BETWEEN 0 AND 86400),
  maj_le TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (affectation_id, jour)
);
