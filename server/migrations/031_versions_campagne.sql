-- US-44 : versions de l'app annoncées par le développeur pendant le test.
CREATE TABLE versions_campagne (
  id BIGSERIAL PRIMARY KEY,
  campagne_id BIGINT NOT NULL REFERENCES campagnes(id) ON DELETE CASCADE,
  numero TEXT NOT NULL CHECK (char_length(numero) BETWEEN 1 AND 50),
  changements TEXT NOT NULL CHECK (char_length(changements) BETWEEN 10 AND 1000),
  annoncee_le TIMESTAMPTZ NOT NULL,
  UNIQUE (campagne_id, numero)
);
