# Schéma et contrat d'API · Sprint 1 (comptes et validation)

Ce document décrit le schéma de la base (§7) et les routes de l'API (§1 à §6) du Sprint 1. Abdel est responsable du backend, Djawad en second : le document est validé à deux avant d'écrire les migrations et les routes. Le découpage du travail backend est au §9.

| Story | Écrans | Routes |
|---|---|---|
| US-05 | Inscription développeur, « vérifie ton email », « compte en attente » | [§2](#2-inscription-développeur-us-05) |
| US-06 | Inscription testeur Android (SMS, profil, MoMo, photos, consentement) | [§4](#4-testeur-android-us-06-us-09-android) |
| US-07 | (aucun écran) résultats affichés dans US-08 | [§6](#6-contrôles-automatiques-us-07) |
| US-08 | Back-office : comptes en attente, valider ou refuser | [§5](#5-administration-des-comptes-us-08) |
| US-09 | Connexion, déconnexion, mot de passe oublié (web et Android) | [§3](#3-connexion-déconnexion-mot-de-passe-us-09-web) et [§4](#4-testeur-android-us-06-us-09-android) |
| US-10 | Profil testeur Android | [§4.4](#44-profil-testeur-us-10) |

Le front est développé contre des données simulées qui respectent exactement ce contrat (`client/src/mocks/`). Toute modification du contrat se fait par une PR qui met à jour ce fichier.

## 1. Conventions communes

### 1.1 Format

- Préfixe : `/api`. Corps en JSON (`Content-Type: application/json`), sauf l'inscription testeur (`multipart/form-data`).
- Clés en camelCase, en français, comme dans le reste du projet.
- Dates : chaînes ISO 8601 en UTC (`2026-11-10T14:07:01.512Z`). Le front les affiche à l'heure du Bénin.
- Identifiants : chaînes (`"42"`), pour ne pas dépendre de la taille des `BIGSERIAL`.
- Les chaînes reçues sont nettoyées côté serveur (`trim`), les emails mis en minuscules.

### 1.2 Authentification

| Client | Mécanisme | Durée |
|---|---|---|
| Site web (développeurs, admins) | Cookie `nakayo_session` : `HttpOnly`, `SameSite=Lax`, `Secure` en production, `Path=/` | 30 jours |
| App Android (testeurs) | En-tête `Authorization: Bearer <jeton>` | 30 jours |

- Le front web envoie ses requêtes en même origine (proxy Vite en dev), donc pas de CORS avec cookies à gérer.
- Une route protégée sans session valide répond `401 non_authentifie`. Une route admin appelée par un non-admin répond `403 interdit`.
- `POST /api/auth/deconnexion` est commun aux deux clients.

### 1.3 Format des erreurs

Toutes les erreurs ont la même forme :

```json
{
  "erreur": {
    "code": "validation",
    "message": "Certains champs sont invalides.",
    "champs": {
      "email": "deja_utilise",
      "motDePasse": "trop_court"
    }
  }
}
```

- `code` : code stable, lu par le front. Le `message` sert au débogage ; le front affiche ses propres textes.
- `champs` : présent seulement pour les erreurs liées à des champs. Clé = nom du champ envoyé, valeur = code d'erreur du champ.
- La route 404 actuelle (`{ "erreur": "Route introuvable" }`) passe à ce format : `{ "erreur": { "code": "introuvable", "message": "Route introuvable" } }`.

Codes HTTP utilisés :

| HTTP | `code` | Quand |
|---|---|---|
| 400 | `json_invalide` | corps illisible |
| 400 | `jeton_invalide` | jeton d'email ou de réinitialisation inconnu ou déjà utilisé |
| 401 | `non_authentifie` | pas de session, session expirée |
| 401 | `identifiants_invalides` | email ou mot de passe faux (sans préciser lequel) |
| 403 | `interdit` | rôle insuffisant |
| 403 | `email_non_verifie` | connexion avant d'avoir cliqué le lien de vérification |
| 403 | `compte_suspendu` | compte suspendu par un admin |
| 404 | `introuvable` | ressource ou route inconnue |
| 409 | `conflit` | valeur déjà utilisée (avec `champs`) |
| 409 | `statut_incompatible` | action impossible dans l'état actuel (ex. valider un compte déjà refusé) |
| 410 | `jeton_expire` / `code_expire` | lien ou code SMS périmé |
| 413 | `fichier_trop_lourd` | photo au-delà de la limite (avec `champs`) |
| 422 | `validation` | un ou plusieurs champs invalides (avec `champs`) |
| 429 | `trop_de_requetes` | limite atteinte ; en-tête `Retry-After` en secondes obligatoire |
| 500 | `erreur_interne` | erreur inattendue (jamais de trace dans la réponse) |
| 503 | `service_indisponible` | base ou fournisseur SMS/email en panne |

Codes d'erreur de champ (valeurs de `champs`) :

| Code | Sens |
|---|---|
| `requis` | champ absent ou vide |
| `trop_court` / `trop_long` | hors des limites du tableau 1.4 |
| `format_invalide` | email, URL, téléphone, code pays mal formés |
| `deja_utilise` | email, Gmail, numéro MoMo ou téléphone déjà pris |
| `non_gmail` | l'adresse testeur ne finit pas par `@gmail.com` |
| `valeur_inconnue` | valeur hors liste (pays, opérateur, langue, rôle) |
| `doit_etre_accepte` | case de consentement ou CGU non cochée |
| `type_fichier_invalide` | photo qui n'est ni JPEG ni PNG |
| `fichier_trop_lourd` | photo au-delà de 5 Mo |
| `non_modifiable` | champ verrouillé (ex. numéro MoMo dans le profil) |

### 1.4 Limites des champs

Le front applique les mêmes limites ; le serveur reste la référence.

| Champ | Règle |
|---|---|
| `email` | format email, 254 caractères max |
| `motDePasse` | 10 à 128 caractères, aucune règle de composition imposée |
| `nom` | 2 à 80 caractères (nom affiché ou nom de développeur) |
| `pays` | code ISO 3166-1 alpha-2 en majuscules (`BJ`, `FR`...) |
| `lienFicheDeveloppeur` | 300 caractères max, doit commencer par `https://play.google.com/store/apps/dev?id=` ou `https://play.google.com/store/apps/developer?id=` |
| `telephone`, `numeroMomo` | numéro béninois au format E.164 : `+229` puis 10 chiffres commençant par `01` (`+2290197000000`) |
| `code` (SMS) | 6 chiffres |
| `ville` | 2 à 60 caractères |
| `gmail` | adresse `@gmail.com`, 254 caractères max |
| `operateurMomo` | `mtn` ou `moov` |
| `langues` | 1 à 10 codes parmi la liste du §4.4 |
| `motif` (refus admin) | 10 à 500 caractères |
| `motif` (changement MoMo) | 10 à 300 caractères |
| Photos | JPEG ou PNG, 5 Mo max chacune |

### 1.5 Objet `utilisateur`

Renvoyé par toutes les routes d'authentification. Les champs dépendent du rôle.

```json
{
  "id": "42",
  "role": "developpeur",
  "statut": "en_attente",
  "emailVerifie": true,
  "email": "awa@studio.bj",
  "nom": "Studio Awa",
  "pays": "BJ",
  "lienFicheDeveloppeur": "https://play.google.com/store/apps/dev?id=1234567890",
  "motifRefus": null,
  "creeLe": "2026-11-10T14:07:01.512Z"
}
```

- `role` : `developpeur`, `testeur` ou `admin`.
- `statut` : `en_attente`, `valide`, `refuse`, `suspendu` (type `statut_compte` existant).
- `motifRefus` : texte saisi par l'admin quand `statut = refuse`, sinon `null`.
- Pour un testeur, voir l'objet `profilTesteur` au §4.4.

Les tables correspondantes sont décrites au §7.

## 2. Inscription développeur (US-05)

### 2.1 `POST /api/auth/inscription`

Crée un compte développeur en statut `en_attente`, email non vérifié. Envoie un email contenant le lien `{CLIENT_URL}/verification-email?jeton=<jeton>`, valable 24 h. N'ouvre pas de session.

Corps :

```json
{
  "email": "awa@studio.bj",
  "motDePasse": "une phrase assez longue",
  "nom": "Studio Awa",
  "pays": "BJ",
  "lienFicheDeveloppeur": "https://play.google.com/store/apps/dev?id=1234567890",
  "accepteConditions": true
}
```

Réponses :

| HTTP | Corps |
|---|---|
| 201 | `{ "utilisateur": { ..., "statut": "en_attente", "emailVerifie": false } }` |
| 409 `conflit` | `champs.email = "deja_utilise"` |
| 422 `validation` | `champs` selon §1.4 (`accepteConditions` : `doit_etre_accepte`) |
| 429 | plus de 5 inscriptions par heure depuis la même IP |

### 2.2 `POST /api/auth/verification-email`

Appelée par la page `/verification-email` du front avec le jeton de l'URL. Marque l'email comme vérifié, **ouvre une session** (cookie) pour que le développeur arrive directement sur l'écran « compte en attente ».

Corps : `{ "jeton": "..." }`

| HTTP | Corps |
|---|---|
| 200 | `{ "utilisateur": { ..., "emailVerifie": true } }` + cookie |
| 400 `jeton_invalide` | jeton inconnu ou déjà utilisé |
| 410 `jeton_expire` | jeton de plus de 24 h ; le front propose de renvoyer l'email |

### 2.3 `POST /api/auth/verification-email/renvoi`

Corps : `{ "email": "awa@studio.bj" }`

| HTTP | Corps |
|---|---|
| 202 | `{}` toujours, même si l'email n'existe pas ou est déjà vérifié (pas de fuite d'information) |
| 422 | `champs.email = "format_invalide"` |
| 429 | plus d'un envoi par minute ou de 5 par heure pour cette adresse ; `Retry-After` |

## 3. Connexion, déconnexion, mot de passe (US-09 web)

### 3.1 `POST /api/auth/connexion`

Pour les développeurs et les admins. Corps : `{ "email": "...", "motDePasse": "..." }`

| HTTP | Corps |
|---|---|
| 200 | `{ "utilisateur": { ... } }` + cookie de 30 jours. Un compte `en_attente` ou `refuse` se connecte aussi : le front affiche l'écran qui correspond au statut. |
| 401 `identifiants_invalides` | email inconnu ou mot de passe faux |
| 403 `email_non_verifie` | le front propose de renvoyer l'email |
| 403 `compte_suspendu` | |
| 422 `validation` | champs vides ou mal formés |
| 429 | plus de 5 échecs en 15 min pour cet email ou cette IP ; `Retry-After` |

### 3.2 `POST /api/auth/deconnexion`

Sans corps. Supprime la session (cookie ou jeton Bearer). Répond `204` même si la session était déjà expirée.

### 3.3 `GET /api/auth/moi`

Renvoie l'utilisateur de la session courante : `200 { "utilisateur": { ... } }` ou `401 non_authentifie`. Le front l'appelle au chargement pour savoir qui est connecté.

### 3.4 `POST /api/auth/mot-de-passe/oubli`

Corps : `{ "email": "..." }`. Envoie un lien `{CLIENT_URL}/reinitialiser-mot-de-passe?jeton=<jeton>` valable 1 h.

| HTTP | Corps |
|---|---|
| 202 | `{}` toujours, que l'email existe ou non |
| 422 | `champs.email = "format_invalide"` |
| 429 | même limite que §2.3 |

### 3.5 `POST /api/auth/mot-de-passe/reinitialisation`

Corps : `{ "jeton": "...", "motDePasse": "..." }`. Change le mot de passe, invalide le jeton et **toutes les sessions** de l'utilisateur. N'ouvre pas de nouvelle session : le front renvoie vers la connexion.

| HTTP | Corps |
|---|---|
| 204 | |
| 400 `jeton_invalide` | |
| 410 `jeton_expire` | |
| 422 `validation` | `champs.motDePasse` |

## 4. Testeur Android (US-06, US-09 Android)

Les testeurs n'ont pas de mot de passe : ils se connectent avec leur numéro et un code SMS. L'inscription et la connexion commencent par les deux mêmes appels.

### 4.1 `POST /api/auth/sms/envoi`

Corps : `{ "telephone": "+2290197000000" }`. Envoie un code à 6 chiffres valable 10 min.

| HTTP | Corps |
|---|---|
| 202 | `{ "expireDans": 600, "renvoiPossibleDans": 60 }` (secondes) |
| 422 | `champs.telephone = "format_invalide"` |
| 429 | plus d'un envoi par minute ou de 5 par heure pour ce numéro ; `Retry-After` |
| 503 `service_indisponible` | fournisseur SMS en panne |

### 4.2 `POST /api/auth/sms/verification`

Corps :

```json
{
  "telephone": "+2290197000000",
  "code": "482913",
  "appareil": {
    "fabricant": "Tecno",
    "modele": "Spark 20",
    "versionAndroid": "14",
    "niveauApi": 34,
    "identifiant": "8f3c2b1a..."
  }
}
```

`appareil.identifiant` est un identifiant stable propre à l'app (pas l'IMEI), utilisé pour le contrôle de doublon d'appareil (US-07).

| HTTP | Corps |
|---|---|
| 200 | Numéro connu : `{ "resultat": "connecte", "jeton": "...", "utilisateur": { profilTesteur } }` |
| 200 | Numéro inconnu : `{ "resultat": "inscription", "jetonInscription": "...", "expireDans": 1800 }` |
| 400 `code_invalide` | `{ "erreur": { ..., "tentativesRestantes": 3 } }` |
| 410 `code_expire` | |
| 429 | 5 codes faux : le code est invalidé, il faut en redemander un |
| 403 `compte_suspendu` | |

### 4.3 `POST /api/testeurs/inscription`

En-tête `Authorization: Bearer <jetonInscription>`. Corps en `multipart/form-data` :

| Champ | Type | Règle |
|---|---|---|
| `nom` | texte | §1.4 |
| `ville` | texte | §1.4 |
| `gmail` | texte | `@gmail.com` obligatoire |
| `numeroMomo` | texte | E.164 Bénin ; peut être différent du numéro de connexion |
| `operateurMomo` | texte | `mtn` ou `moov` |
| `consentementSuivi` | `"true"` | accepte le suivi du temps d'utilisation et de la position pendant les campagnes |
| `accepteConditions` | `"true"` | CGU testeur |
| `appareil` | texte JSON | même objet qu'au §4.2 |
| `pieceIdentite` | fichier | photo de la pièce d'identité, JPEG ou PNG, 5 Mo max |
| `selfie` | fichier | JPEG ou PNG, 5 Mo max |

| HTTP | Corps |
|---|---|
| 201 | `{ "jeton": "...", "utilisateur": { profilTesteur, "statut": "en_attente" } }` ; les contrôles US-07 sont lancés |
| 401 `non_authentifie` | `jetonInscription` absent, faux ou expiré : l'app repart à l'étape du numéro |
| 409 `conflit` | `champs.gmail` ou `champs.numeroMomo` = `deja_utilise` (Gmail comparé sous forme normalisée, voir §7.3) |
| 413 `fichier_trop_lourd` | `champs.pieceIdentite` ou `champs.selfie` |
| 422 `validation` | `champs` |

### 4.4 Profil testeur (US-10)

Objet `profilTesteur` :

```json
{
  "id": "77",
  "role": "testeur",
  "statut": "valide",
  "telephone": "+2290197000000",
  "nom": "Koffi Agbo",
  "ville": "Cotonou",
  "gmail": "koffi.agbo@gmail.com",
  "numeroMomo": "+2290196000000",
  "operateurMomo": "mtn",
  "langues": ["fr", "fon"],
  "appareil": { "fabricant": "Tecno", "modele": "Spark 20", "versionAndroid": "14", "niveauApi": 34 },
  "demandeChangementMomo": null,
  "motifRefus": null,
  "creeLe": "2026-11-10T14:07:01.512Z"
}
```

Codes de langue acceptés (ISO 639) : `fr` français, `en` anglais, `fon` fon, `yo` yoruba, `guw` goun, `bba` bariba, `dee` dendi, `ajg` adja, `gej` mina.

- `GET /api/testeurs/moi` : `200 { "utilisateur": profilTesteur }`.
- `PATCH /api/testeurs/moi` : corps `{ "langues": [...], "appareil": {...} }`, les deux facultatifs. L'app envoie `appareil` à chaque ouverture si le modèle ou la version a changé. Répond `200 { "utilisateur": profilTesteur }`. Envoyer `numeroMomo`, `operateurMomo`, `gmail` ou `telephone` donne `422` avec `champs.<nom> = "non_modifiable"`.
- `POST /api/testeurs/moi/demande-changement-momo` : corps `{ "numeroMomo": "...", "operateurMomo": "moov", "motif": "..." }`. Répond `201 { "demande": { "id": "5", "numeroMomo": "...", "operateurMomo": "moov", "statut": "en_attente", "creeLe": "..." } }`. `409 statut_incompatible` si une demande est déjà en attente. La demande en cours apparaît ensuite dans `profilTesteur.demandeChangementMomo`. Le traitement par l'admin viendra dans une story ultérieure.

## 5. Administration des comptes (US-08)

Toutes ces routes demandent une session `admin` (cookie).

### 5.1 `GET /api/admin/comptes`

Paramètres de requête, tous facultatifs :

| Paramètre | Valeurs | Défaut |
|---|---|---|
| `statut` | `en_attente`, `valide`, `refuse`, `suspendu` | `en_attente` |
| `role` | `developpeur`, `testeur` | les deux |
| `du`, `au` | date `AAAA-MM-JJ`, bornes incluses, sur la date d'inscription (heure du Bénin) | aucune |
| `tri` | `ancien` (plus ancien d'abord), `recent` | `ancien` |
| `page` | entier à partir de 1 | `1` |
| `parPage` | 1 à 50 | `20` |

Seuls les comptes dont l'email (développeur) ou le téléphone (testeur) est vérifié apparaissent. Paramètre invalide : `422` avec `champs`.

Réponse `200` :

```json
{
  "comptes": [
    {
      "id": "42",
      "role": "developpeur",
      "statut": "en_attente",
      "nom": "Studio Awa",
      "creeLe": "2026-11-10T14:07:01.512Z",
      "developpeur": {
        "email": "awa@studio.bj",
        "pays": "BJ",
        "lienFicheDeveloppeur": "https://play.google.com/store/apps/dev?id=1234567890"
      },
      "testeur": null,
      "controles": {
        "etat": "termine",
        "liste": [
          { "code": "fiche_play_accessible", "libelle": "Fiche développeur Google Play accessible", "resultat": "ok", "detail": null },
          { "code": "email_jetable", "libelle": "Adresse email non jetable", "resultat": "alerte", "detail": "Domaine connu comme jetable" }
        ]
      }
    }
  ],
  "total": 37,
  "page": 1,
  "parPage": 20
}
```

Pour un testeur, `developpeur` vaut `null` et `testeur` contient :

```json
{
  "telephone": "+2290197000000",
  "ville": "Cotonou",
  "gmail": "koffi.agbo@gmail.com",
  "numeroMomo": "+2290196000000",
  "operateurMomo": "mtn",
  "appareil": { "fabricant": "Tecno", "modele": "Spark 20", "versionAndroid": "14", "niveauApi": 34 }
}
```

- `controles.etat` : `en_cours` (contrôles pas encore finis, `liste` peut être incomplète) ou `termine`.
- `resultat` : `ok`, `alerte` (à regarder), `echec` (bloquant pour l'admin), `indisponible` (le contrôle n'a pas pu tourner).
- `libelle` et `detail` sont en français et affichés tels quels : ajouter un contrôle ne demande pas de changer le front.
- `libelle` décrit **la vérification réussie**, car le front l'affiche derrière le résultat : « Conforme : Numéro Mobile Money unique », « Échec : Numéro Mobile Money unique ». Éviter les libellés formulés comme le risque (« Numéro déjà utilisé »), qui donnent « Conforme : Numéro déjà utilisé ». Le `detail` explique le problème quand le résultat n'est pas `ok`.

### 5.2 `GET /api/admin/comptes/:id`

Même objet que dans la liste, avec en plus, pour un testeur, `documents` :

```json
"documents": {
  "pieceIdentite": "/api/admin/comptes/77/documents/piece-identite",
  "selfie": "/api/admin/comptes/77/documents/selfie"
}
```

Ces URL renvoient l'image (`image/jpeg` ou `image/png`) avec la session admin, et `Cache-Control: private, no-store`. Elles ne doivent jamais être publiques.

`404 introuvable` si l'id n'existe pas.

### 5.3 `POST /api/admin/comptes/:id/validation`

Sans corps. Passe le compte en `valide`, enregistre l'admin et la date, envoie la décision (email au développeur, SMS au testeur).

| HTTP | Corps |
|---|---|
| 200 | `{ "compte": { ... } }` (même forme que §5.1) |
| 404 | |
| 409 `statut_incompatible` | le compte n'est plus `en_attente` (un autre admin a déjà décidé) |

### 5.4 `POST /api/admin/comptes/:id/refus`

Corps : `{ "motif": "La fiche Google Play indiquée n'existe pas." }`. Le motif est **obligatoire** (10 à 500 caractères) et transmis à l'utilisateur dans l'email ou le SMS, et dans `utilisateur.motifRefus`.

| HTTP | Corps |
|---|---|
| 200 | `{ "compte": { ... } }` |
| 404 | |
| 409 `statut_incompatible` | |
| 422 `validation` | `champs.motif` = `requis`, `trop_court` ou `trop_long` |

## 6. Contrôles automatiques (US-07)

Liste indicative ; les codes sont libres, le front affiche `libelle` et `detail` (règle de formulation au §5.1).

| Rôle | `code` | `libelle` proposé |
|---|---|---|
| développeur | `email_jetable` | Adresse email non jetable |
| développeur | `fiche_play_accessible` | Fiche développeur Google Play accessible |
| développeur | `fiche_play_doublon` | Fiche liée à aucun autre compte |
| testeur | `momo_doublon` | Numéro Mobile Money unique |
| testeur | `momo_titulaire` | Titulaire Mobile Money identique au nom saisi (si l'agrégateur le permet) |
| testeur | `gmail_doublon` | Gmail unique |
| testeur | `appareil_doublon` | Appareil utilisé par aucun autre compte (`appareil.identifiant`) |
| testeur | `photos_presentes` | Pièce d'identité et selfie reçus |

## 7. Schéma de la base de données

### 7.1 Principes

- Une migration par lot cohérent, numérotée à la suite de `001_init.sql`, qui n'est jamais modifiée (règle du README).
- Les jetons (session, email, inscription SMS) et les codes SMS ne sont **jamais stockés en clair** : on stocke leur empreinte SHA-256 (`BYTEA`). Le jeton en clair n'existe que dans la réponse ou l'email.
- Les mots de passe sont hachés avec argon2id (ou bcrypt, coût 12 minimum).
- Les photos d'identité sont stockées hors de la base (disque privé en Sprint 1, stockage objet plus tard) ; la base garde le chemin, le type et la taille.
- Dates en `TIMESTAMPTZ`. Les dates de décision et de vérification remplacent les booléens (`email_verifie_le` plutôt que `email_verifie`).
- Les limites de requêtes (§1.3, 429) sont gardées en mémoire en Sprint 1, pas en base.

### 7.2 Migration `002_comptes.sql` (US-05, US-09, US-08)

```sql
-- Les testeurs n'ont ni email ni mot de passe : ils s'identifient par téléphone.
ALTER TABLE utilisateurs
  ALTER COLUMN email DROP NOT NULL,
  ALTER COLUMN mot_de_passe_hash DROP NOT NULL,
  ADD COLUMN email_verifie_le TIMESTAMPTZ,
  ADD COLUMN telephone_verifie_le TIMESTAMPTZ,
  ADD COLUMN lien_fiche_developpeur TEXT,
  ADD COLUMN motif_refus TEXT,
  ADD COLUMN decide_par BIGINT REFERENCES utilisateurs(id),
  ADD COLUMN decide_le TIMESTAMPTZ,
  ADD COLUMN controles_termines_le TIMESTAMPTZ,
  ADD CONSTRAINT identifiants_selon_role CHECK (
    (role IN ('developpeur', 'admin') AND email IS NOT NULL AND mot_de_passe_hash IS NOT NULL)
    OR (role = 'testeur' AND telephone IS NOT NULL)
  ),
  ADD CONSTRAINT motif_si_refus CHECK (statut <> 'refuse' OR motif_refus IS NOT NULL);

CREATE UNIQUE INDEX utilisateurs_telephone_unique ON utilisateurs (telephone) WHERE telephone IS NOT NULL;
CREATE INDEX utilisateurs_file_admin ON utilisateurs (statut, role, cree_le);
CREATE UNIQUE INDEX utilisateurs_fiche_unique ON utilisateurs (lien_fiche_developpeur)
  WHERE lien_fiche_developpeur IS NOT NULL AND statut <> 'refuse';

CREATE TYPE client_session AS ENUM ('web', 'android');

CREATE TABLE sessions (
  id BIGSERIAL PRIMARY KEY,
  utilisateur_id BIGINT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  jeton_hash BYTEA NOT NULL UNIQUE,
  client client_session NOT NULL,
  cree_le TIMESTAMPTZ NOT NULL DEFAULT now(),
  expire_le TIMESTAMPTZ NOT NULL,          -- cree_le + 30 jours
  utilisee_le TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoquee_le TIMESTAMPTZ
);
CREATE INDEX sessions_utilisateur ON sessions (utilisateur_id) WHERE revoquee_le IS NULL;

CREATE TYPE type_jeton_email AS ENUM ('verification_email', 'reinitialisation_mot_de_passe');

CREATE TABLE jetons_email (
  id BIGSERIAL PRIMARY KEY,
  utilisateur_id BIGINT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  type type_jeton_email NOT NULL,
  jeton_hash BYTEA NOT NULL UNIQUE,
  expire_le TIMESTAMPTZ NOT NULL,          -- 24 h (vérification) ou 1 h (réinitialisation)
  utilise_le TIMESTAMPTZ,
  cree_le TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE decision_compte AS ENUM ('valide', 'refuse');

-- Historique des décisions admin (US-08). Le statut courant reste dans utilisateurs.
CREATE TABLE decisions_comptes (
  id BIGSERIAL PRIMARY KEY,
  utilisateur_id BIGINT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  admin_id BIGINT NOT NULL REFERENCES utilisateurs(id),
  decision decision_compte NOT NULL,
  motif TEXT,
  cree_le TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (decision = 'valide' OR motif IS NOT NULL)
);
```

Valider ou refuser se fait dans une transaction avec `UPDATE utilisateurs SET statut = ... WHERE id = $1 AND statut = 'en_attente'` : si aucune ligne n'est modifiée, un autre admin a décidé avant, et l'API répond `409 statut_incompatible`.

### 7.3 Migration `003_testeurs.sql` (US-06, US-09 Android, US-10)

```sql
CREATE TYPE operateur_momo AS ENUM ('mtn', 'moov');

CREATE TABLE profils_testeurs (
  utilisateur_id BIGINT PRIMARY KEY REFERENCES utilisateurs(id) ON DELETE CASCADE,
  ville TEXT NOT NULL,
  gmail TEXT NOT NULL,
  -- Gmail ignore les points et ce qui suit « + » : k.offi+test@gmail.com = koffi@gmail.com
  gmail_normalise TEXT NOT NULL,
  numero_momo TEXT NOT NULL,
  operateur_momo operateur_momo NOT NULL,
  langues TEXT[] NOT NULL DEFAULT '{}',
  consentement_suivi_le TIMESTAMPTZ NOT NULL,
  conditions_acceptees_le TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX profils_gmail_unique ON profils_testeurs (gmail_normalise);
CREATE UNIQUE INDEX profils_momo_unique ON profils_testeurs (numero_momo);

CREATE TABLE appareils (
  id BIGSERIAL PRIMARY KEY,
  utilisateur_id BIGINT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  identifiant TEXT NOT NULL,               -- identifiant propre à l'app, pas l'IMEI
  fabricant TEXT,
  modele TEXT NOT NULL,
  version_android TEXT NOT NULL,
  niveau_api INTEGER NOT NULL,
  premiere_vue_le TIMESTAMPTZ NOT NULL DEFAULT now(),
  derniere_vue_le TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (utilisateur_id, identifiant)
);
CREATE INDEX appareils_identifiant ON appareils (identifiant);

CREATE TYPE type_document AS ENUM ('piece_identite', 'selfie');

CREATE TABLE documents_identite (
  id BIGSERIAL PRIMARY KEY,
  utilisateur_id BIGINT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  type type_document NOT NULL,
  chemin TEXT NOT NULL,
  type_mime TEXT NOT NULL CHECK (type_mime IN ('image/jpeg', 'image/png')),
  taille_octets INTEGER NOT NULL CHECK (taille_octets <= 5242880),
  cree_le TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (utilisateur_id, type)
);

CREATE TABLE codes_sms (
  id BIGSERIAL PRIMARY KEY,
  telephone TEXT NOT NULL,
  code_hash BYTEA NOT NULL,
  expire_le TIMESTAMPTZ NOT NULL,          -- 10 min
  tentatives SMALLINT NOT NULL DEFAULT 0,  -- invalidé à 5
  utilise_le TIMESTAMPTZ,
  cree_le TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX codes_sms_telephone ON codes_sms (telephone, cree_le DESC);

-- Jeton remis après le code SMS d'un numéro inconnu (§4.2), valable 30 min.
CREATE TABLE jetons_inscription (
  id BIGSERIAL PRIMARY KEY,
  telephone TEXT NOT NULL,
  jeton_hash BYTEA NOT NULL UNIQUE,
  appareil JSONB NOT NULL,
  expire_le TIMESTAMPTZ NOT NULL,
  utilise_le TIMESTAMPTZ,
  cree_le TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE statut_demande AS ENUM ('en_attente', 'acceptee', 'refusee');

CREATE TABLE demandes_changement_momo (
  id BIGSERIAL PRIMARY KEY,
  utilisateur_id BIGINT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  numero_momo TEXT NOT NULL,
  operateur_momo operateur_momo NOT NULL,
  motif TEXT NOT NULL,
  statut statut_demande NOT NULL DEFAULT 'en_attente',
  traitee_par BIGINT REFERENCES utilisateurs(id),
  traitee_le TIMESTAMPTZ,
  cree_le TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX demande_momo_unique_en_cours ON demandes_changement_momo (utilisateur_id)
  WHERE statut = 'en_attente';
```

Les index uniques sur `gmail_normalise` et `numero_momo` produisent le `409 deja_utilise` de l'inscription (§4.3). Les contrôles US-07 couvrent ce que l'unicité ne voit pas : même appareil sur plusieurs comptes, numéro MoMo d'un compte refusé ou supprimé, titulaire MoMo différent du nom saisi.

### 7.4 Migration `004_controles.sql` (US-07)

```sql
CREATE TYPE resultat_controle AS ENUM ('ok', 'alerte', 'echec', 'indisponible');

CREATE TABLE controles_comptes (
  id BIGSERIAL PRIMARY KEY,
  utilisateur_id BIGINT NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  libelle TEXT NOT NULL,
  resultat resultat_controle NOT NULL,
  detail TEXT,
  verifie_le TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (utilisateur_id, code)
);
```

Les contrôles tournent après l'inscription (sans bloquer la réponse). Chaque contrôle écrit sa ligne ; quand tous sont passés, `utilisateurs.controles_termines_le` est renseigné. `controles.etat` vaut `termine` si cette date existe, sinon `en_cours`.

### 7.5 Correspondance API et base

| Champ API | Colonne |
|---|---|
| `utilisateur.emailVerifie` | `email_verifie_le IS NOT NULL` |
| `utilisateur.motifRefus` | `utilisateurs.motif_refus` |
| `profilTesteur.appareil` | ligne `appareils` la plus récente (`derniere_vue_le`) |
| `profilTesteur.demandeChangementMomo` | ligne `demandes_changement_momo` en attente, ou `null` |
| `compte.controles` | `controles_comptes` + `controles_termines_le` |
| `compte.documents` | `documents_identite` (servis par la route §5.2, jamais en accès direct) |

## 8. Récapitulatif des routes

| Méthode | Route | Auth | Story |
|---|---|---|---|
| POST | `/api/auth/inscription` | aucune | US-05 |
| POST | `/api/auth/verification-email` | aucune | US-05 |
| POST | `/api/auth/verification-email/renvoi` | aucune | US-05 |
| POST | `/api/auth/connexion` | aucune | US-09 |
| POST | `/api/auth/deconnexion` | cookie ou Bearer | US-09 |
| GET | `/api/auth/moi` | cookie ou Bearer | US-09 |
| POST | `/api/auth/mot-de-passe/oubli` | aucune | US-09 |
| POST | `/api/auth/mot-de-passe/reinitialisation` | aucune | US-09 |
| POST | `/api/auth/sms/envoi` | aucune | US-06, US-09 |
| POST | `/api/auth/sms/verification` | aucune | US-06, US-09 |
| POST | `/api/testeurs/inscription` | Bearer (inscription) | US-06 |
| GET | `/api/testeurs/moi` | Bearer | US-10 |
| PATCH | `/api/testeurs/moi` | Bearer | US-10 |
| POST | `/api/testeurs/moi/demande-changement-momo` | Bearer | US-10 |
| GET | `/api/admin/comptes` | cookie admin | US-08 |
| GET | `/api/admin/comptes/:id` | cookie admin | US-08 |
| GET | `/api/admin/comptes/:id/documents/:type` | cookie admin | US-08 |
| POST | `/api/admin/comptes/:id/validation` | cookie admin | US-08 |
| POST | `/api/admin/comptes/:id/refus` | cookie admin | US-08 |

## 9. Découpage du travail backend

Chaque ligne est une branche et une PR à part, avec tests unitaires, d'intégration (API + PostgreSQL réel) et de bout en bout (front + API réelle) au vert avant la PR. On se répartit les lignes avant de commencer pour ne pas travailler à deux sur la même.

| Ordre | Branche | Contenu | Dépend de |
|---|---|---|---|
| 1 | `chore/US-09-socle-api` | outillage de test du serveur (Vitest, Supertest, base de test), format d'erreur §1.3, limites de requêtes, envoi d'emails et de SMS derrière une interface (journal en développement) | |
| 2 | `feature/US-09-api-sessions` | migration `002` (partie sessions et jetons), sessions 30 jours, cookie et Bearer, `connexion`, `deconnexion`, `moi`, mot de passe oublié | 1 |
| 3 | `feature/US-05-api-inscription-dev` | `inscription`, `verification-email`, `renvoi` | 2 |
| 4 | `feature/US-08-api-validation` | migration `002` (partie décisions), routes §5, envoi de la décision | 2 |
| 5 | `feature/US-06-api-inscription-testeur` | migration `003`, codes SMS, jeton d'inscription, inscription testeur, stockage des photos | 2 |
| 6 | `feature/US-10-api-profil-testeur` | profil, langues, appareil, demande de changement MoMo | 5 |
| 7 | `feature/US-07-controles-automatiques` | migration `004`, contrôles du §6 | 3, 5 |

Si deux branches touchent la même migration (lignes 2 et 4), la première fusionnée crée `002`, la suivante passe en `00X` suivante.

## 10. Questions ouvertes

1. Opérateurs : Celtiis existe aussi au Bénin ; on le garde hors liste pour le Sprint 1 ?
2. Le premier compte admin est créé comment (script `npm run admin:creer` ou migration) ?
3. Format de la pièce d'identité : une seule face suffit, ou recto et verso ?
4. Hachage des mots de passe : argon2id (paquet `argon2`, compilation native) ou bcrypt (`bcryptjs`, pur JavaScript) ?
5. Fournisseurs email et SMS pour le Bénin : lesquels, et qui ouvre les comptes ?
