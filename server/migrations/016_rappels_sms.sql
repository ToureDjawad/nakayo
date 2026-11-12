-- SMS de secours à 22 h quand un rapport du jour manque (US-25, docs/api-sprint4.md §4).
-- Une ligne par testeur et par jour : jamais deux SMS de rappel le même soir.
CREATE TABLE rappels_sms (
  testeur_id BIGINT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  jour DATE NOT NULL,
  apps TEXT[] NOT NULL,
  envoye_le TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (testeur_id, jour)
);
