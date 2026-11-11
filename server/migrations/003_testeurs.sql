-- Testeurs : profil, appareils, pièces d'identité, codes SMS, jetons d'inscription et
-- demandes de changement de numéro Mobile Money (docs/api-sprint1.md §7.3).

CREATE TYPE operateur_momo AS ENUM ('mtn', 'moov');

CREATE TABLE profils_testeurs (
  utilisateur_id BIGINT PRIMARY KEY REFERENCES utilisateurs(id) ON DELETE CASCADE,
  ville TEXT NOT NULL,
  gmail TEXT NOT NULL,
  -- Gmail ignore les points et ce qui suit « + » : k.offi+test@gmail.com = koffi@gmail.com
  gmail_normalise TEXT NOT NULL,
  numero_momo TEXT NOT NULL,
  operateur_momo operateur_momo NOT NULL,
  langues TEXT[] NOT NULL DEFAULT '{}',
  consentement_suivi_le TIMESTAMPTZ NOT NULL,
  conditions_acceptees_le TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX profils_gmail_unique ON profils_testeurs (gmail_normalise);
CREATE UNIQUE INDEX profils_momo_unique ON profils_testeurs (numero_momo);

CREATE TABLE appareils (
  id BIGSERIAL PRIMARY KEY,
  utilisateur_id BIGINT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  identifiant TEXT NOT NULL,               -- identifiant propre à l'app, pas l'IMEI
  fabricant TEXT,
  modele TEXT NOT NULL,
  version_android TEXT NOT NULL,
  niveau_api INTEGER NOT NULL,
  premiere_vue_le TIMESTAMPTZ NOT NULL DEFAULT now(),
  derniere_vue_le TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (utilisateur_id, identifiant)
);
CREATE INDEX appareils_identifiant ON appareils (identifiant);

CREATE TYPE type_document AS ENUM ('piece_identite', 'selfie');

CREATE TABLE documents_identite (
  id BIGSERIAL PRIMARY KEY,
  utilisateur_id BIGINT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  type type_document NOT NULL,
  chemin TEXT NOT NULL,
  type_mime TEXT NOT NULL CHECK (type_mime IN ('image/jpeg', 'image/png')),
  taille_octets INTEGER NOT NULL CHECK (taille_octets <= 5242880),
  cree_le TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (utilisateur_id, type)
);

CREATE TABLE codes_sms (
  id BIGSERIAL PRIMARY KEY,
  telephone TEXT NOT NULL,
  code_hash BYTEA NOT NULL,
  expire_le TIMESTAMPTZ NOT NULL,          -- 10 min
  tentatives SMALLINT NOT NULL DEFAULT 0,  -- invalidé à 5
  utilise_le TIMESTAMPTZ,
  cree_le TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX codes_sms_telephone ON codes_sms (telephone, cree_le DESC);

-- Jeton remis après le code SMS d'un numéro inconnu (§4.2), valable 30 min.
CREATE TABLE jetons_inscription (
  id BIGSERIAL PRIMARY KEY,
  telephone TEXT NOT NULL,
  jeton_hash BYTEA NOT NULL UNIQUE,
  appareil JSONB NOT NULL,
  expire_le TIMESTAMPTZ NOT NULL,
  utilise_le TIMESTAMPTZ,
  cree_le TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE statut_demande AS ENUM ('en_attente', 'acceptee', 'refusee');

CREATE TABLE demandes_changement_momo (
  id BIGSERIAL PRIMARY KEY,
  utilisateur_id BIGINT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  numero_momo TEXT NOT NULL,
  operateur_momo operateur_momo NOT NULL,
  motif TEXT NOT NULL,
  statut statut_demande NOT NULL DEFAULT 'en_attente',
  traitee_par BIGINT REFERENCES utilisateurs(id),
  traitee_le TIMESTAMPTZ,
  cree_le TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX demande_momo_unique_en_cours ON demandes_changement_momo (utilisateur_id)
  WHERE statut = 'en_attente';
