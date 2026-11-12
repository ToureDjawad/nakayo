-- Paiement de l'offre Standard (US-12) et factures (US-15).
-- Le paiement passe par un fournisseur (carte ou agrégateur Mobile Money) qui confirme par
-- webhook ; en développement, un fournisseur « simulation » joue ce rôle.
CREATE TYPE moyen_paiement AS ENUM ('carte', 'mobile_money');
-- doublon : deuxième paiement confirmé pour une app déjà payée (à rembourser à la main).
CREATE TYPE statut_paiement AS ENUM ('en_attente', 'reussi', 'echoue', 'rembourse', 'doublon');

CREATE TABLE paiements (
  id BIGSERIAL PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  app_id BIGINT NOT NULL REFERENCES apps(id) ON DELETE RESTRICT,
  developpeur_id BIGINT NOT NULL REFERENCES utilisateurs(id) ON DELETE RESTRICT,
  offre TEXT NOT NULL DEFAULT 'standard',
  moyen moyen_paiement NOT NULL,
  -- Montant en plus petite unité : centimes pour USD, francs pour XOF (pas de centimes).
  montant INTEGER NOT NULL CHECK (montant > 0),
  devise TEXT NOT NULL CHECK (devise IN ('USD', 'XOF')),
  fournisseur TEXT NOT NULL,
  reference_fournisseur TEXT,
  numero_momo TEXT,
  statut statut_paiement NOT NULL DEFAULT 'en_attente',
  cree_le TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirme_le TIMESTAMPTZ,
  rembourse_le TIMESTAMPTZ,
  CONSTRAINT momo_si_mobile_money CHECK ((moyen = 'mobile_money') = (numero_momo IS NOT NULL))
);
-- Une app n'est payée qu'une fois.
CREATE UNIQUE INDEX paiements_un_reussi_par_app ON paiements (app_id) WHERE statut = 'reussi';
CREATE INDEX paiements_developpeur ON paiements (developpeur_id, cree_le DESC);

-- Numéro de facture continu par année : NKY-2026-00001.
CREATE TABLE compteurs_factures (
  annee INTEGER PRIMARY KEY,
  dernier INTEGER NOT NULL
);

CREATE TABLE factures (
  id BIGSERIAL PRIMARY KEY,
  numero TEXT NOT NULL UNIQUE,
  paiement_id BIGINT NOT NULL UNIQUE REFERENCES paiements(id) ON DELETE RESTRICT,
  developpeur_id BIGINT NOT NULL REFERENCES utilisateurs(id) ON DELETE RESTRICT,
  -- Copie des informations au moment de la facture (le nom peut changer ensuite).
  client_nom TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_pays TEXT,
  libelle TEXT NOT NULL,
  montant INTEGER NOT NULL,
  devise TEXT NOT NULL,
  emise_le TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX factures_developpeur ON factures (developpeur_id, emise_le DESC);
