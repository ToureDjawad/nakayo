# Parrainage entre testeurs (US-39)

Chaque testeur a un code de parrainage personnel. Une personne qui s'inscrit avec ce code devient son filleul. Quand le filleul mène sa **première** campagne au bout (versement de clôture créé, 14 jours validés), le parrain reçoit une prime de **500 FCFA** sur son Mobile Money.

## 1. Code et inscription

- Code : 6 caractères parmi `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (sans 0, O, 1, I ni L), créé par la base pour chaque testeur (migration 023).
- `GET /api/testeurs/moi` (contrat §4.4) : `utilisateur.codeParrainage`.
- `POST /api/testeurs/inscription` (§4.3) : champ facultatif `codeParrainage`. Majuscules, espaces et tirets sont tolérés.

| Erreur `422` sur `codeParrainage` | Cas |
|---|---|
| `format_invalide` | pas 6 caractères autorisés |
| `inconnu` | aucun testeur n'a ce code |

## 2. `GET /api/testeurs/moi/parrainage`

```json
{
  "parrainage": {
    "code": "K7Q2MP",
    "prime": { "montant": 500, "devise": "XOF", "montantLisible": "500 FCFA" },
    "totalVerse": 500,
    "totalVerseLisible": "500 FCFA",
    "filleuls": [
      { "nom": "Afi D.", "inscritLe": "2026-11-12T09:00:00.000Z", "etat": "prime_versee" }
    ]
  }
}
```

- `nom` : prénom et initiale du nom seulement.
- `etat` : `compte_en_validation`, `en_attente_de_campagne`, `prime_en_paiement`, `prime_versee` ou `inactif` (compte refusé ou suspendu).

## 3. Prime

- Créée à la clôture de la campagne, dans la même transaction que les versements des testeurs. Une seule prime par filleul (`versements.filleul_id` unique).
- Versement de nature `parrainage` : sans affectation, payé au numéro Mobile Money du parrain, avec les mêmes tentatives et alertes que les autres versements (docs/api-sprint4.md §2).
- Pas de prime si le parrain n'est plus validé (suspendu ou refusé) au moment de la clôture.
- Un testeur ne peut pas être son propre parrain.

## 4. Versements et portefeuille

- Les versements et les lignes du portefeuille portent `nature` : `campagne` ou `parrainage`.
- Une prime s'affiche avec `appNom` « Prime de parrainage » ; dans `enAttente`, son `affectationId` vaut `parrainage-<id du filleul>`.
- SMS au parrain : « … votre filleul a mené sa première campagne au bout. Merci de faire connaître Nakayo ! »

## 5. Android

- Inscription : champ « Code de parrainage (si on vous a invité) », facultatif.
- « Mon profil » : carte « Parrainer un ami » avec le code, le bouton « Partager mon code » (partage Android), la prime et la liste des filleuls.
