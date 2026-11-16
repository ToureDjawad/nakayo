-- US-28 : alertes de comportements suspects, examinées par l'admin. `cle` évite de signaler
-- deux fois le même fait (même appareil pour les mêmes comptes, même réseau dans une campagne...).
CREATE TABLE alertes_fraude (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL CHECK (code IN ('meme_appareil', 'meme_position', 'usage_nul', 'rapports_copies', 'meme_reseau', 'appareil_suspect')),
  cle TEXT NOT NULL UNIQUE,
  testeur_ids BIGINT[] NOT NULL CHECK (cardinality(testeur_ids) > 0),
  campagne_id BIGINT REFERENCES campagnes(id) ON DELETE CASCADE,
  detail TEXT NOT NULL,
  statut TEXT NOT NULL DEFAULT 'ouverte' CHECK (statut IN ('ouverte', 'confirmee', 'ecartee')),
  creee_le TIMESTAMPTZ NOT NULL,
  traitee_le TIMESTAMPTZ,
  traitee_par BIGINT REFERENCES utilisateurs(id),
  note TEXT CHECK (char_length(note) <= 500),
  CONSTRAINT traitement_complet CHECK ((statut = 'ouverte') = (traitee_le IS NULL))
);
CREATE INDEX alertes_fraude_statut ON alertes_fraude (statut, creee_le);
