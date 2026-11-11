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

3. Créer les tables puis les comptes de démonstration (voir plus bas) :

   ```bash
   npm run db:migrate
   npm run demo:remplir
   ```

4. Lancer l'API (port 3000) et le front (port 5173) :

   ```bash
   npm run dev
   ```

5. Ouvrir http://localhost:5173/connexion.

### Les fois suivantes

```bash
npm run db:up                # ou : podman start nakayo-db
npm run db:migrate           # seulement si de nouvelles migrations sont arrivées avec un git pull
npm run dev
```

Pour repartir de comptes de démonstration propres, relancer `npm run demo:remplir`. Les autres comptes de la base ne sont pas touchés.

Si le port 3000 ou 5173 est déjà pris, un ancien `npm run dev` tourne encore : l'arrêter (Ctrl+C dans son terminal) avant d'en lancer un autre.

### Comptes de démonstration

Créés par `npm run demo:remplir`, dans la base locale uniquement : le script refuse de tourner en production. Tous les comptes ont le même mot de passe : **`nakayo-demo-2026`**.

| Email | Rôle et statut | Ce qu'on peut essayer |
|---|---|---|
| `admin@nakayo.test` | admin | `/admin/comptes` : comptes en attente, contrôles automatiques, photos, valider ou refuser |
| `dev.valide@nakayo.test` | développeur validé | `/mon-compte` |
| `dev.attente@nakayo.test` | développeur en attente | page « compte en attente » ; visible dans la liste de l'admin |
| `dev.refuse@nakayo.test` | développeur refusé | le motif du refus s'affiche après la connexion |
| `dev.nonverifie@nakayo.test` | développeur, email non confirmé | connexion refusée, avec renvoi du lien de vérification |

Trois testeurs en attente sont aussi créés, avec de fausses photos : Koffi Agbo, Aïcha Dossou et Romuald Hounkpè (téléphones `+2290197100001` à `+2290197100003`). Le troisième utilise le même appareil que le premier, ce que signale le contrôle « appareil partagé ». Les fiches Google Play des développeurs de démo sont fictives : leur contrôle apparaît « non vérifié ».

Pour créer votre propre compte admin : `npm run admin:creer -w @nakayo/server -- --email vous@exemple.bj` (le mot de passe est demandé au clavier).

### Emails et SMS en local

Aucun email ni SMS ne part en développement : ils sont écrits dans le terminal de `npm run dev` (lignes de l'API). On y trouve le lien de vérification après une inscription, le lien de réinitialisation du mot de passe et les codes SMS.

L'app Android n'existe pas encore : un testeur se connecte en appelant l'API directement.

```bash
curl -X POST localhost:3000/api/auth/sms/envoi -H 'Content-Type: application/json' \
  -d '{"telephone":"+2290197100001"}'
# lire le code à 6 chiffres dans le terminal de l'API, le mettre à la place de 123456, puis :
curl -X POST localhost:3000/api/auth/sms/verification -H 'Content-Type: application/json' \
  -d '{"telephone":"+2290197100001","code":"123456","appareil":{"fabricant":"Tecno","modele":"Spark 20","versionAndroid":"14","niveauApi":34,"identifiant":"demo-appareil-1"}}'
# la réponse contient un jeton à passer ensuite en en-tête : Authorization: Bearer <jeton>
curl localhost:3000/api/testeurs/moi -H 'Authorization: Bearer <jeton>'
```

### Front seul, avec l'API simulée

Pour travailler sur l'interface sans base ni API :

```bash
npm run dev:mocks
```

Ce mode a ses propres comptes, différents des comptes de démonstration : voir `client/src/mocks/README.md`.

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
| `npm run demo:remplir` | créer ou recréer les comptes de démonstration (refusé en production) |
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
