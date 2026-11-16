-- Téléphones d'entrée de gamme (US-35, docs/api-offres.md §3) : mémoire vive totale annoncée
-- par l'app Android, en Mo. Absente pour les appareils vus avant cette version de l'app.
ALTER TABLE appareils ADD COLUMN ram_mo INTEGER CHECK (ram_mo BETWEEN 256 AND 65536);
