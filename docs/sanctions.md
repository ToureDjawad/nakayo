# Sanctions des comptes et journal admin (US-29)

## Actions

`POST /api/admin/comptes/:id/sanction` avec `{ action, motif }` répond `{ compte }` (le compte relu, avec `statut` et `motifSanction`).

| Action | Depuis | Vers | Motif | Effets |
| --- | --- | --- | --- | --- |
| `suspension` | validé | `suspendu` | obligatoire (10 à 500 caractères) | déconnexion partout, connexion refusée (`compte_suspendu`), gains retenus |
| `bannissement` | validé ou suspendu | `banni` | obligatoire | idem (`compte_banni`), et numéro, Mobile Money, téléphones (identifiants d'app) et email bloqués |
| `reactivation` | suspendu ou banni | `valide` | facultatif | blocages levés ; les gains retenus sont versés au prochain passage |

- La personne est prévenue par SMS (testeur) ou par email (développeur), avec le motif.
- Un admin ne peut pas être sanctionné : la route répond `404`.
- Une action impossible depuis le statut actuel répond `409 statut_incompatible`.

## Blocages (migration 029, table `blocages`)

- **Connexion SMS** : un numéro banni, ou un téléphone banni avec un autre numéro, répond `403 compte_banni`. Aucun jeton d'inscription n'est donné.
- **Inscription testeur** : un Mobile Money banni répond `403 compte_bloque`.
- **Inscription développeur** : un email banni répond `403 compte_bloque`.

## Gains retenus

Les versements d'un compte suspendu ou banni restent « à verser » : le passage des versements les ignore. À la réactivation, ils repartent.

## Journal des actions

`GET /api/admin/journal?page=1` répond `{ actions, total, page, parPage: 30 }`, de la plus récente à la plus ancienne.

Chaque action : `{ id, action, libelle, cible: { type, id }, detail, admin: { id, nom }, le }`.

Actions enregistrées :
- validation et refus de compte ;
- validation et refus d'app ;
- remplacement manuel d'un testeur ;
- relance de versement ;
- alerte de fraude confirmée ou écartée ;
- suspension, bannissement et réactivation.

## Site

- Page « Comptes » : onglets En attente, Validés, Suspendus, Bannis. Chaque compte traité propose Suspendre, Bannir ou Réactiver, et affiche le motif de la sanction.
- Page « Journal des actions » (`/admin/journal`).
