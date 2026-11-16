-- US-16 : deux testeurs qui partagent un réseau Wi-Fi ne sont jamais dans la même campagne.
-- L'app envoie son rapport du jour en indiquant si elle est en Wi-Fi ; le serveur garde alors une
-- empreinte de l'adresse IP publique de ce Wi-Fi (HMAC, jamais l'adresse elle-même).
-- Les connexions mobiles sont ignorées : les opérateurs partagent une même IP entre beaucoup d'abonnés.
CREATE TABLE reseaux_testeurs (
  testeur_id BIGINT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  empreinte TEXT NOT NULL CHECK (char_length(empreinte) = 32),
  premier_vu_le TIMESTAMPTZ NOT NULL,
  dernier_vu_le TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (testeur_id, empreinte)
);
CREATE INDEX reseaux_empreinte ON reseaux_testeurs (empreinte, dernier_vu_le DESC);
