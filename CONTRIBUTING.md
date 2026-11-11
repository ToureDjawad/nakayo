# Workflow de développement

La branche `main` est protégée : personne ne pousse directement dessus. Chaque user story du backlog (US-01 à US-44) est développée sur sa propre branche, puis fusionnée dans `main` par une pull request relue par l'autre membre de l'équipe.

## 1. Créer la branche de la story

Partir toujours d'un `main` à jour :

```bash
git checkout main
git pull origin main
git checkout -b feature/US-12-paiement-standard
```

Format du nom de branche : `<type>/US-<numéro>-<description-courte>`

| Type | Usage | Exemple |
|---|---|---|
| `feature` | nouvelle fonctionnalité d'une story | `feature/US-05-inscription-dev` |
| `fix` | correction d'un bug lié à une story | `fix/US-18-rapport-quotidien` |
| `chore` | configuration, outillage, dépendances | `chore/US-01-infra-postgres` |
| `docs` | documentation | `docs/US-02-architecture` |

La description est en minuscules, mots séparés par des tirets, sans accents. Le numéro de story a deux chiffres (US-05, pas US-5).

Pour une tâche qui ne correspond à aucune story (rare), utiliser `chore/` ou `docs/` sans numéro : `chore/mise-a-jour-dependances`.

## 2. Travailler et committer

Faire des commits petits et clairs, préfixés par le numéro de story :

```
US-12: ajoute le formulaire de paiement Standard
US-12: gère l'erreur de paiement refusé
```

Pousser régulièrement la branche :

```bash
git push -u origin feature/US-12-paiement-standard
```

## 3. Écrire les tests (obligatoire)

Une fonctionnalité n'est terminée que si elle est couverte par les trois niveaux de tests, et qu'ils passent tous.

| Niveau | Ce qu'il vérifie | Outil | Où |
|---|---|---|---|
| Unitaire | une fonction, un composant ou un module isolés, sans base ni réseau | Vitest, Testing Library | `client/tests/unit/`, `server/tests/unit/` |
| Intégration | front : écrans complets avec l'API simulée ; API : routes avec une vraie base PostgreSQL de test | Vitest, Testing Library, Supertest | `client/tests/integration/`, `server/tests/integration/` |
| E2E | front : parcours dans un vrai navigateur ; API : vrai serveur démarré avec `node src/index.js` | Playwright, Vitest | `client/tests/e2e/`, `server/tests/e2e/` |

Ce qu'on attend pour chaque story :

- **Unitaire** : chaque règle métier, cas d'erreur et état d'interface (vide, chargement, erreur) a son test.
- **Intégration** : chaque route de l'API ajoutée ou modifiée est testée avec la vraie base, y compris les refus (droits, données invalides, doublons).
- **E2E** : au moins le parcours principal de la story, tel qu'écrit dans ses critères d'acceptation.

Lancer les tests en local avant d'ouvrir la PR :

```bash
npm run db:test:up     # une fois : base PostgreSQL de test (port 5433), vidée à chaque lancement
npm run test:server    # API : unitaires, intégration et bout en bout
npm run test:client    # front : unitaires et intégration
npm run test:e2e       # front : parcours Playwright (API simulée)
npm test               # front puis API
```

Première fois pour l'E2E du front : `npx playwright install chromium` dans `client/`. Les parcours du front sur la vraie API, hors CI, sont décrits dans `client/tests/reel/README.md`.

Un test qui échoue ne se désactive pas et ne se supprime pas pour faire passer la CI : on corrige le code ou le test.

## 4. Ouvrir la pull request

- Base : `main`
- Titre : `US-12 · Paiement de l'offre Standard`
- Remplir le modèle de PR (story, ce qui change, comment tester)
- Demander la relecture de l'autre membre de l'équipe

Les contrôles automatiques doivent tous être verts avant la fusion :

- « Workflow » : nom de la branche et titre de la PR
- « Build » : lint, tests de l'API, tests du front (unitaires, intégration, E2E), build et migrations

## 5. Relire et fusionner

- Au moins une approbation de l'autre membre de l'équipe
- Les deux contrôles automatiques sont verts
- Le relecteur vérifie que les tests couvrent bien les critères d'acceptation
- La branche est à jour avec `main`
- Fusion en **Squash and merge**, puis suppression de la branche

## 6. Après la fusion

```bash
git checkout main
git pull origin main
git branch -d feature/US-12-paiement-standard
```

Mettre à jour la carte Trello de la story (colonne « Terminé »).

## Règles de la branche `main`

- Push direct interdit, même pour les administrateurs
- Pull request obligatoire, avec une approbation
- Contrôles obligatoires : « Workflow » et « Build »
- Pas de push forcé, pas de suppression de la branche
