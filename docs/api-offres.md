# Offres par app · Standard et Pro (US-32)

Suite de `docs/api-sprint2.md` §2 (paiement de l'offre) et de `docs/fedapay.md`. Mêmes conventions : JSON, identifiants en chaînes, montants dans la plus petite unité (centimes pour `USD`, francs pour `XOF`), erreurs `{ "erreur": { "code", "message", "champs"? } }`.

Chaque app a une offre (`apps.offre` : `standard`, `pro`, et plus tard `afrique`). Le développeur la choisit au paiement. Il peut aussi passer de Standard à Pro plus tard, en payant la différence. Les prix suivent le modèle économique (1 $ = 600 FCFA).

| Offre | Carte | Mobile Money | Paie d'un testeur | Choix des testeurs |
| --- | --- | --- | --- | --- |
| Standard | 29 $ | 17 400 FCFA | 500 FCFA | tous les testeurs valides |
| Pro | 59 $ | 35 400 FCFA | 800 FCFA | testeurs confirmés d'abord |

## 1. Offres et paiement

### 1.1 `GET /api/offres`

Public. Renvoie les offres ouvertes, sans les règles internes (paie et choix des testeurs).

```json
{ "offres": [
  { "code": "standard", "nom": "Offre Standard", "description": "…", "garantie": "…",
    "prix": { "carte": { "montant": 2900, "devise": "USD" }, "mobile_money": { "montant": 17400, "devise": "XOF" } } },
  { "code": "pro", "nom": "Offre Pro", "description": "…", "garantie": "…",
    "prix": { "carte": { "montant": 5900, "devise": "USD" }, "mobile_money": { "montant": 35400, "devise": "XOF" } },
    "monteeEnGamme": { "prix": { "carte": { "montant": 3000, "devise": "USD" }, "mobile_money": { "montant": 18000, "devise": "XOF" } } } }
] }
```

En mode `fedapay`, chaque prix porte aussi `debitCarte` (la carte est débitée en FCFA, `docs/fedapay.md` §1), de même que `monteeEnGamme`.

### 1.2 `POST /api/apps/:id/paiements`

Comme `docs/api-sprint2.md` §2.2, avec un champ en plus :

```json
{ "offre": "pro", "moyen": "carte" }
```

- `offre` : `standard` (par défaut) ou `pro`. Un code inconnu donne `422` avec `champs.offre = "valeur_inconnue"`.
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
| `deja_dans_cette_offre` | app déjà en Pro |
| `campagne_terminee` | la campagne est terminée : plus rien à améliorer |

`422` : `offre` vaut `standard` ou un code inconnu.

### 2.2 Base de données (migration 018)

- `apps.offre` (défaut `standard`).
- `paiements.nature` : `offre` ou `montee_en_gamme`. L'index unique « un paiement réussi par app » devient « un par app et par nature ».

## 3. Campagne Pro

- **Testeurs confirmés d'abord.** Au démarrage comme pour un remplacement, les testeurs qui ont déjà mené une campagne au bout passent en tête. C'est l'approximation retenue pour « les mieux notés » tant qu'il n'y a pas de note des testeurs. Le reste du tri ne change pas : assiduité, puis répartition des villes, des opérateurs et des modèles.
- **Paie.** Chaque testeur qui a ses 14 jours reçoit la paie de l'offre de l'app au moment de la clôture : 800 FCFA en Pro. Le portefeuille et le tableau de bord admin l'estiment de la même façon.
- Les rapports de bugs avec captures (US-33, US-34) et les téléphones d'entrée de gamme (US-35) complètent l'offre Pro dans les US suivantes.

## 4. Web

- `/mon-compte/apps/:id/paiement` : choix de l'offre, puis du moyen de paiement ; `?offre=pro` présélectionne Pro.
- `/mon-compte/apps/:id/montee-en-gamme` : paiement de la différence ; le lien apparaît sur la carte de l'app tant qu'elle est en Standard et que sa campagne n'est pas terminée.
- L'historique des paiements distingue l'offre payée et le passage à Pro.
