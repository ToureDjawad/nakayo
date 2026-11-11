# Nakayo

Plateforme qui permet aux développeurs Android de faire tester leur application par de vrais testeurs (exigence Google Play : 12 testeurs pendant 14 jours). Les testeurs sont en Afrique de l'Ouest, à commencer par le Bénin, et sont payés par Mobile Money.

Nom de code : TestDev. Le nom « Nakayo » n'est pas encore définitif.

## Stack

- Base de données : PostgreSQL
- Front web : React + Vite, Tailwind CSS
- API : Node.js + Express
- App Android testeur : Kotlin ou React Native (à décider)

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

## Installation

Prérequis : Node.js 22 (voir `.nvmrc`) et Docker (ou un PostgreSQL 16 installé en local).

```bash
npm install                       # installe le front et l'API
cp server/.env.example server/.env
npm run db:up                     # démarre PostgreSQL dans Docker
npm run db:migrate                # crée les tables
npm run admin:creer -w @nakayo/server -- --email toi@exemple.bj   # premier compte admin
npm run dev                       # lance l'API (port 3000) et le front (port 5173)
```

Ouvre http://localhost:5173 : la page indique si l'API et PostgreSQL répondent.

Tant que l'API du Sprint 1 n'existe pas, le front peut tourner seul contre une API simulée :

```bash
npm run dev:mocks                 # front seul, API simulée (voir client/src/mocks/README.md)
```

Le contrat d'API attendu est dans `docs/api-sprint1.md`.

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
| `npm run lint` | vérification du code du front |
| `npm test` | tests unitaires et d'intégration du front (Vitest) |
| `npm run test:e2e` | tests de bout en bout (Playwright, sur ordinateur et mobile, avec l'API simulée) |
| `npm run db:up` / `npm run db:down` | démarrer / arrêter PostgreSQL |
| `npm run db:migrate` | appliquer les nouvelles migrations de `server/migrations/` |
| `npm run admin:creer -w @nakayo/server -- --email ... [--nom ...]` | créer un compte admin (ou changer son mot de passe) ; le mot de passe est demandé au clavier |
| `npm run db:test:up` | démarrer la base PostgreSQL jetable des tests de l'API (port 5433) |
| `npm run test:server` | tests de l'API : unitaires, intégration et bout en bout, sur la base de test |

Pour modifier la base, ajoute un fichier `server/migrations/00X_description.sql` ; ne modifie jamais une migration déjà fusionnée dans `main`.

## Tests de l'API

| Dossier | Type |
|---|---|
| `server/tests/unit/` | fonctions isolées, sans base |
| `server/tests/integration/` | routes appelées avec Supertest, sur une vraie base PostgreSQL |
| `server/tests/e2e/` | vrai serveur démarré (`node src/index.js`), parcours complets en HTTP |

La base de test (`DATABASE_URL_TEST`, par défaut `postgres://nakayo:nakayo@localhost:5433/nakayo_test`) est **vidée** à chaque lancement ; son nom doit contenir « test ». Les emails et SMS ne partent nulle part en développement et en test : ils sont écrits dans le journal du serveur.

Les mots de passe sont hachés avec scrypt (module `crypto` de Node, sans dépendance native). Les jetons de session et des liens envoyés par email ne sont stockés que sous forme d'empreinte SHA-256.

## Équipe

- Djawad : frontend (site développeur, back-office admin, écrans de l'app testeur) et tâches critiques
- Abdel : backend, API, base de données, paiements, infrastructure

## Contribuer

Toute user story se fait sur sa propre branche puis passe par une pull request vers `main`. Le détail est dans [CONTRIBUTING.md](CONTRIBUTING.md).
