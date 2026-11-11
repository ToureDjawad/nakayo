# Nakayo

Plateforme qui permet aux développeurs Android de faire tester leur application par de vrais testeurs (exigence Google Play : 12 testeurs pendant 14 jours). Les testeurs sont en Afrique de l'Ouest, à commencer par le Bénin, et sont payés par Mobile Money.

Nom de code : TestDev. Le nom « Nakayo » n'est pas encore définitif.

## Stack

- Base de données : PostgreSQL
- Front web : React + Vite, Tailwind CSS
- API : Node.js + Express
- App Android testeur : Kotlin + Jetpack Compose (choisi le 11 novembre 2026)

## Structure

```
nakayo/
├── client/               front web (React + Vite + Tailwind CSS)
├── server/               API (Node.js + Express)
│   ├── migrations/       scripts SQL appliqués dans l'ordre
│   └── src/
├── docker-compose.yml    PostgreSQL 16 pour le développement
└── .github/              workflow des PR et CI
```

## Démarrer en local

Prérequis : Node.js 22 (voir `.nvmrc`) et Docker ou Podman. Un PostgreSQL 16 installé sur la machine marche aussi.

### Première fois

1. Installer les dépendances et créer le fichier d'environnement :

   ```bash
   npm install
   cp server/.env.example server/.env
   ```

2. Démarrer PostgreSQL (port 5432), au choix :

   ```bash
   npm run db:up              # avec Docker (docker compose)
   ```

   ```bash
   # avec Podman, sans docker compose
   podman run -d --name nakayo-db --restart unless-stopped \
     -e POSTGRES_USER=nakayo -e POSTGRES_PASSWORD=nakayo -e POSTGRES_DB=nakayo \
     -p 5432:5432 -v nakayo-pgdata:/var/lib/postgresql/data docker.io/library/postgres:16
   ```

3. Créer les tables puis votre compte admin :

   ```bash
   npm run db:migrate
   npm run admin:creer -w @nakayo/server -- --email vous@exemple.bj --nom "Prénom Nom"
   ```

   Le mot de passe (10 caractères minimum) est demandé au clavier. Il peut aussi être lu dans la variable `NAKAYO_ADMIN_MOT_DE_PASSE` de `server/.env`, fichier qui n'est jamais commité. Relancer la commande avec le même email change le mot de passe.

4. Lancer l'API (port 3000) et le front (port 5173) :

   ```bash
   npm run dev
   ```

5. Ouvrir http://localhost:5173/connexion et se connecter avec le compte admin : on arrive sur `/admin/comptes`.

### Les fois suivantes

```bash
npm run db:up                # ou : podman start nakayo-db
npm run db:migrate           # seulement si de nouvelles migrations sont arrivées avec un git pull
npm run dev
```

Si le port 3000 ou 5173 est déjà pris, un ancien `npm run dev` tourne encore : l'arrêter (Ctrl+C dans son terminal) avant d'en lancer un autre.

### Créer d'autres comptes

- **Développeur** : s'inscrire sur http://localhost:5173/inscription. Le lien de vérification de l'email s'affiche dans le terminal de l'API. Le compte passe ensuite en attente : le valider depuis `/admin/comptes` avec le compte admin.
- **Testeur** : l'app Android n'existe pas encore, l'inscription se fait en appelant l'API (`POST /api/auth/sms/envoi`, `/api/auth/sms/verification`, puis `/api/testeurs/inscription` avec les photos, voir `docs/api-sprint1.md` §4).

### Emails et SMS en local

Aucun email ni SMS ne part en développement : ils sont écrits dans le terminal de `npm run dev` (lignes de l'API). On y trouve le lien de vérification après une inscription, le lien de réinitialisation du mot de passe et les codes SMS.

### Front seul, avec l'API simulée

Pour travailler sur l'interface sans base ni API :

```bash
npm run dev:mocks
```

Ce mode a ses propres comptes fictifs, qui n'existent pas dans la base : voir `client/src/mocks/README.md`.

Le contrat de l'API est dans `docs/api-sprint1.md`.

## Tests du front

| Dossier | Type | Outil |
|---|---|---|
| `client/tests/unit/` | fonctions et hooks isolés (validation, client d'API, messages) | Vitest |
| `client/tests/integration/` | pages rendues avec le vrai routeur, `fetch` simulé | Vitest + Testing Library |
| `client/tests/e2e/` | parcours complets dans Chromium, ordinateur et mobile, contrôle d'accessibilité axe | Playwright |

Avant le premier `npm run test:e2e`, installer le navigateur : `npx playwright install chromium` (depuis `client/`).

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | API + front en mode développement |
| `npm run dev:client` / `npm run dev:server` | un seul des deux |
| `npm run dev:mocks` | front seul avec l'API simulée |
| `npm run build` | build de production du front |
| `npm run lint` | vérification du code du front et de l'API |
| `npm test` | tests du front (unitaires, intégration) puis de l'API |
| `npm run test:client` | tests unitaires et d'intégration du front (Vitest) |
| `npm run test:e2e` | tests de bout en bout (Playwright, sur ordinateur et mobile, avec l'API simulée) |
| `npm run db:up` / `npm run db:down` | démarrer / arrêter PostgreSQL |
| `npm run db:migrate` | appliquer les nouvelles migrations de `server/migrations/` |
| `npm run admin:creer -w @nakayo/server -- --email ... [--nom ...]` | créer un compte admin (ou changer son mot de passe) ; le mot de passe est demandé au clavier |
| `npm run db:test:up` | démarrer la base PostgreSQL jetable des tests de l'API (port 5433, avec Docker ; voir ci-dessous pour Podman) |
| `npm run test:server` | tests de l'API : unitaires, intégration et bout en bout, sur la base de test |

Pour modifier la base, ajoute un fichier `server/migrations/00X_description.sql` ; ne modifie jamais une migration déjà fusionnée dans `main`.

## Tests de l'API

| Dossier | Type |
|---|---|
| `server/tests/unit/` | fonctions isolées, sans base |
| `server/tests/integration/` | routes appelées avec Supertest, sur une vraie base PostgreSQL |
| `server/tests/e2e/` | vrai serveur démarré (`node src/index.js`), parcours complets en HTTP |

Avec Podman, la base de test se lance ainsi :

```bash
podman run -d --name nakayo-test-db -e POSTGRES_USER=nakayo -e POSTGRES_PASSWORD=nakayo \
  -e POSTGRES_DB=nakayo_test -p 5433:5432 --tmpfs /var/lib/postgresql/data docker.io/library/postgres:16
```

La base de test (`DATABASE_URL_TEST`, par défaut `postgres://nakayo:nakayo@localhost:5433/nakayo_test`) est **vidée** à chaque lancement ; son nom doit contenir « test ». Les emails et SMS ne partent nulle part en développement et en test : ils sont écrits dans le journal du serveur.

Les mots de passe sont hachés avec scrypt (module `crypto` de Node, sans dépendance native). Les jetons de session et des liens envoyés par email ne sont stockés que sous forme d'empreinte SHA-256.

## Équipe

- Djawad : frontend (site développeur, back-office admin, écrans de l'app testeur) et tâches critiques
- Abdel : backend, API, base de données, paiements, infrastructure

## Contribuer

Toute user story se fait sur sa propre branche puis passe par une pull request vers `main`. Le détail est dans [CONTRIBUTING.md](CONTRIBUTING.md).
