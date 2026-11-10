# API simulée

Ce dossier simule l'API décrite dans `docs/api-sprint1.md`, le temps qu'elle soit développée. Il n'est chargé qu'avec `npm run dev:mocks` ; le build de production ne l'inclut pas.

Pour le retirer : supprimer ce dossier et le bloc marqué dans `src/main.jsx`.

## Fonctionnement

- `index.js` remplace `fetch()` ; les routes non simulées (ex. `/api/health`) partent vers le vrai serveur.
- `routes.js` contient les routes simulées ; `base.js` les données, gardées dans le `localStorage` (clé `nakayo:mocks`).
- Chaque réponse arrive après 600 ms pour voir les états de chargement.
- Remise à zéro des données : `nakayoMocks.reinitialiser()` dans la console du navigateur.

## Comptes de départ

| Email | Mot de passe | Rôle et statut |
|---|---|---|
| `admin@nakayo.test` | `admin-nakayo-2026` | admin |
| `valide@exemple.com` | `motdepasse-valide` | développeur validé |
| `refuse@exemple.com` | `motdepasse-refuse` | développeur refusé |

## Scénarios

| Action | Résultat |
|---|---|
| Email contenant `+reseau` (ex. `test+reseau@exemple.com`) | coupure réseau |
| Email contenant `+serveur` | erreur 500 |
| Email contenant `+limite` | 429, réessayer dans 5 minutes |
| Inscription avec un email déjà pris (ex. `valide@exemple.com`) | 409, champ email en erreur |
| Inscription réussie | le lien de vérification est écrit dans la console du navigateur |
| `/verification-email?jeton=expire` | lien expiré |
| `/verification-email?jeton=nimportequoi` | lien invalide |
| `/verification-email?jeton=reseau` | coupure réseau, bouton « Réessayer » |
| Renvoi de l'email deux fois en moins d'une minute | 429 |
