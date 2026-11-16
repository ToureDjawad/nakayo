# Groupes Google des campagnes (US-43)

Chaque app a son propre Groupe Google. Le développeur l'ajoute une fois à l'onglet Testeurs de son test fermé, puis Nakayo y ajoute et en retire les testeurs sans qu'il ait rien à faire.

## Configuration (Google Workspace)

| Variable | Rôle |
| --- | --- |
| `GOOGLE_COMPTE_SERVICE_FICHIER` | Chemin du fichier JSON de la clé du compte de service (Google Cloud) |
| `GOOGLE_ADMIN_DELEGUE` | Adresse d'un administrateur du domaine Workspace, au nom de qui le compte de service agit |
| `GOOGLE_GROUPES_DOMAINE` | Domaine des groupes, par exemple `groupes.nakayo.bj` |

À faire une fois dans la console d'administration Google Workspace :

1. Créer un compte de service dans Google Cloud et activer les API « Admin SDK » et « Groups Settings ».
2. Donner au compte de service la **délégation au niveau du domaine** avec ces deux portées :
   - `https://www.googleapis.com/auth/admin.directory.group`
   - `https://www.googleapis.com/auth/apps.groups.settings`
3. Autoriser les membres extérieurs au domaine dans les groupes (les testeurs ont des adresses Gmail).

Sans ces trois variables, rien ne change : le groupe unique `GROUPE_GOOGLE_TESTEURS` est affiché comme avant, et l'équipe le remplit à la main.

## Fonctionnement

- **Création** : à la première ouverture de la préparation du lancement (`GET /api/apps/:id/preparation`) d'une app validée. L'adresse du groupe est `nakayo-app-<id>@<domaine>` et il accepte les Gmail extérieurs (migration 026, `apps.groupe_google`). Le développeur voit cette adresse à la place du groupe unique.
- **Panne Google** : le groupe unique est affiché, et la création est retentée à l'ouverture suivante.
- **Ajout des testeurs** : au démarrage de la campagne, puis toutes les 15 minutes pour ce qui n'a pas pu être fait (`affectations.groupe_ajoute_le`).
- **Retrait** : un testeur remplacé est retiré du groupe (`groupe_retire_le`).
- **Fin de campagne** : les testeurs restent dans le groupe, car le développeur en a encore besoin pour demander l'accès à la production.
- **Requêtes** : un jeton OAuth est obtenu par une assertion JWT signée RS256, sans dépendance. Un groupe ou un membre déjà présent (409), ou un membre déjà retiré (404), n'est pas une erreur.
