# Garantie si Google refuse l'accès à la production (US-30)

Si Google refuse l'accès à la production après le test, le développeur peut demander **une nouvelle campagne de 14 jours offerte** ou **le remboursement** de son paiement. Il y a une seule garantie par app.

## Conditions

- La campagne est terminée, et la demande arrive au plus tard **7 jours** après sa fin.
- Le motif de Google est un **engagement insuffisant** ou un **nombre de testeurs insuffisant**.
- Le développeur colle l'email de refus de Google (30 à 5 000 caractères).
- Il confirme avoir respecté la liste de vérification d'US-42. L'admin voit si elle était complète.
- La campagne offerte n'ouvre pas droit à une nouvelle garantie.

## API développeur

`GET /api/apps/:id/garantie` répond `{ garantie, possible, jusquau, raison }`.
- `garantie` vaut `null` tant que rien n'est demandé.
- `raison` explique pourquoi la demande n'est pas possible : `campagne_pas_terminee`, `delai_depasse`, `campagne_offerte` ou `deja_demandee`.

`POST /api/apps/:id/garantie` avec `{ choix, motifGoogle, emailGoogle, engagement: true }` répond `201`.
- `choix` : `nouvelle_campagne` ou `remboursement`.
- `motifGoogle` : `engagement_insuffisant` ou `testeurs_insuffisants`.
- Erreurs : `409 garantie_existante` ou `409 garantie_impossible` (avec `raison`).
- La réponse de Google est notée « refusée » sur la campagne (taux de réussite, US-24), et les admins reçoivent un email.

Quand la garantie « nouvelle campagne » est acceptée, `POST /api/apps/:id/campagne` démarre une seconde campagne.
- Elle démarre sans paiement et sans repasser par la vérification.
- Elle est marquée `offerte`.
- Ses 15 testeurs sont tous différents de ceux de la première.

## API admin

`GET /api/admin/garanties?statut=en_attente|acceptee|refusee&page=1` répond `{ garanties, total, page, parPage }`.
- Chaque demande donne l'app, le développeur, l'email de Google et le bilan du test : fin, testeurs au bout des 14 jours, liste de vérification.

`POST /api/admin/garanties/:id/decision` avec `{ decision: "acceptee" | "refusee", motif }` répond `{ garantie }`. Le motif est obligatoire pour un refus.
- **Acceptée avec remboursement** : le dernier paiement réussi passe à « remboursé ». Le remboursement réel chez FedaPay se fait à la main, comme pour une app refusée.
- Le développeur est prévenu par email.
- La décision entre dans le journal des actions (US-29).

## Site

- **Développeur** : bloc « Garantie » sous la réponse de Google, dans le rapport de fin. Il contient le formulaire, puis le suivi de la demande et le bouton « Démarrer la campagne offerte ».
- **Admin** : page « Garanties » (`/admin/garanties`).
