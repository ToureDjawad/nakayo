-- Campagnes de test et affectation des testeurs (US-16, US-13, US-43, docs/api-sprint3.md §1).
-- Une campagne dure 16 jours (14 exigés par Google et 2 de marge) avec 15 testeurs
-- (12 exigés et 3 de réserve).
CREATE TYPE statut_campagne AS ENUM ('en_cours', 'terminee', 'annulee');
CREATE TYPE statut_affectation AS ENUM ('active', 'remplacee', 'terminee');

CREATE TABLE campagnes (
  id BIGSERIAL PRIMARY KEY,
  app_id BIGINT NOT NULL REFERENCES apps(id) ON DELETE RESTRICT,
  developpeur_id BIGINT NOT NULL REFERENCES utilisateurs(id) ON DELETE RESTRICT,
  statut statut_campagne NOT NULL DEFAULT 'en_cours',
  testeurs_vises SMALLINT NOT NULL DEFAULT 15,
  jours_exiges SMALLINT NOT NULL DEFAULT 14,
  -- Adresse du Groupe Google que le développeur a ajoutée à son test fermé.
  groupe_google TEXT,
  demarree_le TIMESTAMPTZ NOT NULL,
  fin_prevue_le TIMESTAMPTZ NOT NULL,
  terminee_le TIMESTAMPTZ,
  cree_le TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Une seule campagne en cours par app.
CREATE UNIQUE INDEX campagnes_une_en_cours ON campagnes (app_id) WHERE statut = 'en_cours';
CREATE INDEX campagnes_developpeur ON campagnes (developpeur_id, demarree_le DESC);
CREATE INDEX campagnes_statut ON campagnes (statut, demarree_le);

CREATE TABLE affectations (
  id BIGSERIAL PRIMARY KEY,
  campagne_id BIGINT NOT NULL REFERENCES campagnes(id) ON DELETE CASCADE,
  -- Copie de l'app de la campagne : un testeur n'est jamais affecté deux fois à la même app.
  app_id BIGINT NOT NULL REFERENCES apps(id) ON DELETE RESTRICT,
  testeur_id BIGINT NOT NULL REFERENCES utilisateurs(id) ON DELETE RESTRICT,
  statut statut_affectation NOT NULL DEFAULT 'active',
  affecte_le TIMESTAMPTZ NOT NULL,
  -- Le testeur a accepté le lien d'inscription au test (capture de la page « Vous êtes testeur »).
  inscription_confirmee_le TIMESTAMPTZ,
  capture_inscription TEXT,
  -- L'app testée est installée depuis le Play Store.
  installation_confirmee_le TIMESTAMPTZ,
  -- Compteur Nakayo (US-20), qui sert au paiement du testeur. Celui de Google ne dépend que
  -- de l'inscription continue au test.
  jours_valides SMALLINT NOT NULL DEFAULT 0,
  nombre_remises SMALLINT NOT NULL DEFAULT 0,
  remplacee_le TIMESTAMPTZ,
  remplacee_par BIGINT REFERENCES affectations(id),
  motif_remplacement TEXT,
  terminee_le TIMESTAMPTZ,
  CONSTRAINT remplacement_complet CHECK ((statut = 'remplacee') = (remplacee_le IS NOT NULL))
);
CREATE UNIQUE INDEX affectations_une_par_app ON affectations (app_id, testeur_id);
CREATE INDEX affectations_campagne ON affectations (campagne_id, id);
CREATE INDEX affectations_testeur_actives ON affectations (testeur_id) WHERE statut = 'active';
