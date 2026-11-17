-- US-45 : abonnement mensuel des agences et studios (docs/abonnement.md).
-- 69 $ (41 400 FCFA) par mois pour 3 campagnes Standard. Pas de prélèvement automatique :
-- le développeur renouvelle chaque mois (Mobile Money ou carte via FedaPay).
CREATE TABLE abonnements (
  id BIGSERIAL PRIMARY KEY,
  developpeur_id BIGINT NOT NULL UNIQUE REFERENCES utilisateurs(id) ON DELETE CASCADE,
  -- Numéro qui reçoit les rappels par SMS (le numéro Mobile Money, ou un numéro donné à la souscription).
  telephone_rappels TEXT,
  cree_le TIMESTAMPTZ NOT NULL
);

-- Un mois payé. Les mois se suivent : un renouvellement avant l'échéance commence à l'échéance.
CREATE TABLE periodes_abonnement (
  id BIGSERIAL PRIMARY KEY,
  abonnement_id BIGINT NOT NULL REFERENCES abonnements(id) ON DELETE CASCADE,
  paiement_id BIGINT NOT NULL UNIQUE,
  debut TIMESTAMPTZ NOT NULL,
  fin TIMESTAMPTZ NOT NULL CHECK (fin > debut)
);
CREATE INDEX periodes_abonnement_fin ON periodes_abonnement (abonnement_id, fin DESC);

-- Rappels envoyés pour une échéance : 3 jours avant, le jour même, puis à la suspension.
CREATE TABLE rappels_abonnement (
  abonnement_id BIGINT NOT NULL REFERENCES abonnements(id) ON DELETE CASCADE,
  echeance TIMESTAMPTZ NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('j_moins_3', 'jour_j', 'suspension')),
  envoye_le TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (abonnement_id, echeance, type)
);

-- Paiement d'un mois d'abonnement : pas d'app.
ALTER TABLE paiements ALTER COLUMN app_id DROP NOT NULL;
ALTER TABLE paiements DROP CONSTRAINT paiements_nature_check;
ALTER TABLE paiements ADD CONSTRAINT paiements_nature_check CHECK (nature IN ('offre', 'montee_en_gamme', 'abonnement'));
ALTER TABLE paiements ADD CONSTRAINT paiements_app_sauf_abonnement CHECK ((nature = 'abonnement') = (app_id IS NULL));
ALTER TABLE periodes_abonnement ADD CONSTRAINT periodes_abonnement_paiement FOREIGN KEY (paiement_id) REFERENCES paiements(id);

-- Campagne prise sur l'abonnement plutôt que payée : l'app garde la trace de l'usage.
ALTER TABLE apps ADD COLUMN abonnement_id BIGINT REFERENCES abonnements(id);
ALTER TABLE apps ADD COLUMN abonnement_utilise_le TIMESTAMPTZ;
ALTER TABLE apps ADD CONSTRAINT apps_usage_abonnement CHECK ((abonnement_id IS NULL) = (abonnement_utilise_le IS NULL));
