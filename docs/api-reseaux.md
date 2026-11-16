# Réseau partagé entre testeurs (US-16)

Deux testeurs qui partagent un réseau Wi-Fi (même box, même foyer) ne sont jamais affectés à la même campagne. Sinon, une seule personne pourrait faire tester plusieurs comptes.

## 1. Empreinte du réseau

- Le rapport du jour (`POST /api/testeurs/moi/apps/:id/rapports`, docs/api-sprint3.md §2.4) accepte un champ facultatif `wifi` (booléen). Une autre valeur répond `422` avec `champs.wifi = "format_invalide"`.
- Si `wifi` vaut `true`, le serveur garde une **empreinte** de l'adresse IP publique de la requête, jamais l'adresse elle-même :
  - IPv4 : l'adresse entière ;
  - IPv6 : le préfixe /64 (chaque appareil d'une box a sa propre fin d'adresse) ;
  - empreinte = HMAC SHA-256 avec `SECRET_RESEAUX`, tronqué à 32 caractères (table `reseaux_testeurs`, migration 024).
- Les rapports envoyés en données mobiles ne comptent pas : les opérateurs partagent une même adresse IP entre beaucoup d'abonnés.
- Sans `SECRET_RESEAUX` en production, aucune empreinte n'est gardée.

## 2. Affectation

- Règle stricte, au démarrage comme aux remplacements : un candidat qui partage une empreinte vue dans les **60 derniers jours** avec un testeur déjà choisi (ou déjà dans la campagne) est écarté.
- Si cela empêche de réunir les testeurs de l'offre, la campagne ne démarre pas (`409 testeurs_insuffisants`), comme pour les autres règles strictes.

## 3. Android

- L'app lit si le téléphone est en Wi-Fi (`ACCESS_NETWORK_STATE`, permission sans demande au testeur) et l'envoie avec le rapport du jour.
