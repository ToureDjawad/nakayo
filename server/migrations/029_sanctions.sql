-- US-29 : suspension, bannissement et réactivation des comptes, journal des actions admin.
ALTER TYPE statut_compte ADD VALUE IF NOT EXISTS 'banni';
ALTER TYPE decision_compte ADD VALUE IF NOT EXISTS 'suspendu';
ALTER TYPE decision_compte ADD VALUE IF NOT EXISTS 'banni';
ALTER TYPE decision_compte ADD VALUE IF NOT EXISTS 'reactive';

-- Motif de la dernière sanction, montré à l'admin.
ALTER TABLE utilisateurs ADD COLUMN motif_sanction TEXT;

-- Bannissement : numéro, Mobile Money, téléphone (identifiant d'app) et email ne peuvent plus
-- servir à un nouveau compte, même si l'ancien est supprimé.
CREATE TABLE blocages (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('telephone', 'momo', 'appareil', 'email')),
  valeur TEXT NOT NULL,
  utilisateur_id BIGINT REFERENCES utilisateurs(id) ON DELETE SET NULL,
  cree_le TIMESTAMPTZ NOT NULL,
  UNIQUE (type, valeur)
);

-- Journal des actions des admins (décisions, sanctions, remplacements, alertes...).
CREATE TABLE journal_admin (
  id BIGSERIAL PRIMARY KEY,
  admin_id BIGINT NOT NULL REFERENCES utilisateurs(id),
  action TEXT NOT NULL,
  cible TEXT NOT NULL,
  cible_id TEXT NOT NULL,
  detail TEXT,
  cree_le TIMESTAMPTZ NOT NULL
);
CREATE INDEX journal_admin_date ON journal_admin (cree_le DESC, id DESC);

-- La réactivation peut se faire sans motif, comme la validation. Le nouveau littéral n'est pas
-- utilisable dans cette transaction : on compare le texte.
ALTER TABLE decisions_comptes DROP CONSTRAINT decisions_comptes_check;
ALTER TABLE decisions_comptes ADD CONSTRAINT decisions_comptes_check
  CHECK (decision::text IN ('valide', 'reactive') OR motif IS NOT NULL);
