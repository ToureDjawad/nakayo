-- Offres Standard et Pro (US-32), docs/api-offres.md.
-- Chaque app garde l'offre payée ; elle peut passer de Standard à Pro (montée en gamme),
-- en payant la différence. L'offre fixe la paie des testeurs et le choix des testeurs.
ALTER TABLE apps ADD COLUMN offre TEXT NOT NULL DEFAULT 'standard' CHECK (offre IN ('standard', 'pro', 'afrique'));

-- Nature d'un paiement : l'achat de l'offre, ou la montée en gamme d'une app déjà payée.
ALTER TABLE paiements ADD COLUMN nature TEXT NOT NULL DEFAULT 'offre' CHECK (nature IN ('offre', 'montee_en_gamme'));
ALTER TABLE paiements ADD CONSTRAINT paiements_offre_connue CHECK (offre IN ('standard', 'pro', 'afrique'));

-- Une app est payée une fois, et ne monte en gamme qu'une fois.
DROP INDEX paiements_un_reussi_par_app;
CREATE UNIQUE INDEX paiements_un_reussi_par_app ON paiements (app_id, nature) WHERE statut = 'reussi';
