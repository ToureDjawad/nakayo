# Abonnement Agence (US-45)

Pour les agences et studios qui testent plusieurs apps par mois.

## Formule

- 69 $ ou 41 400 FCFA par mois (1 $ = 600 FCFA).
- 3 campagnes Standard par mois. Les campagnes non utilisées ne sont pas reportées.
- Les offres Pro et Plus restent payées à part, app par app.
- Une app refusée à la vérification rend sa campagne au mois en cours.
- Une campagne prise sur l'abonnement ne se rembourse pas au titre de la garantie : la garantie donne une nouvelle campagne offerte.

## Paiement et renouvellement

Mobile Money ne permet pas de prélèvement automatique. Chaque mois, le développeur valide donc lui-même le paiement chez FedaPay, par Mobile Money ou par carte. En mode simulation, la page de simulation remplace FedaPay.

- Le premier paiement ouvre un mois à partir de la date du paiement.
- Le renouvellement s'ouvre 7 jours avant l'échéance. On ne paie pas plusieurs mois d'avance.
- Un renouvellement payé avant l'échéance, ou pendant le délai de grâce, enchaîne sur le mois précédent. Après la suspension, le nouveau mois commence au jour du paiement.
- Chaque mois payé a sa facture (« Abonnement Agence : 3 campagnes Standard, du … au … ») et son reçu par email.

## Échéance, grâce et suspension

| Moment | Ce qui se passe |
|---|---|
| 3 jours avant l'échéance | Rappel par email et par SMS |
| Jour de l'échéance | Rappel par email et par SMS ; l'abonnement passe « Échéance passée » |
| 3 jours après l'échéance | Abonnement suspendu, email et SMS |

Les rappels partent au passage de nuit (`envoyerRappelsAbonnements`), une seule fois par échéance et par type (table `rappels_abonnement`). Le SMS va au numéro Mobile Money qui a payé, ou au numéro donné à la souscription par carte.

Pendant la grâce, les campagnes restantes du mois peuvent encore être utilisées. Une fois suspendu, l'abonnement ne permet plus de lancer de campagne. Les campagnes déjà lancées continuent toujours jusqu'au bout.

## Prélèvement automatique par carte

Pas encore branché : il faut d'abord ouvrir un compte Paddle, Lemon Squeezy ou Stripe. Le moment venu, le webhook du fournisseur n'aura qu'à créer un paiement de nature `abonnement` réussi : `ajouterMois` ajoute alors le mois et la facture comme pour un renouvellement manuel.

## API

- `GET /api/abonnement` : `{ abonnement, offre }`. `abonnement` vaut `null` sans mois payé ; sinon `statut` (`actif`, `en_grace`, `suspendu`), `echeance`, `finGrace`, `campagnesIncluses`, `campagnesUtilisees`, `campagnesRestantes`, `renouvelable`.
- `POST /api/abonnement/paiements` `{ moyen, numeroMomo?, telephoneRappels? }` : 201 `{ paiement, redirection }`. 409 `renouvellement_trop_tot` avant J-7. 403 pour un compte non validé.
- `POST /api/apps/:id/abonnement` : l'app en brouillon passe en vérification en Offre Standard, sans paiement. 409 `sans_abonnement`, `abonnement_suspendu`, `quota_atteint` ou `statut_incompatible`.
- Les paiements d'abonnement apparaissent dans `GET /api/paiements` avec `nature: 'abonnement'` et `appId: null`.

## Base

Migration `032_abonnements.sql` : `abonnements` (un par développeur), `periodes_abonnement` (un mois payé par ligne), `rappels_abonnement`, `paiements.app_id` facultatif pour la nature `abonnement`, `apps.abonnement_id` et `apps.abonnement_utilise_le` pour compter les campagnes du mois.
