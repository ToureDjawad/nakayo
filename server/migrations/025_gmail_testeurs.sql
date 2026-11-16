-- US-07 : Google repère les comptes testeurs neufs ou peu utilisés.
-- Ancienneté du Gmail déclarée à l'inscription (null pour les comptes créés avant), et date à
-- laquelle le testeur confirme, à sa première campagne, que ce Gmail est le compte principal du
-- Play Store de son téléphone.
ALTER TABLE profils_testeurs
  ADD COLUMN anciennete_gmail TEXT CHECK (anciennete_gmail IN ('moins_1_mois', '1_6_mois', 'plus_6_mois')),
  ADD COLUMN gmail_principal_confirme_le TIMESTAMPTZ;
