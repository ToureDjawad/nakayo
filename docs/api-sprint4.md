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

## 2. Versements aux testeurs (US-22)

À la clôture d'une campagne (J16, pendant la vérification de la nuit), chaque testeur reçoit **500 FCFA** sur son compte MTN MoMo ou Moov Money s'il remplit trois conditions :

- il a ses 14 jours validés ;
- il est toujours affecté (pas remplacé) ;
- il a confirmé son inscription au test.

Google demande que les testeurs restent inscrits jusqu'à la demande d'accès, d'où le paiement à la clôture et non à J14.

### 2.1 Table `versements`

| Champ | Contenu |
|---|---|
| `reference` | Référence `VER-<16 caractères>`, envoyée à l'agrégateur. Elle évite de payer deux fois. |
| `affectation_id` | Unique : un seul versement par testeur et par app. |
| `montant`, `devise` | 500 XOF. |
| `numero_momo`, `operateur_momo` | Copiés du profil à la création. |
| `statut` | `a_verser` (en attente d'une tentative), `en_cours` (envoyé, confirmation attendue), `verse` ou `echoue` (abandonné, admin alerté). |
| `tentatives`, `prochaine_tentative_le`, `dernier_motif`, `reference_fournisseur`, `verse_le`, `alerte_le` | Suivi des tentatives. |

### 2.2 Traitement

- Un passage a lieu toutes les 15 minutes et au démarrage. Il verse ce qui est dû par l'agrégateur : le fournisseur `momo` est injectable, en simulation hors production et absent en production tant que l'agrégateur n'est pas branché.
- La tentative est comptée avant l'appel au fournisseur, et les lignes sont prises avec `FOR UPDATE SKIP LOCKED` : deux passages ne paient jamais deux fois.
- En cas d'échec, ou si le fournisseur est injoignable, 3 nouvelles tentatives sont faites, après 1 h, 4 h puis 24 h. Après la 4e, le statut passe à `echoue` et chaque admin reçoit un email.
- En cas de réussite, le testeur reçoit un SMS : « Nakayo : 500 FCFA vous ont été versés sur votre compte MTN MoMo (•••• 12) pour votre test de « Marché Facile ». Merci pour vos 14 jours de test ! »

### 2.3 `POST /api/versements/webhook/:fournisseur`

Il confirme un versement resté `en_cours`. Le corps est signé comme pour les paiements (`X-Nakayo-Signature: sha256=<HMAC du corps brut>`) : `{ "reference": "VER-…", "statut": "verse" | "echoue", "referenceFournisseur"?, "motif"? }`.

- Réponse : `{ "recu": true, "statut": "verse" }`.
- Erreurs : `401` (signature invalide), `400` (corps invalide), `404` (référence inconnue).
- Un versement déjà réglé n'est plus modifié, et le SMS n'est envoyé qu'une fois.

### 2.4 Administration

- `GET /api/admin/versements?statut=echoue|a_verser|en_cours|verse|tous` (par défaut `echoue`) renvoie `{ versements: [versement] }`, 200 au plus. Chaque versement contient : `reference`, `campagneId`, `appNom`, `montant`, `devise`, `montantLisible`, `operateur`, `numeroMasque`, `statut`, `tentatives`, `prochaineTentativeLe`, `dernierMotif`, `creeLe`, `verseLe`, `testeur { id, nom, telephone, numeroMomo }`, `referenceFournisseur`, `alerteLe`.
- `POST /api/admin/versements/:reference/relance` remet les tentatives à zéro avec le numéro MoMo **actuel** du testeur et tente tout de suite. Il renvoie `{ versement }`. `409` si le versement n'est pas en échec.
