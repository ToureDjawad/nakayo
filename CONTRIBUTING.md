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

## 3. Ouvrir la pull request

- Base : `main`
- Titre : `US-12 · Paiement de l'offre Standard`
- Remplir le modèle de PR (story, ce qui change, comment tester)
- Demander la relecture de l'autre membre de l'équipe

Le contrôle automatique « Workflow » vérifie le nom de la branche et le titre de la PR. Il doit être vert avant la fusion.

## 4. Relire et fusionner

- Au moins une approbation de l'autre membre de l'équipe
- Les contrôles automatiques sont verts
- La branche est à jour avec `main`
- Fusion en **Squash and merge**, puis suppression de la branche

## 5. Après la fusion

```bash
git checkout main
git pull origin main
git branch -d feature/US-12-paiement-standard
```

Mettre à jour la carte Trello de la story (colonne « Terminé »).

## Règles de la branche `main`

- Push direct interdit, même pour les administrateurs
- Pull request obligatoire, avec une approbation
- Contrôle « Workflow » obligatoire
- Pas de push forcé, pas de suppression de la branche
