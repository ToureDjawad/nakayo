# Emails au développeur pendant la campagne (US-26)

Le développeur suit sa campagne sans se connecter. Un email par étape, envoyé une seule fois :

| Quand | Email | Où |
| --- | --- | --- |
| Démarrage | « La campagne de … a démarré » | `POST /api/apps/:id/campagne` |
| Jour 5 | Rappel : publier une nouvelle version avec les corrections | passage de la nuit |
| Jour 7 | Point de mi-parcours (testeurs actifs) | passage de la nuit |
| Jour 10 | Second rappel de nouvelle version | passage de la nuit |
| Jour 14 | Rapport de fin prêt (US-36) | passage de la nuit |
| Dès le jour 2 | Moins de 13 testeurs actifs | passage de la nuit |

## Règles

- Le passage de la nuit (après la vérification des journées, docs/api-sprint3.md §3) traite les campagnes en cours (`services/emailsCampagne.js`). Chaque envoi est noté dans `emails_campagnes` (migration 027) : un email n'est jamais envoyé deux fois.
- Après un arrêt du serveur de plusieurs jours, seule l'étape la plus récente est envoyée. Les étapes plus anciennes sont marquées comme faites.
- **Testeur actif** : inscrit au test, et soit ses 14 jours sont acquis, soit il a validé au moins une des deux dernières journées vérifiées. Pendant les 2 premiers jours, tout testeur inscrit compte.
- L'alerte « moins de 13 testeurs actifs » repart quand la campagne retrouve 13 testeurs actifs : une nouvelle chute est de nouveau signalée.
