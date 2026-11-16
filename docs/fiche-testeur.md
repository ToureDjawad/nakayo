# Fiche testeur pour l'admin (US-31)

But : trancher un litige (« j'ai bien testé ») avec tout ce que le testeur a fait.

## API

`GET /api/admin/testeurs/:id/historique?affectation=ID`
- Réservé aux admins.
- Sans `affectation`, la campagne la plus récente est choisie.
- `404` si le testeur est inconnu, ou si l'affectation n'est pas la sienne.

Réponse :
- `testeur` : identité, statut et motif de sanction, ville, Gmail, Mobile Money, niveau (US-38).
- `affectations` : toutes ses campagnes, avec l'app, le statut, les jours validés sur les jours exigés et le motif de remplacement.
- `affectation` : la campagne affichée.
- `jours` : un élément par jour, de l'affectation jusqu'à aujourd'hui (ou jusqu'à la fin de la campagne).
  - Forme : `{ jour, connexion: { premiere, derniere, nombre } | null, usageSecondes, rapport, valide }`.
  - Heures des connexions à l'app compagnon : heure du serveur (US-18).
  - `valide` vaut `null` tant que la vérification de la nuit n'est pas passée.
- `rapports` : du plus récent au plus ancien.
  - Champs : texte, note, bug, fonctionnalités, version, retour détaillé, heure de réception.
  - `position` : latitude et longitude arrondies à 1 km.
- `alertes` : alertes de fraude qui le concernent (US-28).

## Site

Page `/admin/testeurs/:id`. On y arrive depuis :
- la carte d'un testeur traité (page « Comptes ») ;
- une alerte de fraude.

La page montre :
- l'identité, le niveau et les actions Suspendre, Bannir ou Réactiver (US-29) ;
- les alertes ;
- le choix de la campagne ;
- le graphique du temps passé par jour et le tableau jour par jour (connexions, temps, rapport, journée validée) ;
- les positions des rapports : nuage de points et liste des lieux, avec un lien OpenStreetMap ;
- l'historique des rapports.
