# Annoncer une nouvelle version pendant le test (US-44)

Google attend des corrections faites à partir des retours des testeurs. Un test sans aucune mise à jour est souvent refusé. Le développeur annonce donc chaque version publiée dans son test fermé.

## API développeur

`GET /api/apps/:id/campagne/versions` répond `{ versions }`. Chaque version :
- `numero` ;
- `changements` ;
- `annonceeLe` ;
- `jourCampagne` ;
- `testeursSurVersion` : testeurs ayant envoyé un rapport sur cette version.

`POST /api/apps/:id/campagne/versions` avec `{ numero, changements }` répond `201 { versions }`.
- `numero` : 1 à 50 caractères.
- `changements` : 10 à 1 000 caractères.
- Erreurs : `409 conflit` (`champs.numero = deja_utilise`), ou `409 statut_incompatible` hors du test.
- Les testeurs actifs et inscrits reçoivent un SMS.

## App Android

L'objet « app à tester » porte `nouvelleVersion: { numero, changements, annonceeLe } | null`. C'est la dernière version annoncée, tant que le testeur n'a pas envoyé de rapport sur cette version.

L'écran de l'app affiche « Nouvelle version x », avec ce qui a changé et un bouton vers le Play Store.

## Rapport de fin (US-36)

- `bilan.versionsAnnoncees` reprend la liste des versions.
- La réponse « Quelles modifications avez-vous apportées… » du brouillon commence par chaque version, son jour, ses changements et le nombre de testeurs qui l'ont vérifiée.
- Le PDF ajoute une section « Versions publiées pendant le test ».
