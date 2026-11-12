# Schéma et contrat d'API · Sprint 2 (soumission d'app et paiement développeur)

Ce document complète [api-sprint1.md](api-sprint1.md). Les conventions communes (format JSON, authentification, format des erreurs) restent celles du §1 de ce document.

## 1. Apps des développeurs (US-11)

Un développeur dont le compte est validé soumet son app : nom, package, lien d'inscription au test fermé Google Play, description, instructions de test et fonctionnalités clés. L'app reste en `brouillon` tant que l'offre n'est pas payée (US-12) ; elle peut alors être modifiée ou supprimée. Après paiement, elle passe en `en_verification` et l'admin la vérifie avant le lancement (US-14).

Toutes les routes sont réservées au rôle `developpeur` (cookie du site) : `401` sans session, `403 interdit` pour un testeur ou un admin.

### 1.1 Objet `app`

```json
{
  "id": "7",
  "nom": "Marché Facile",
  "package": "bj.studioawa.marche",
  "lienTestFerme": "https://play.google.com/apps/testing/bj.studioawa.marche",
  "description": "Une app pour commander au marché de Dantokpa et se faire livrer.",
  "instructions": "Chaque jour, ouvrez l'app, cherchez un produit et ajoutez-le au panier.",
  "fonctionnalites": ["Recherche de produits", "Panier", "Suivi de livraison"],
  "connexionRequise": true,
  "identifiantsTest": "Compte : test@marche.bj\nMot de passe : marche2026",
  "comptePlay": "personnel_recent",
  "testObligatoire": true,
  "statut": "brouillon",
  "creeLe": "2026-11-12T09:00:00.000Z",
  "modifieLe": "2026-11-12T09:00:00.000Z"
}
```

- `comptePlay` : type du compte développeur Google Play.
  - `personnel_recent` : compte personnel créé après le 13/11/2023 ;
  - `personnel_ancien` : compte personnel plus ancien ;
  - `organisation` : compte d'organisation.
- `testObligatoire` : calculé, `true` seulement pour `personnel_recent`. Les autres comptes ne sont pas soumis à la règle des 12 testeurs pendant 14 jours ; le site les prévient sans bloquer la soumission.
- `identifiantsTest` : `null` quand `connexionRequise` vaut `false`. Ils seront montrés aux testeurs de la campagne.
- `statut` : `brouillon`, `en_verification`, `validee` ou `refusee`.

### 1.2 Limites des champs

| Champ | Règle |
|---|---|
| `nom` | 2 à 50 caractères, espaces multiples réduits |
| `package` | identifiant Android : au moins deux segments séparés par des points, chacun commence par une lettre puis lettres, chiffres ou `_` ; 150 caractères max ; unique sur Nakayo sans tenir compte de la casse (hors apps refusées) |
| `lienTestFerme` | `https://play.google.com/apps/testing/<package>`, 300 caractères max ; `https://` est ajouté s'il manque ; le package du lien doit être celui de l'app |
| `description`, `instructions` | 20 à 2000 caractères, retours à la ligne gardés |
| `fonctionnalites` | tableau de 3 à 10 textes distincts (sans tenir compte de la casse), de 3 à 120 caractères chacun ; les éléments vides sont ignorés |
| `connexionRequise` | booléen obligatoire |
| `identifiantsTest` | 5 à 500 caractères, obligatoire si `connexionRequise` vaut `true`, ignoré sinon |
| `comptePlay` | `personnel_recent`, `personnel_ancien` ou `organisation` |

Codes d'erreur par champ (`422`, `champs`) : `requis`, `trop_court`, `trop_long`, `format_invalide`, `valeur_inconnue`. En plus :
- `lienTestFerme` peut valoir `ne_correspond_pas` ;
- `fonctionnalites` peut valoir `trop_peu`, `trop_nombreuses`, `doublon`, `element_trop_court` ou `element_trop_long`.

### 1.3 Soumettre et lire

- `POST /api/apps` : corps = les champs du §1.2.
  - Répond `201 { "app": app }`, avec `statut = brouillon`.
  - `403 compte_non_valide` si le compte n'est pas encore validé par l'équipe.
  - `409 conflit` avec `champs.package = deja_utilise` si le package est déjà inscrit.
  - `429` au-delà de 10 apps soumises par heure pour un compte (une soumission refusée en `422` ne compte pas).
- `GET /api/apps` : `200 { "apps": [app] }`, de la plus récente à la plus ancienne. Lisible même par un compte en attente (liste vide).
- `GET /api/apps/:id` : `200 { "app": app }`. `404` si l'app n'existe pas ou appartient à un autre compte.

### 1.4 Modifier ou supprimer un brouillon

- `PUT /api/apps/:id` : même corps et mêmes erreurs que `POST`. Remplace tous les champs et met à jour `modifieLe`. Répond `200 { "app": app }`.
- `DELETE /api/apps/:id` : `204`.
- Les deux répondent `409 statut_incompatible` (avec `statut`) si l'app n'est plus en brouillon, et `404` si elle n'existe pas ou appartient à un autre compte.

### 1.5 Migration `008_apps.sql`

- Types `statut_app` (`brouillon`, `en_verification`, `validee`, `refusee`) et `compte_play`.
- Table `apps` : `developpeur_id`, `nom`, `package`, `lien_test_ferme`, `description`, `instructions`, `fonctionnalites` (`TEXT[]`), `connexion_requise`, `identifiants_test`, `compte_play`, `statut`, `cree_le`, `modifie_le`.
- Contrainte `identifiants_si_connexion` : des identifiants si et seulement si la connexion est requise.
- Index unique `apps_package_unique` sur `lower(package)` pour les apps non refusées ; index `apps_developpeur` et `apps_file_admin` (pour la file de vérification de l'US-14).

## 2. Récapitulatif des routes

| Méthode | Route | Rôle | Section |
|---|---|---|---|
| GET | `/api/apps` | développeur | §1.3 |
| POST | `/api/apps` | développeur validé | §1.3 |
| GET | `/api/apps/:id` | développeur | §1.3 |
| PUT | `/api/apps/:id` | développeur validé | §1.4 |
| DELETE | `/api/apps/:id` | développeur | §1.4 |
