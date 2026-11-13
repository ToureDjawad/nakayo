-- Questionnaire terrain de l'offre Lancement Afrique (US-37), docs/api-offres.md §4.5.
-- Une réponse par testeur et par app, à partir du 7e jour : connexion utilisée, tenue de l'app
-- sur le réseau et sur le téléphone, langue utilisée et compréhension.
CREATE TABLE retours_terrain (
  affectation_id BIGINT PRIMARY KEY REFERENCES affectations(id) ON DELETE CASCADE,
  campagne_id BIGINT NOT NULL REFERENCES campagnes(id) ON DELETE CASCADE,
  testeur_id BIGINT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  connexion TEXT NOT NULL CHECK (connexion IN ('wifi', '4g', '3g', '2g')),
  reseau TEXT NOT NULL CHECK (reseau IN ('fluide', 'lent', 'inutilisable')),
  telephone TEXT NOT NULL CHECK (telephone IN ('fluide', 'lent', 'inutilisable')),
  langue TEXT NOT NULL CHECK (langue IN ('fr', 'en')),
  comprehension SMALLINT NOT NULL CHECK (comprehension BETWEEN 1 AND 5),
  commentaire TEXT CHECK (char_length(commentaire) BETWEEN 10 AND 1000),
  envoye_le TIMESTAMPTZ NOT NULL
);
CREATE INDEX retours_terrain_campagne ON retours_terrain (campagne_id);
