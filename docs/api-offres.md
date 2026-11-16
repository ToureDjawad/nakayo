# Offres par app · Standard, Pro et Plus (US-32, US-37)

Suite de `docs/api-sprint2.md` §2 (paiement de l'offre) et de `docs/fedapay.md`. Mêmes conventions : JSON, identifiants en chaînes, montants dans la plus petite unité (centimes pour `USD`, francs pour `XOF`), erreurs `{ "erreur": { "code", "message", "champs"? } }`.

Chaque app a une offre (`apps.offre` : `standard`, `pro` ou `afrique`). Le développeur la choisit au paiement. Il peut aussi passer de Standard à Pro plus tard, en payant la différence. L’Offre Plus se paie au prix d'un devis (§4). Les prix suivent le modèle économique (1 $ = 600 FCFA).

| Offre | Carte | Mobile Money | Paie d'un testeur | Choix des testeurs |
| --- | --- | --- | --- | --- |
| Standard | 29 $ | 17 400 FCFA | 500 FCFA | tous les testeurs valides |
| Pro | 59 $ | 35 400 FCFA | 800 FCFA | testeurs confirmés d'abord |
| Offre Plus | dès 99 $, sur devis | dès 59 400 FCFA | 1 500 FCFA | 20 testeurs, confirmés d'abord |

## 1. Offres et paiement

### 1.1 `GET /api/offres`

Public. Renvoie les offres ouvertes, sans les règles internes (paie et choix des testeurs).

```json
{ "offres": [
  { "code": "standard", "nom": "Offre Standard", "description": "…", "garantie": "…",
    "prix": { "carte": { "montant": 2900, "devise": "USD" }, "mobile_money": { "montant": 17400, "devise": "XOF" } } },
  { "code": "pro", "nom": "Offre Pro", "description": "…", "garantie": "…",
    "prix": { "carte": { "montant": 5900, "devise": "USD" }, "mobile_money": { "montant": 35400, "devise": "XOF" } },
    "monteeEnGamme": { "prix": { "carte": { "montant": 3000, "devise": "USD" }, "mobile_money": { "montant": 18000, "devise": "XOF" } } } },
  { "code": "afrique", "nom": "Offre Plus", "description": "…", "garantie": "…", "surDevis": true, "testeurs": 20,
    "prix": { "carte": { "montant": 9900, "devise": "USD" }, "mobile_money": { "montant": 59400, "devise": "XOF" } } }
] }
```

Chaque offre porte `testeurs` (15 ou 20). `surDevis: true` : le prix affiché est un prix de départ, le vrai prix vient du devis (§4).

En mode `fedapay`, chaque prix porte aussi `debitCarte` (la carte est débitée en FCFA, `docs/fedapay.md` §1), de même que `monteeEnGamme`.

### 1.2 `POST /api/apps/:id/paiements`

Comme `docs/api-sprint2.md` §2.2, avec un champ en plus :

```json
{ "offre": "pro", "moyen": "carte" }
```

- `offre` : `standard` (par défaut), `pro` ou `afrique`. Un code inconnu donne `422` avec `champs.offre = "valeur_inconnue"`.
- `afrique` : le montant est celui du devis proposé (§4.3). Sans devis proposé : `409 devis_requis`.
- Le paiement renvoyé porte `offre` et `nature: "offre"`. Une fois confirmé, l'app passe en vérification avec cette offre.

## 2. Montée en gamme

### 2.1 `POST /api/apps/:id/montee-en-gamme`

Développeur au compte validé, propriétaire de l'app. Même corps et même réponse que §1.2 ; `offre` vaut `pro` par défaut.

- Montant : la différence entre les deux offres, dans le moyen choisi (30 $ ou 18 000 FCFA).
- Le paiement porte `nature: "montee_en_gamme"`. Sa facture indique « Passage à l'Offre Pro pour « app » (différence de prix) ».
- Une fois confirmé, `apps.offre` passe à `pro` : la paie et les remplacements suivent tout de suite, même en cours de campagne. Le statut de l'app ne change pas.
- Un second paiement confirmé alors que l'app est déjà en Pro devient `doublon` (remboursé).

Erreurs `409` :

| Code | Cas |
| --- | --- |
| `statut_incompatible` | app en brouillon (choisir Pro au paiement) ou refusée |
| `deja_dans_cette_offre` | app déjà en Pro ou en Offre Plus |
| `campagne_terminee` | la campagne est terminée : plus rien à améliorer |

`422` : `offre` vaut autre chose que `pro` (on ne monte pas vers l’Offre Plus : elle se choisit au paiement, sur devis).

### 2.2 Base de données (migration 018)

- `apps.offre` (défaut `standard`).
- `paiements.nature` : `offre` ou `montee_en_gamme`. L'index unique « un paiement réussi par app » devient « un par app et par nature ».

## 3. Campagne Pro

- **Testeurs confirmés d'abord.** Au démarrage comme pour un remplacement, les testeurs qui ont déjà mené une campagne au bout passent en tête. C'est l'approximation retenue pour « les mieux notés » tant qu'il n'y a pas de note des testeurs. Le reste du tri ne change pas : assiduité, puis répartition des villes, des opérateurs et des modèles.
- **Paie.** Chaque testeur qui a ses 14 jours reçoit la paie de l'offre de l'app au moment de la clôture : 800 FCFA en Pro. Le portefeuille et le tableau de bord admin l'estiment de la même façon.
- **Rapports de bugs avec captures** (US-33, US-34) : voir `docs/api-bugs.md`.
- **Téléphones d'entrée de gamme (US-35).**
  - Une campagne Pro réserve d'abord 5 places aux testeurs dont le téléphone a 3 Go de mémoire vive ou moins (3 072 Mo, la valeur annoncée par Android). C'est vrai au démarrage comme aux remplacements, tant que la campagne en compte moins de 5.
  - S'il n'y en a pas assez parmi les testeurs disponibles, la campagne démarre quand même avec ceux qui existent.
  - L'app Android envoie `ramMo` (entier, 256 à 65 536) dans l'objet `appareil` (contrat §4.2). Le champ est facultatif pour les anciennes versions de l'app ; il est gardé dans `appareils.ram_mo` (migration 020).
  - L'avancement (`docs/api-sprint4.md` §1) donne `resume.appareilsEntreeDeGamme` et `entreeDeGamme` sur chaque ligne de `appareils`.
  - Le rapport de fin (web, PDF et brouillon du formulaire Google) indique les modèles utilisés et le nombre de téléphones d'entrée de gamme.

## 4. Offre Plus sur devis (US-37)

### 4.1 Besoin du développeur

`GET /api/apps/:id/devis` : `{ "devis": null }` ou l'objet devis ci-dessous.

`PUT /api/apps/:id/devis` (compte validé, app en brouillon) : crée ou remplace le besoin. Toute modification remet le devis à l'étude (`statut: "demande"`, prix effacé).

```json
{ "pays": ["BJ", "TG"], "langues": ["fr", "fon"], "profils": "Commerçantes de marché…", "scenarios": "Créer un compte, payer par Mobile Money…" }
```

| Champ | Règle |
| --- | --- |
| `pays` | 1 à 6 codes parmi `BJ`, `TG`, `CI`, `SN`, `BF`, `NG`, `NE`, `ML`, `GH` |
| `langues` | 1 à 4 codes parmi `fr`, `en`, `fon`, `yo` |
| `profils` | 10 à 1 000 caractères |
| `scenarios` | 10 à 2 000 caractères |

Erreurs : `422` (`requis`, `trop_nombreux`, `valeur_inconnue`, `trop_court`, `trop_long`) ; `409 statut_incompatible` si l'app est déjà payée.

Objet devis : `id`, `appId`, `pays`, `langues`, `profils`, `scenarios`, `statut` (`demande`, `propose`, `refuse`), `prix` (`null`, ou `{ carte, mobile_money }` avec `montant`, `devise`, `montantLisible`), `message`, `demandeLe`, `reponduLe`. L'app porte aussi `devis: { statut }` ou `null`.

### 4.2 Réponse de l'équipe (admin)

- `GET /api/admin/devis?statut=demande|propose|refuse` (par défaut `demande`, les plus anciennes d'abord) : l'objet devis avec `app` et `developpeur`.
- `GET /api/admin/devis/:id`.
- `POST /api/admin/devis/:id/proposition` : `{ "prixCarte": 14900, "prixMobileMoney": 89400, "message": "…" }`. Prix entiers dans la plus petite unité, au moins 9 900 (99 $) et 59 400 FCFA ; `message` facultatif (1 000 caractères au plus).
- `POST /api/admin/devis/:id/refus` : `{ "message": "…" }` (obligatoire).

Le développeur reçoit un email dans les deux cas, avec le lien vers `/mon-compte/apps/:id/devis`. `409 deja_repondu` si le devis a déjà une réponse ; `409 statut_incompatible` si l'app a été payée entre-temps.

### 4.3 Paiement

`POST /api/apps/:id/paiements` avec `{ "offre": "afrique", "moyen": … }`. Le montant est le prix proposé dans le moyen choisi (en mode `fedapay`, la carte est débitée du prix Mobile Money). Le reste suit §1.2 : facture, vérification par l'équipe, puis campagne.

### 4.4 Campagne

- 20 testeurs au démarrage (`campagnes.testeurs_vises = 20`), confirmés d'abord, avec au moins 5 téléphones d'entrée de gamme comme en Pro (§3). La répartition des villes et des opérateurs suit les règles de l'affectation.
- Paie : 1 500 FCFA par testeur qui a ses 14 jours, plus le bonus des bugs acceptés (`docs/api-bugs.md`).
- Rapports de bugs avec captures, comme en Pro.

### 4.5 Questionnaire terrain

Chaque testeur d'une app en Offre Plus répond une fois, à partir du 7e jour, pendant la campagne.

- L'app à tester (`docs/api-sprint3.md` §2.1) porte `questionnaireTerrain` : `null` hors Offre Plus, sinon `{ "envoye": false, "ouvert": true, "ouvertLe": 7 }`.
- `POST /api/testeurs/moi/apps/:id/terrain` :

```json
{ "connexion": "3g", "reseau": "lent", "telephone": "fluide", "langue": "fr", "comprehension": 4, "commentaire": "Les images chargent lentement." }
```

| Champ | Valeurs |
| --- | --- |
| `connexion` | `wifi`, `4g`, `3g`, `2g` |
| `reseau`, `telephone` | `fluide`, `lent`, `inutilisable` |
| `langue` | `fr`, `en` |
| `comprehension` | entier de 1 à 5 |
| `commentaire` | facultatif, 10 à 1 000 caractères |

Réponse `201` : l'app à tester à jour. Erreurs : `403 offre_sans_questionnaire_terrain`, `409 trop_tot` (avant le 7e jour, avec `ouvertLe`), `409 deja_envoye`, `409 campagne_terminee`, `422`.

Base de données : migrations 021 (`devis`) et 022 (`retours_terrain`).

### 4.6 Rapport de fin

Pour l’Offre Plus, `bilan.terrain` (sinon `null`) résume les réponses, sans nommer les testeurs :

```json
{ "reponses": 3, "reseau": { "fluide": 1, "lent": 1, "inutilisable": 1 },
  "parConnexion": [{ "connexion": "3g", "reponses": 1, "fluide": 0, "lent": 1, "inutilisable": 0 }],
  "telephone": { "fluide": 2, "lent": 1, "inutilisable": 0 },
  "petitsTelephones": { "reponses": 2, "fluide": 1, "lent": 1, "inutilisable": 0 },
  "langues": [{ "langue": "fr", "reponses": 2, "comprehensionMoyenne": 3.5 }],
  "comprehensionMoyenne": 4, "commentaires": ["…"] }
```

`petitsTelephones` : les testeurs sur un téléphone de 3 Go de RAM ou moins (§3). Le PDF ajoute une section « Test terrain » avec les mêmes chiffres et les 5 premiers commentaires.

## 5. Web

- `/mon-compte/apps/:id/paiement` : choix de l'offre, puis du moyen de paiement ; `?offre=pro` présélectionne Pro, `?offre=afrique` le devis proposé. Sans devis proposé, l’Offre Plus n'est pas proposée : un lien mène à la demande de devis.
- `/mon-compte/apps/:id/devis` : besoin du développeur et réponse de l'équipe, avec le lien de paiement.
- `/admin/devis` : file des devis, proposition d'un prix ou refus.
- `/mon-compte/apps/:id/montee-en-gamme` : paiement de la différence ; le lien apparaît sur la carte de l'app tant qu'elle est en Standard et que sa campagne n'est pas terminée.
- L'historique des paiements distingue l'offre payée et le passage à Pro.
