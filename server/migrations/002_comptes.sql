-- Comptes : identifiants des testeurs, vérification de l'email, sessions, jetons envoyés par email
-- et historique des décisions admin (docs/api-sprint1.md §7.2).

-- Les testeurs n'ont ni email ni mot de passe : ils s'identifient par téléphone.
ALTER TABLE utilisateurs
  ALTER COLUMN email DROP NOT NULL,
  ALTER COLUMN mot_de_passe_hash DROP NOT NULL,
  ADD COLUMN email_verifie_le TIMESTAMPTZ,
  ADD COLUMN telephone_verifie_le TIMESTAMPTZ,
  ADD COLUMN lien_fiche_developpeur TEXT,
  ADD COLUMN motif_refus TEXT,
  ADD COLUMN decide_par BIGINT REFERENCES utilisateurs(id),
  ADD COLUMN decide_le TIMESTAMPTZ,
  ADD COLUMN controles_termines_le TIMESTAMPTZ,
  ADD CONSTRAINT identifiants_selon_role CHECK (
    (role IN ('developpeur', 'admin') AND email IS NOT NULL AND mot_de_passe_hash IS NOT NULL)
    OR (role = 'testeur' AND telephone IS NOT NULL)
  ),
  ADD CONSTRAINT motif_si_refus CHECK (statut <> 'refuse' OR motif_refus IS NOT NULL);

CREATE UNIQUE INDEX utilisateurs_telephone_unique ON utilisateurs (telephone) WHERE telephone IS NOT NULL;
CREATE INDEX utilisateurs_file_admin ON utilisateurs (statut, role, cree_le);
CREATE UNIQUE INDEX utilisateurs_fiche_unique ON utilisateurs (lien_fiche_developpeur)
  WHERE lien_fiche_developpeur IS NOT NULL AND statut <> 'refuse';

CREATE TYPE client_session AS ENUM ('web', 'android');

CREATE TABLE sessions (
  id BIGSERIAL PRIMARY KEY,
  utilisateur_id BIGINT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  jeton_hash BYTEA NOT NULL UNIQUE,
  client client_session NOT NULL,
  cree_le TIMESTAMPTZ NOT NULL DEFAULT now(),
  expire_le TIMESTAMPTZ NOT NULL,          -- cree_le + 30 jours
  utilisee_le TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoquee_le TIMESTAMPTZ
);
CREATE INDEX sessions_utilisateur ON sessions (utilisateur_id) WHERE revoquee_le IS NULL;

CREATE TYPE type_jeton_email AS ENUM ('verification_email', 'reinitialisation_mot_de_passe');

CREATE TABLE jetons_email (
  id BIGSERIAL PRIMARY KEY,
  utilisateur_id BIGINT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  type type_jeton_email NOT NULL,
  jeton_hash BYTEA NOT NULL UNIQUE,
  expire_le TIMESTAMPTZ NOT NULL,          -- 24 h (vérification) ou 1 h (réinitialisation)
  utilise_le TIMESTAMPTZ,
  cree_le TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE decision_compte AS ENUM ('valide', 'refuse');

-- Historique des décisions admin (US-08). Le statut courant reste dans utilisateurs.
CREATE TABLE decisions_comptes (
  id BIGSERIAL PRIMARY KEY,
  utilisateur_id BIGINT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  admin_id BIGINT NOT NULL REFERENCES utilisateurs(id),
  decision decision_compte NOT NULL,
  motif TEXT,
  cree_le TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (decision = 'valide' OR motif IS NOT NULL)
);
