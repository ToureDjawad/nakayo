-- Contact du support (US-40) : un admin enregistre le numéro WhatsApp, puis le publie.
-- Une seule ligne (id = TRUE). Tant qu'elle n'existe pas, aucun contact n'est publié.
CREATE TABLE contact_support (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  whatsapp TEXT,                 -- numéro enregistré par l'admin, format international (+229...)
  whatsapp_publie TEXT,          -- numéro visible dans l'app et sur le site, ou NULL
  modifie_par BIGINT REFERENCES utilisateurs(id) ON DELETE SET NULL,
  modifie_le TIMESTAMPTZ,
  publie_par BIGINT REFERENCES utilisateurs(id) ON DELETE SET NULL,
  publie_le TIMESTAMPTZ
);
