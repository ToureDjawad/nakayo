# Comportements suspects (US-28)

Le but est d'éviter qu'un testeur triche (faux rapports, plusieurs comptes) et que Google voie une « ferme de testeurs ». Les règles créent des **alertes** que l'admin confirme ou écarte. Rien n'est sanctionné automatiquement : la suspension se fait depuis la fiche du compte.

## Règles

Elles tournent chaque nuit, après la vérification du jour (`services/fraude.js`). Une alerte n'est jamais créée deux fois pour le même fait (colonne `cle`, migration 028).

| Code | Alerte |
| --- | --- |
| `meme_appareil` | Le même identifiant d'app (téléphone) est utilisé par plusieurs comptes testeurs non refusés. |
| `meme_position` | Deux testeurs d'une campagne en cours envoient leurs rapports du même endroit, à 1 km près, au moins 3 jours. |
| `usage_nul` | Un rapport du jour a été envoyé alors que l'app n'a pas été utilisée ce jour-là. |
| `rapports_copies` | Un testeur envoie le même rapport pour deux apps différentes. Le texte est comparé sans accents, ponctuation ni casse. |
| `meme_reseau` | Plusieurs testeurs actifs d'une campagne en cours sont vus sur le même Wi-Fi depuis son démarrage (empreinte d'US-16). |
| `appareil_suspect` | L'app tourne sur un émulateur ou un téléphone rooté (voir ci-dessous). |

## App Android

À chaque ouverture, le signal `POST /api/testeurs/moi/signal` peut porter `{ "integrite": { "emulateur": true, "root": false } }`. Ce champ n'est envoyé que si l'appareil est suspect. Une autre forme répond `422` avec `champs.integrite = "format_invalide"`.

- **Émulateur** : empreinte, modèle, matériel ou produit typiques (`sdk_gphone`, `generic`, `goldfish`, `ranchu`, Genymotion…).
- **Root** : clés `test-keys`, ou binaire `su` ou Magisk présent.

Ce ne sont que des indices : l'admin juge.

## API admin

- `GET /api/admin/alertes?statut=ouverte|confirmee|ecartee&page=1` répond `{ alertes, total, page, parPage }`.
  - Chaque alerte : `{ id, code, libelle, detail, statut, creeLe, testeurs: [{ id, nom, telephone, statut }], campagne: { id, appNom } | null, traiteeLe, note }`.
  - Les alertes ouvertes sont triées de la plus ancienne à la plus récente.
- `POST /api/admin/alertes/:id/decision` avec `{ decision: "confirmee" | "ecartee", note? }` (500 caractères au plus) répond `{ alerte }`.
  - Erreurs : `409 statut_incompatible` si l'alerte est déjà traitée, `404` si elle n'existe pas.
- Site : page « Alertes de fraude » du back-office (`/admin/alertes`).
