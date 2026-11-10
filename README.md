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
│   ├── tests/            tests unitaires et d'intégration
│   └── src/
├── e2e/                  tests de bout en bout (Playwright)
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
docker compose exec db createdb -U nakayo nakayo_test   # base des tests d'intégration
npx playwright install chromium   # navigateur des tests E2E
npm run dev                       # lance l'API (port 3000) et le front (port 5173)
```

Ouvre http://localhost:5173 : la page indique si l'API et PostgreSQL répondent.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | API + front en mode développement |
| `npm run dev:client` / `npm run dev:server` | un seul des deux |
| `npm run build` | build de production du front |
| `npm run lint` | vérification du code du front |
| `npm run test:unit` | tests unitaires (front et API) |
| `npm run test:integration` | tests d'intégration de l'API sur la base `nakayo_test` |
| `npm run test:e2e` | tests de bout en bout dans Chromium (Playwright) |
| `npm test` | les trois niveaux de tests |
| `npm run db:up` / `npm run db:down` | démarrer / arrêter PostgreSQL |
| `npm run db:migrate` | appliquer les nouvelles migrations de `server/migrations/` |

Pour modifier la base, ajoute un fichier `server/migrations/00X_description.sql` ; ne modifie jamais une migration déjà fusionnée dans `main`.

## Équipe

- Djawad : frontend (site développeur, back-office admin, écrans de l'app testeur) et tâches critiques
- Abdel : backend, API, base de données, paiements, infrastructure

## Contribuer

Toute user story se fait sur sa propre branche puis passe par une pull request vers `main`. Chaque fonctionnalité doit être couverte par des tests unitaires, d'intégration et E2E. Le détail est dans [CONTRIBUTING.md](CONTRIBUTING.md).
