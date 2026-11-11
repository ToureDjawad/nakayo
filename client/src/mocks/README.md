# API simulée

Ce dossier simule l'API décrite dans `docs/api-sprint1.md`, le temps qu'elle soit développée. Il n'est chargé qu'avec `npm run dev:mocks` ; le build de production ne l'inclut pas.

Pour le retirer : supprimer ce dossier et le bloc marqué dans `src/main.jsx`.

## Fonctionnement

- `index.js` remplace `fetch()` ; les routes non simulées (ex. `/api/health`) partent vers le vrai serveur.
- `routes.js` contient les routes simulées ; `base.js` les données, gardées dans le `localStorage` (clé `nakayo:mocks`).
- Chaque réponse arrive après 600 ms pour voir les états de chargement.
- Remise à zéro des données : `nakayoMocks.reinitialiser()` dans la console du navigateur.
- Ouvrir une session sans passer par `/connexion` : `nakayoMocks.connecter('admin@nakayo.test')` dans la console, puis recharger.

## Comptes de départ

| Email | Mot de passe | Rôle et statut |
|---|---|---|
| `admin@nakayo.test` | `admin-nakayo-2026` | admin |
| `valide@exemple.com` | `motdepasse-valide` | développeur validé |
| `refuse@exemple.com` | `motdepasse-refuse` | développeur refusé |
| `nonverifie@exemple.com` | `motdepasse-nonverifie` | développeur dont l'email n'est pas confirmé |
| `suspendu@exemple.com` | `motdepasse-suspendu` | développeur suspendu |

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

### Back-office (US-08)

Se connecter en admin sur `/connexion` (`admin@nakayo.test`), on arrive sur `/admin/comptes`.

| Compte | Cas montré |
|---|---|
| 23 comptes en attente (10 développeurs, 13 testeurs) | pagination par 20, filtres par rôle et par date |
| Apps du Sahel | contrôles encore en cours |
| Abidjan Labs | contrôle en échec (fiche Google Play introuvable) |
| Atelier Pixel | alerte (email jetable) |
| Nairobi Devs | contrôle non vérifié (Google Play indisponible) |
| Sèna Ahouansou, Abdou Salami | échecs (numéro MoMo en double, selfie illisible) |
| Carine Tossou | valider ou refuser renvoie « déjà traité par un autre administrateur » (409) |
| Se connecter en développeur (`valide@exemple.com`) | page refusée (403) |

### Connexion et mot de passe (US-09)

| Action | Résultat |
|---|---|
| Mauvais mot de passe | « Adresse email ou mot de passe incorrect », champ mot de passe vidé |
| 5 échecs en 15 minutes pour la même adresse | 429, délai affiché |
| `nonverifie@exemple.com` | email non confirmé, avec renvoi du lien |
| `suspendu@exemple.com` | compte suspendu |
| Mot de passe oublié | le lien de réinitialisation est écrit dans la console du navigateur |
| `/reinitialiser-mot-de-passe?jeton=expire` | lien expiré |
