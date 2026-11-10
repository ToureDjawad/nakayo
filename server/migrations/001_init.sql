-- Schéma initial : comptes utilisateurs.
-- Les tables métier (apps, campagnes, rapports, paiements) viendront avec leurs stories.

CREATE TYPE role_utilisateur AS ENUM ('developpeur', 'testeur', 'admin');
CREATE TYPE statut_compte AS ENUM ('en_attente', 'valide', 'refuse', 'suspendu');

CREATE TABLE utilisateurs (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  mot_de_passe_hash TEXT NOT NULL,
  role role_utilisateur NOT NULL,
  statut statut_compte NOT NULL DEFAULT 'en_attente',
  nom TEXT,
  pays CHAR(2),
  telephone TEXT,
  cree_le TIMESTAMPTZ NOT NULL DEFAULT now(),
  modifie_le TIMESTAMPTZ NOT NULL DEFAULT now()
);
