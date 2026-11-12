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
  "motifRefus": null,
  "preparation": { "elements": [], "complete": false, "completeLe": null },
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
- `motifRefus` : motif donné par l'équipe quand l'app est refusée (§4), sinon `null`.

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

## 2. Paiement de l'offre Standard (US-12)

Le développeur paie l'offre Standard pour une app en brouillon :
- **par carte** : 29 $ US (2900 centimes) ;
- **par Mobile Money** : 17 400 FCFA (taux du modèle économique : 1 $ = 600 FCFA).

Le paiement passe par un fournisseur, qui confirme par webhook. Après confirmation :
- l'app passe en `en_verification` ;
- une facture est émise ;
- le reçu part par email.

Les comptes marchands ne sont pas encore ouverts (US-03). En développement et en test, un fournisseur « simulation » remplace la carte et l'agrégateur : le développeur choisit l'issue du paiement sur une page du site. En production, le paiement reste fermé (`503 paiement_indisponible`) tant que les fournisseurs ne sont pas branchés.

Configuration :
- `PAIEMENT_MODE` : `simulation` par défaut hors production, `aucun` par défaut en production ;
- `PAIEMENT_WEBHOOK_SECRET` : secret partagé avec les fournisseurs pour signer leurs webhooks.

### 2.1 Offre et objet `paiement`

- `GET /api/offres` (public, mis en cache 5 min) : `200 { "offres": [{ "code": "standard", "nom", "description", "prix": { "carte": { "montant": 2900, "devise": "USD" }, "mobile_money": { "montant": 17400, "devise": "XOF" } }, "garantie": "..." }] }`. La garantie est affichée avant le paiement.

```json
{
  "reference": "PAY-0123456789ABCDEF",
  "appId": "7",
  "appNom": "Marché Facile",
  "offre": "standard",
  "moyen": "carte",
  "montant": 2900,
  "devise": "USD",
  "montantLisible": "29,00 $ US",
  "statut": "reussi",
  "facture": "NKY-2026-00001",
  "creeLe": "2026-11-12T09:00:00.000Z",
  "confirmeLe": "2026-11-12T09:01:00.000Z",
  "rembourseLe": null
}
```

- `montant` est en plus petite unité : centimes pour `USD`, francs pour `XOF`.
- `statut` vaut :
  - `en_attente` : en cours chez le fournisseur ;
  - `reussi` ;
  - `echoue` ;
  - `rembourse` (US-14) ;
  - `doublon` : second paiement confirmé pour une app déjà payée, à rembourser à la main.
- `facture` : numéro de la facture, émise seulement pour un paiement réussi.

### 2.2 Payer une app

- `POST /api/apps/:id/paiements` (développeur validé) : corps `{ "moyen": "carte" | "mobile_money", "numeroMomo": "+229 01 97 00 00 00" }`. `numeroMomo` n'est demandé que pour `mobile_money` : format international, comme le numéro WhatsApp du §11 du Sprint 1.
  - Répond `201 { "paiement": paiement, "redirection": "/paiement/simulation/PAY-..." }`. Le site envoie le développeur vers `redirection`, la page du fournisseur ou celle de la simulation.
  - `422` : `champs.moyen` (`requis`, `valeur_inconnue`) ou `champs.numeroMomo` (`requis`, `format_invalide`).
  - `409 statut_incompatible` (avec `statut`) si l'app n'est plus en brouillon.
  - `404` pour l'app d'un autre compte.
  - `429` au-delà de 10 tentatives par heure.
  - `503 paiement_indisponible` hors simulation.
- `GET /api/paiements` : `200 { "paiements": [paiement] }`, du plus récent au plus ancien (US-15).
- `GET /api/paiements/:reference` : `200 { "paiement": paiement }`. Le site l'appelle au retour du fournisseur. `404` pour le paiement d'un autre compte.

### 2.3 Simulation (développement et tests)

- `POST /api/paiements/:reference/simulation` : corps `{ "resultat": "reussi" | "echoue" }`. Le développeur propriétaire choisit l'issue, qui est appliquée exactement comme un webhook. Répond `200 { "paiement": paiement }`. La route répond `404` hors simulation.

### 2.4 Webhook d'un fournisseur

- `POST /api/paiements/webhook/:fournisseur` : sans session.
  - Corps `{ "reference": "PAY-...", "statut": "reussi" | "echoue", "referenceFournisseur": "..." }`.
  - En-tête `X-Nakayo-Signature: sha256=<HMAC SHA-256 hexadécimal du corps brut avec PAIEMENT_WEBHOOK_SECRET>`.
  - Réponses :
    - `200 { "recu": true, "statut": "..." }` ;
    - `401 signature_invalide` ;
    - `400 corps_invalide` ;
    - `404` pour une référence inconnue.
  - L'opération est idempotente : un paiement déjà traité n'est plus modifié, ce qui permet au fournisseur de renvoyer le même webhook.
- Chaque fournisseur réel (Stripe, agrégateur Mobile Money) aura un petit adaptateur qui traduit son propre webhook vers ce format. Il reste à l'écrire quand les comptes marchands seront ouverts (US-03).

### 2.5 Migration `009_paiements.sql`

- Table `paiements` : `reference` unique, `app_id`, `developpeur_id`, `moyen`, `montant`, `devise`, `fournisseur`, `reference_fournisseur`, `numero_momo`, `statut`, `cree_le`, `confirme_le`, `rembourse_le`.
- Un seul paiement `reussi` par app (index unique partiel).
- Tables `factures` (copie du nom, de l'email et du pays du client au moment du paiement) et `compteurs_factures` (numéro continu par année : `NKY-2026-00001`).

## 3. Factures (US-15)

- La facture est émise dans la même transaction que la confirmation du paiement.
- `GET /api/factures/:numero` : `200` avec le PDF (`application/pdf`, `Content-Disposition: attachment`).
  - Accessible au développeur qui a payé, ou à un admin.
  - `404` pour la facture d'un autre compte.
- Le PDF (une page A4) contient :
  - l'émetteur et le client ;
  - la ligne de l'offre et le total payé ;
  - la date et le moyen de paiement, et la référence ;
  - la mention « Remboursé le ... » si le paiement a été remboursé.

## 4. Vérification des apps par l'équipe (US-14)

Une app payée arrive `en_verification`. Un admin vérifie le lien du test fermé, les instructions et le compte de test, puis valide ou refuse l'app.

- `GET /api/admin/apps?statut=en_verification&page=1&parPage=20` : `200 { "apps": [appAdmin], "total", "page", "parPage" }`.
  - `statut` : `en_verification` (par défaut, les plus anciennes d'abord), `validee` ou `refusee` (les plus récentes décisions d'abord).
  - `appAdmin` est l'objet `app` du §1.1, plus :
    - `developpeur` : `{ id, nom, email, pays, lienFicheDeveloppeur }` ;
    - `paiement` : `{ reference, moyen, montant, devise, montantLisible, statut, facture, confirmeLe, rembourseLe }` ;
    - `decideLe`.
  - `422` sur `statut`, `page` ou `parPage`.
- `GET /api/admin/apps/:id` : `200 { "app": appAdmin, "historique": [{ "decision", "motif", "admin", "creeLe" }] }`. `404` pour un brouillon ou un id inconnu.
- `POST /api/admin/apps/:id/validation` : l'app passe `validee`. Le développeur reçoit un email. Réponse identique au détail.
- `POST /api/admin/apps/:id/refus` : corps `{ "motif": "..." }` (10 à 500 caractères, `422` sinon).
  - L'app passe `refusee` avec le motif, et son package est libéré.
  - Le paiement réussi passe `rembourse` (avec `rembourseLe`), et la facture porte la mention « Remboursé le ... ».
  - Le développeur reçoit un email avec le motif et le montant remboursé.
- `409 statut_incompatible` (avec `statut`) si l'app a déjà été traitée, par exemple par un autre admin.
- Remboursement : tant que les comptes marchands ne sont pas ouverts (US-03), le statut `rembourse` est seulement enregistré. Avec un vrai fournisseur, l'adaptateur devra déclencher le remboursement et ne marquer le paiement qu'à sa confirmation.
- Migration `010_verification_apps.sql` :
  - colonnes `motif_refus`, `decide_par` et `decide_le` sur `apps` ;
  - table `decisions_apps` (historique, avec le paiement remboursé).

## 5. Préparation du lancement (US-42 et US-13)

Avant la campagne, le développeur coche une liste de vérification. Elle reprend les erreurs de préparation qui font le plus souvent refuser l'accès à la production. La campagne (Sprint 3) ne démarre que lorsque tous les points sont cochés.

| Code | Point à vérifier |
|---|---|
| `testeurs_ajoutes` | Le groupe Google des testeurs Nakayo est ajouté au canal de test fermé (US-13) |
| `fiche_complete` | Fiche Play Store, classification du contenu, Sécurité des données et politique de confidentialité remplies |
| `version_publiee` | Version publiée sur le canal de test fermé (statut « Publié »), lien d'inscription qui fonctionne |
| `pays_coches` | Bénin (et chaque pays des testeurs) coché dans « Pays/régions » du canal de test fermé |
| `pas_de_test_interne` | Les testeurs ne sont pas aussi inscrits au test interne |
| `mises_a_jour_prevues` | Le développeur prévoit au moins 2 nouvelles versions pendant les 14 jours, avec des notes de version |

- `GET /api/apps/:id/preparation` (développeur) : `200 { "preparation": { "elements", "complete", "completeLe" }, "elements": [codes dans l'ordre], "groupeTesteurs": "adresse" | null }`.
  - `groupeTesteurs` vient de `GROUPE_GOOGLE_TESTEURS`.
  - `null` tant que le groupe n'est pas créé : l'équipe donne alors l'adresse par email.
- `PUT /api/apps/:id/preparation` : corps `{ "elements": ["fiche_complete", ...] }`, la liste complète des points cochés.
  - Répond `200 { "app": app }`. L'objet `app` du §1.1 porte `preparation`.
  - `completeLe` est posé quand tout est coché, et remis à `null` si un point est décoché.
  - `409 statut_incompatible` pour un brouillon ou une app refusée.
  - `422` (`champs.elements` : `requis` ou `valeur_inconnue`).
  - `404` pour l'app d'un autre compte.
- Migration `011_preparation_lancement.sql` : colonnes `preparation` et `preparation_complete_le` sur `apps`.

## 6. Récapitulatif des routes

| Méthode | Route | Rôle | Section |
|---|---|---|---|
| GET | `/api/apps` | développeur | §1.3 |
| POST | `/api/apps` | développeur validé | §1.3 |
| GET | `/api/apps/:id` | développeur | §1.3 |
| PUT | `/api/apps/:id` | développeur validé | §1.4 |
| DELETE | `/api/apps/:id` | développeur | §1.4 |
| POST | `/api/apps/:id/paiements` | développeur validé | §2.2 |
| GET | `/api/offres` | public | §2.1 |
| GET | `/api/paiements` | développeur | §2.2 |
| GET | `/api/paiements/:reference` | développeur | §2.2 |
| POST | `/api/paiements/:reference/simulation` | développeur (simulation) | §2.3 |
| POST | `/api/paiements/webhook/:fournisseur` | fournisseur (signé) | §2.4 |
| GET | `/api/factures/:numero` | développeur, admin | §3 |
| GET | `/api/apps/:id/preparation` | développeur | §5 |
| PUT | `/api/apps/:id/preparation` | développeur | §5 |
| GET | `/api/admin/apps` | admin | §4 |
| GET | `/api/admin/apps/:id` | admin | §4 |
| POST | `/api/admin/apps/:id/validation` | admin | §4 |
| POST | `/api/admin/apps/:id/refus` | admin | §4 |
