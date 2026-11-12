-- Préparation du lancement (US-42 et US-13) : le développeur coche chaque point de la liste
-- de vérification ; la campagne (Sprint 3) ne démarre que lorsque tout est coché.
ALTER TABLE apps
  ADD COLUMN preparation TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN preparation_complete_le TIMESTAMPTZ;
