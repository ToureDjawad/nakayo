-- US-43 : un Groupe Google par app, créé et rempli automatiquement (Google Workspace, API Admin SDK).
-- Le groupe est créé dès la préparation du lancement, pour que le développeur l'ajoute à son test
-- fermé avant le démarrage ; les testeurs y sont ajoutés au démarrage, retirés s'ils sont remplacés.
ALTER TABLE apps
  ADD COLUMN groupe_google TEXT UNIQUE,
  ADD COLUMN groupe_google_cree_le TIMESTAMPTZ;
ALTER TABLE affectations
  ADD COLUMN groupe_ajoute_le TIMESTAMPTZ,
  ADD COLUMN groupe_retire_le TIMESTAMPTZ;
CREATE INDEX affectations_groupe_a_synchroniser ON affectations (id)
  WHERE groupe_ajoute_le IS NULL OR (groupe_retire_le IS NULL AND statut <> 'active');
