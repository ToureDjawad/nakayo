-- Les testeurs choisissent seulement le français ou l'anglais (US-10, décision du 2026-11-12).
-- Les autres codes déjà enregistrés sont retirés, dans l'ordre d'origine ; un profil qui n'en
-- garde aucun repasse au français, la langue parlée partout au Bénin.
UPDATE profils_testeurs
   SET langues = COALESCE(
         NULLIF(ARRAY(SELECT l FROM unnest(langues) WITH ORDINALITY AS u(l, i) WHERE l IN ('fr', 'en') ORDER BY i), '{}'),
         ARRAY['fr'])
 WHERE cardinality(langues) > 0 AND NOT langues <@ ARRAY['fr', 'en'];
