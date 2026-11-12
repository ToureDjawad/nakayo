# Schéma et contrat d'API · Sprint 4 (suivi, paiement des testeurs et lancement)

Suite de `docs/api-sprint3.md`. Mêmes conventions : JSON, identifiants en chaînes, dates ISO 8601 en UTC, jours « AAAA-MM-JJ » à l'heure du Bénin, erreurs `{ "erreur": { "code", "message", "champs"? } }`.

## 1. Avancement de la campagne (US-21)

### 1.1 `GET /api/apps/:id/campagne/avancement`

Réservé au développeur de l'app (cookie du site). `404` si l'app n'est pas à lui ou n'a pas de campagne.

```json
{ "avancement": {
  "campagneId": "4", "statut": "en_cours", "jour": 5, "joursExiges": 14,
  "finPrevueLe": "2026-11-28T09:00:00.000Z",
  "objectif": { "atteint": false, "testeursAtteints": 0, "dateEstimee": "2026-11-25" },
  "resume": { "testeursActifs": 13, "installes": 14, "tempsTotalSecondes": 9120, "rapports": 52, "noteMoyenne": 4.1, "bugs": 6 },
  "testeurs": [{ "numero": 1, "ville": "Cotonou", "modele": "Spark 20", "versionAndroid": "14",
                 "inscriptionConfirmee": true, "installationConfirmee": true, "joursValides": 4, "joursAcquis": false,
                 "dernierRapport": "2026-11-16", "actif": true }],
  "parJour": [{ "jour": "2026-11-12", "numero": 1, "tempsSecondes": 1800, "testeursAvecUsage": 12, "rapports": 11, "testeursValides": 10 }],
  "couverture": [{ "fonctionnalite": "Panier", "testeurs": 12, "rapports": 40, "part": 0.86 }],
  "appareils": [{ "modele": "Spark 20", "versionAndroid": "14", "testeurs": 3 }],
  "rapports": [{ "id": "88", "jour": "2026-11-16", "jourCampagne": 5, "testeur": 1, "ville": "Cotonou",
                 "actions": "…", "note": 4, "bug": true, "commentaireBug": "…", "fonctionnalites": ["Panier"],
                 "versionApp": "1.0.3", "retourDetaille": null, "recuLe": "2026-11-16T18:40:00.000Z" }]
} }
```

- **Testeurs** : les actifs (les remplacés n'apparaissent pas), numérotés comme dans l'objet `campagne`. Ni nom, ni téléphone, ni Gmail. `actif` : app installée, avec un rapport ou du temps d'utilisation aujourd'hui ou hier.
- **`parJour`** : du premier jour à aujourd'hui (ou à la clôture). `testeursValides` vaut `null` tant que la vérification de la nuit n'est pas passée sur ce jour.
- **`couverture`** : pour chaque fonctionnalité déclarée par le développeur, le nombre de testeurs qui l'ont cochée au moins une fois, divisé par le nombre de testeurs ayant installé l'app (`part`, de 0 à 1).
- **`appareils`** : modèles et versions d'Android des testeurs actifs, du plus courant au plus rare.
- **`rapports`** : du plus récent au plus ancien, 300 au plus. `testeur` vaut `null` si ce testeur a été remplacé. La position n'est jamais renvoyée.
- **`objectif`** : Google demande 12 testeurs pendant 14 jours continus. `dateEstimee` est le jour où le 12e testeur le plus avancé atteindra 14 jours s'il ne manque aucun jour (le jour en cours compris). Elle vaut `null` si l'objectif est atteint, si moins de 12 testeurs ont installé l'app, ou si la campagne n'est plus en cours.
