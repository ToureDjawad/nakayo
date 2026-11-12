-- Rapport de fin et décision de Google (US-36, docs/api-sprint4.md §6).
CREATE TYPE decision_google AS ENUM ('acceptee', 'refusee');

ALTER TABLE campagnes
  -- Rapport prêt (J14) et développeur prévenu par email.
  ADD COLUMN rapport_pret_le TIMESTAMPTZ,
  -- Réponse de Google à la demande d'accès à la production, indiquée par le développeur.
  ADD COLUMN decision_google decision_google,
  ADD COLUMN decision_google_le DATE,
  ADD COLUMN decision_saisie_le TIMESTAMPTZ;
