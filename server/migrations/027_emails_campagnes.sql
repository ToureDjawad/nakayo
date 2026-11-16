-- US-26 : emails envoyés au développeur aux étapes de sa campagne, une seule fois chacun.
-- L'alerte « moins de 13 testeurs actifs » est effacée quand la campagne repasse à 13, pour
-- pouvoir prévenir de nouveau.
CREATE TABLE emails_campagnes (
  campagne_id BIGINT NOT NULL REFERENCES campagnes(id) ON DELETE CASCADE,
  etape TEXT NOT NULL CHECK (etape IN ('rappel_version_j5', 'mi_parcours', 'rappel_version_j10', 'testeurs_actifs')),
  envoye_le TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (campagne_id, etape)
);
