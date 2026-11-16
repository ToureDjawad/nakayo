# Remplacement automatique des testeurs (US-27)

Objectif : garder au moins 12 testeurs actifs pendant 14 jours. Le remplacement manuel par l'admin reste possible les 2 premiers jours (docs/api-sprint3.md §1.4).

## Quand

Chaque nuit, après la vérification des journées et à partir du **jour 3** de la campagne (`services/remplacementsAuto.js`).

Un testeur est **inactif** s'il remplit les trois conditions :
- ses 14 jours ne sont pas acquis ;
- il n'est pas inscrit au test, ou il n'a validé aucune des deux dernières journées vérifiées ;
- il est arrivé depuis plus de 2 jours. Un remplaçant a, comme au démarrage, 2 jours pour s'inscrire et installer l'app.

C'est la même règle que les testeurs actifs des emails d'étapes (docs/emails-campagne.md).

## Comment

- Le remplaçant est choisi avec les règles d'affectation (US-16 : assiduité, modèles, réseau, villes). L'affectation sortante passe en `remplacee`, avec le motif « Inactif depuis 2 jours (remplacement automatique) ».
- **Prolongation sans frais** : la fin prévue de la campagne devient au moins 16 jours après le remplacement, pour que le remplaçant fasse ses 14 jours. La campagne n'est jamais raccourcie.
- **Prévenus** :
  - le testeur remplacé, par SMS ;
  - le remplaçant, par SMS (nouvelle app à tester) ;
  - le développeur, par email : nombre de remplacés, Gmail des remplaçants à ajouter s'il utilise la liste plutôt que le groupe, nouvelle date de fin.
- **Groupe Google de l'app** (US-43) : il est mis à jour tout seul.
- **Aucun testeur disponible** : l'inactif reste en place et l'email au développeur le signale. Le passage de la nuit suivante réessaie.
