# Schéma et contrat d'API · Sprint 3 (campagne de test et rapports quotidiens)

Suite de `docs/api-sprint2.md`. Mêmes conventions : JSON, identifiants en chaînes, dates ISO 8601 en UTC, erreurs `{ "erreur": { "code", "message", "champs"? } }`.

Les jours d'une campagne se comptent **à l'heure du Bénin** (UTC+1, sans heure d'été) : un jour va de 00 h 00 à 23 h 59 au Bénin, soit de 23 h 00 UTC la veille à 22 h 59 UTC.

## 1. Campagnes et affectation des testeurs (US-16, US-13, US-43)

Une fois l'app validée par l'équipe (US-14) et la liste de vérification complète (US-42), le développeur confirme que les testeurs sont ajoutés à son test fermé : la campagne démarre et 15 testeurs sont affectés.

### 1.1 Objet `campagne`

```json
{
  "id": "4",
  "app": { "id": "12", "nom": "Marché Facile", "package": "bj.studioawa.marche" },
  "statut": "en_cours",
  "jour": 3,
  "joursCampagne": 16,
  "joursExiges": 14,
  "testeursVises": 15,
  "groupeGoogle": "testeurs@nakayo.bj",
  "demarreeLe": "2026-11-12T09:00:00.000Z",
  "finPrevueLe": "2026-11-28T09:00:00.000Z",
  "termineeLe": null,
  "compteurs": { "affectes": 15, "inscritsConfirmes": 14, "installes": 13 },
  "alerteInscrits": false,
  "remplacementPossible": false,
  "testeurs": [
    { "id": "31", "numero": 1, "statut": "active", "ville": "Cotonou", "gmail": "koffi.agbo@gmail.com",
      "inscriptionConfirmee": true, "installationConfirmee": true, "joursValides": 2 }
  ]
}
```

- `statut` : `en_cours`, `terminee` ou `annulee`.
- `jour` : 1 le jour du démarrage, borné à `joursCampagne` (16 : les 14 jours exigés par Google et 2 jours de marge).
- `compteurs` : testeurs actifs (les remplacés ne comptent plus), inscriptions au test confirmées par capture, installations depuis le Play Store confirmées.
- `alerteInscrits` : vrai à partir du 2e jour si moins de 13 inscrits sont confirmés (la marge au-dessus des 12 exigés est entamée).
- **Vue du développeur** : les testeurs actifs seulement, numérotés, sans nom ni téléphone. Le Gmail reste visible : c'est la méthode de secours d'US-13, et Google le montre de toute façon au développeur une fois le testeur inscrit.
- **Vue admin** : ajoute `developpeur` et, pour chaque testeur (remplacés compris), `testeurId`, `nom`, `telephone`, `modele`, `affecteLe`, `inscriptionConfirmeeLe`, `installationConfirmeeLe`, `nombreRemises`, `remplaceeLe`, `motifRemplacement`. `remplacementPossible` est vrai pendant les 2 premiers jours.
- L'objet `app` du Sprint 2 gagne `campagne` : `{ "id", "statut", "demarreeLe" }` de la dernière campagne, ou `null`.

### 1.2 Règles d'affectation (US-16)

Sont candidats les testeurs au compte **validé** qui n'ont **jamais** été affectés à cette app (même remplacés). Ensuite :

1. **15 apps au plus** en même temps par testeur.
2. **Priorité aux plus assidus** : `(terminées + 1) / (terminées + remplacées + remises à zéro + 2)`. Un nouveau testeur part à 0,5. À égalité, celui qui a le moins d'apps en cours, puis le plus ancien.
3. **Diversité** :
   - règle stricte : 3 testeurs au plus avec le même modèle de téléphone (dernier appareil connu, sans tenir compte de la casse) ;
   - règles souples : une ville ne dépasse pas la moitié de la campagne, un opérateur Mobile Money pas les deux tiers. Si elles empêchent d'atteindre 15, un second passage complète sans elles.
4. Un verrou PostgreSQL sérialise les affectations : deux campagnes qui démarrent en même temps ne font pas dépasser les 15 apps.

S'il y a moins de 15 candidats, la campagne ne démarre pas (`409 testeurs_insuffisants`).

Pas encore appliqué : l'exclusion de deux testeurs qui partagent un réseau (US-28, Sprint 5).

### 1.3 Routes du développeur

- `GET /api/apps/:id/campagne` → `200 { "campagne": {…} | null }` : la dernière campagne de l'app.
- `POST /api/apps/:id/campagne` (compte validé) → `201 { "campagne" }`. Erreurs `409` :
  - `statut_incompatible` si l'app n'est pas validée ;
  - `preparation_incomplete` si la liste de vérification n'est pas complète ;
  - `campagne_existante` si une campagne a déjà démarré ;
  - `testeurs_insuffisants` avec `disponibles`.

  Effets : chaque testeur reçoit un SMS, le développeur reçoit un email. Le `groupeGoogle` enregistré est celui de `GROUPE_GOOGLE_TESTEURS`.
- `GET /api/apps/:id/campagne/testeurs.csv` → fichier `testeurs-<package>.csv`, une colonne `gmail`, testeurs actifs.
- Une fois la campagne démarrée, `PUT /api/apps/:id/preparation` répond `409 campagne_existante` : la liste est figée.

### 1.4 Routes admin

- `GET /api/admin/campagnes?statut=en_cours|terminee|annulee&page&parPage` → `{ "campagnes": [...], "total", "page", "parPage" }`. Chaque campagne de la liste n'a pas de `testeurs`. Les campagnes en cours sont triées de la plus ancienne à la plus récente.
- `GET /api/admin/campagnes/:id` → `{ "campagne" }` (vue admin).
- `POST /api/admin/campagnes/:id/affectations/:affectationId/remplacement` `{ "motif" }` (10 à 500 caractères) → `{ "campagne" }`.
  - Pendant les 2 premiers jours seulement, sinon `409 delai_depasse`.
  - Le remplaçant est choisi avec les mêmes règles, en tenant compte des testeurs restants.
  - Le testeur remplacé passe en `remplacee`, le remplaçant reçoit un SMS.
  - Erreurs : `409 statut_incompatible` (déjà remplacé, campagne finie), `409 testeurs_insuffisants`.

Le remplacement automatique arrivera avec US-27.

### 1.5 Migration `012_campagnes.sql`

- `campagnes` : app, développeur, statut, `testeurs_vises`, `jours_exiges`, `groupe_google`, `demarree_le`, `fin_prevue_le`, `terminee_le`. Index unique : une seule campagne `en_cours` par app.
- `affectations` :
  - campagne, `app_id` (copié de la campagne), testeur, statut `active | remplacee | terminee`, `affecte_le` ;
  - dates d'inscription et d'installation confirmées, chemin de la capture d'inscription ;
  - compteur `jours_valides` et `nombre_remises` (US-20) ;
  - champs de remplacement.

  Index unique `(app_id, testeur_id)` : jamais deux fois la même app.

### 1.6 Groupe Google

Pour l'instant, un seul groupe pour tous les testeurs (`GROUPE_GOOGLE_TESTEURS`). L'équipe y ajoute à la main le Gmail de chaque testeur validé. L'inscription réelle de chaque testeur à chaque app reste suivie par la confirmation avec capture (§2).

Les groupes par campagne, créés et remplis par l'API Admin SDK de Google Workspace, demandent un compte Workspace : ils viendront avec un adaptateur, comme les fournisseurs de paiement.

## 2. Test quotidien côté testeur (US-17, US-18, US-19)

Routes de l'app Android (`Authorization: Bearer`), réservées aux testeurs dont le compte est validé (`403 compte_non_valide` sinon). Une affectation remplacée, ou d'une campagne qui n'est plus en cours, répond `404`.

### 2.1 Apps à tester : `GET /api/testeurs/moi/apps`

```json
{ "apps": [{
  "id": "31",
  "campagneId": "4",
  "app": { "id": "12", "nom": "Marché Facile", "package": "bj.studioawa.marche", "instructions": "…",
           "fonctionnalites": ["Recherche de produits", "Panier", "Suivi de livraison"],
           "connexionRequise": true, "identifiantsTest": "Compte : test@marche.bj…" },
  "lienInscription": "https://play.google.com/apps/testing/bj.studioawa.marche",
  "lienPlayStore": "https://play.google.com/store/apps/details?id=bj.studioawa.marche",
  "jourCampagne": 3, "joursCampagne": 16, "joursExiges": 14, "joursValides": 2,
  "inscriptionConfirmee": true, "installationConfirmee": true,
  "rapportDuJour": false, "retourDetailleAttendu": true,
  "usageDuJourSecondes": 95, "usageMinimumSecondes": 120
}] }
```

- Pas d'icône côté serveur : l'app Android affiche celle de l'app installée (sinon l'initiale).
- `retourDetailleAttendu` : vrai les jours 3, 7 et 12 de la campagne tant que le rapport du jour n'est pas envoyé.
- Chaque route d'écriture ci-dessous renvoie `{ "app": {…} }` à jour.

### 2.2 Inscription au test : `POST /api/testeurs/moi/apps/:id/inscription`

- Corps : `multipart/form-data` avec un champ `capture`, une image JPEG ou PNG de 5 Mo au plus : la page « Vous êtes testeur » de Google Play.
- Erreurs : `422` (`capture` : `requis`, `type_fichier_invalide`) et `413 fichier_trop_lourd`.
- La capture est stockée hors du dossier public, comme les pièces d'identité. Une nouvelle capture remplace la précédente. La première date de confirmation est gardée.

### 2.3 Installation : `POST /api/testeurs/moi/apps/:id/installation`

- Corps : `{ "sourceInstallation": "com.android.vending" }`, la source donnée par Android (`PackageManager.getInstallSourceInfo`).
- Une autre source, par exemple un APK, répond `422` avec `sourceInstallation: source_non_play_store`.
- Avant l'inscription : `409 inscription_requise`.

### 2.4 Rapport du jour : `POST /api/testeurs/moi/apps/:id/rapports`

```json
{ "actions": "J'ai cherché du riz et ajouté deux articles au panier.", "note": 4, "bug": true,
  "commentaireBug": "Le panier se vide quand je quitte l'app.",
  "fonctionnalites": ["Recherche de produits", "Panier"], "versionApp": "1.0.3",
  "position": { "latitude": 6.36536, "longitude": 2.41833 },
  "retourDetaille": "…" }
```

Champs :
- `actions` : 10 à 500 caractères ;
- `note` : un entier de 1 à 5 ;
- `commentaireBug` : 10 à 1 000 caractères, obligatoire si `bug` est vrai ;
- `fonctionnalites` : au moins une, prises dans la liste du développeur ;
- `versionApp` : 1 à 50 caractères, lue automatiquement par l'app ;
- `retourDetaille` : 100 à 2 000 caractères, obligatoire quand `retourDetailleAttendu` est vrai.

Règles :
- La position est arrondie au centième de degré (environ 1 km) avant d'être enregistrée : la ville, pas l'adresse.
- Le jour du rapport est celui du Bénin **à la réception par le serveur** : un rapport écrit hors ligne à 23 h 50 et envoyé à 0 h 10 compte pour le lendemain.
- Réponses :
  - `201` ;
  - `409 rapport_deja_envoye` (un rapport par app et par jour) ;
  - `409 installation_requise`.

### 2.5 Ouverture de l'app compagnon : `POST /api/testeurs/moi/signal`

`200 { "recuLe" }`. L'heure est celle du serveur, jamais celle du téléphone. Une ligne par testeur et par jour (première et dernière ouverture, nombre).

### 2.6 Temps d'utilisation : `POST /api/testeurs/moi/usages`

- Corps : `{ "usages": [{ "package", "jour": "AAAA-MM-JJ", "secondes" }] }`, 1 à 100 éléments. Chaque élément est le cumul du jour mesuré par les statistiques d'usage Android.
- Réponse : `200 { "enregistres", "ignores" }`.
- Un élément est ignoré dans trois cas :
  - le package n'est pas une app en cours de test du testeur ;
  - le jour n'est ni aujourd'hui ni hier ;
  - le jour est antérieur à l'affectation.
- Le plus grand cumul reçu est gardé : un envoi en retard ne fait pas baisser le compteur.

### 2.7 Migration `013_test_quotidien.sql`

- `rapports` : unique par affectation et jour, position en `NUMERIC(5,2)`.
- `connexions_compagnon` : clé testeur et jour.
- `usages_quotidiens` : clé affectation et jour.

## 3. Vérification de chaque nuit (US-20)

### 3.1 Règle

Chaque nuit, chaque affectation active d'une campagne en cours, dont l'app est installée, est vérifiée pour le jour écoulé. Le jour est **validé** seulement si les trois conditions sont réunies ce jour-là (heure du Bénin, horloge du serveur) :

1. au moins une ouverture de l'app compagnon (`connexions_compagnon`) ;
2. au moins 2 minutes dans l'app testée (`usages_quotidiens`) ;
3. le rapport du jour envoyé (`rapports`).

Ce qui en découle :

| Situation | Effet |
|---|---|
| Jour validé | `jours_valides` + 1 |
| Jour non validé, compteur au-dessus de 0 | compteur remis à 0, `nombre_remises` + 1, `derniere_remise_jour` posé, SMS au testeur avec ce qui manquait et un rappel de ne pas se désinscrire |
| Jour non validé, compteur déjà à 0 | rien (souvent le jour de l'installation) |
| Compteur ayant atteint `jours_exiges` (14) | jours acquis : ni nouveau jour, ni remise à zéro |
| Campagne arrivée à `fin_prevue_le` (16 jours) | la campagne passe en `terminee` avec ses affectations actives |

- **Les deux compteurs ne se confondent pas.** Ce compteur sert au paiement du testeur. Celui de Google ne dépend que de l'inscription continue au test : un testeur remis à zéro garde son affectation, recommence à J1 et ne doit surtout pas se désinscrire. Le remplacement automatique viendra avec US-27.
- **Chaque vérification laisse une trace.** Elle écrit une ligne `journees` par affectation et par jour, avec la clé `(affectation, jour)` : la vérification peut être rejouée sans compter deux fois.
- **Un jour vérifié ne bouge plus.** Un temps d'utilisation envoyé après coup pour ce jour est ignoré.

### 3.2 Planification

- **Heure :** le serveur lance la vérification à **0 h 05**, heure du Bénin. Ces 5 minutes laissent arriver les derniers envois de la journée.
- **Rattrapage :** au démarrage, le serveur rattrape les 3 derniers jours non vérifiés (`verifications_quotidiennes`).
- **Lancement à la main :** `npm run journees:verifier -w @nakayo/server` vérifie les jours en retard, ou un jour précis avec `-- --jour AAAA-MM-JJ`.

### 3.3 Côté testeur

L'objet du §2.1 gagne deux champs :
- `joursAcquis` : vrai une fois les 14 jours atteints ;
- `derniereRemise` : `{ "jour", "manquait": ["connexion" | "usage" | "rapport"] }` ou `null`.

### 3.4 Migration `014_verification_quotidienne.sql`

- `journees` : connexion, usage, rapport, validé.
- `verifications_quotidiennes` : un bilan par jour vérifié.
- `affectations.derniere_remise_jour`.
