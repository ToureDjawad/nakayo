# Schéma et contrat d'API · Sprint 3 (campagne de test et rapports quotidiens)

Suite de `docs/api-sprint2.md`. Mêmes conventions : JSON, identifiants en chaînes, dates ISO 8601 en UTC, erreurs `{ "erreur": { "code", "message", "champs"? } }`.

Les jours d'une campagne se comptent **à l'heure du Bénin** (UTC+1, sans heure d'été) : un jour va de 00 h 00 à 23 h 59 au Bénin, soit de 23 h 00 UTC la veille à 22 h 59 UTC.

## 1. Campagnes et affectation des testeurs (US-16, US-13, US-43)

Une fois l'app validée par l'équipe (US-14) et la liste de vérification complète (US-42), le développeur confirme que les testeurs sont ajoutés à son test fermé : la campagne démarre et 15 testeurs sont affectés.

### 1.1 Objet `campagne`

```json
{
  "id": "4",
  "app": { "id": "12", "nom": "Marché Facile", "package": "bj.studioawa.marche" },
  "statut": "en_cours",
  "jour": 3,
  "joursCampagne": 16,
  "joursExiges": 14,
  "testeursVises": 15,
  "groupeGoogle": "testeurs@nakayo.bj",
  "demarreeLe": "2026-11-12T09:00:00.000Z",
  "finPrevueLe": "2026-11-28T09:00:00.000Z",
  "termineeLe": null,
  "compteurs": { "affectes": 15, "inscritsConfirmes": 14, "installes": 13 },
  "alerteInscrits": false,
  "remplacementPossible": false,
  "testeurs": [
    { "id": "31", "numero": 1, "statut": "active", "ville": "Cotonou", "gmail": "koffi.agbo@gmail.com",
      "inscriptionConfirmee": true, "installationConfirmee": true, "joursValides": 2 }
  ]
}
```

- `statut` : `en_cours`, `terminee` ou `annulee`.
- `jour` : 1 le jour du démarrage, borné à `joursCampagne` (16 : les 14 jours exigés par Google et 2 jours de marge).
- `compteurs` : testeurs actifs (les remplacés ne comptent plus), inscriptions au test confirmées par capture, installations depuis le Play Store confirmées.
- `alerteInscrits` : vrai à partir du 2e jour si moins de 13 inscrits sont confirmés (la marge au-dessus des 12 exigés est entamée).
- **Vue du développeur** : les testeurs actifs seulement, numérotés, sans nom ni téléphone. Le Gmail reste visible : c'est la méthode de secours d'US-13, et Google le montre de toute façon au développeur une fois le testeur inscrit.
- **Vue admin** : ajoute `developpeur` et, pour chaque testeur (remplacés compris), `testeurId`, `nom`, `telephone`, `modele`, `affecteLe`, `inscriptionConfirmeeLe`, `installationConfirmeeLe`, `nombreRemises`, `remplaceeLe`, `motifRemplacement`. `remplacementPossible` est vrai pendant les 2 premiers jours.
- L'objet `app` du Sprint 2 gagne `campagne` : `{ "id", "statut", "demarreeLe" }` de la dernière campagne, ou `null`.

### 1.2 Règles d'affectation (US-16)

Sont candidats les testeurs au compte **validé** qui n'ont **jamais** été affectés à cette app (même remplacés). Ensuite :

1. **15 apps au plus** en même temps par testeur.
2. **Priorité aux plus assidus** : `(terminées + 1) / (terminées + remplacées + remises à zéro + 2)`. Un nouveau testeur part à 0,5. À égalité, celui qui a le moins d'apps en cours, puis le plus ancien.
3. **Diversité** :
   - règle stricte : 3 testeurs au plus avec le même modèle de téléphone (dernier appareil connu, sans tenir compte de la casse) ;
   - règles souples : une ville ne dépasse pas la moitié de la campagne, un opérateur Mobile Money pas les deux tiers. Si elles empêchent d'atteindre 15, un second passage complète sans elles.
4. Un verrou PostgreSQL sérialise les affectations : deux campagnes qui démarrent en même temps ne font pas dépasser les 15 apps.

S'il y a moins de 15 candidats, la campagne ne démarre pas (`409 testeurs_insuffisants`).

Pas encore appliqué : l'exclusion de deux testeurs qui partagent un réseau (US-28, Sprint 5).

### 1.3 Routes du développeur

- `GET /api/apps/:id/campagne` → `200 { "campagne": {…} | null }` : la dernière campagne de l'app.
- `POST /api/apps/:id/campagne` (compte validé) → `201 { "campagne" }`. Erreurs `409` :
  - `statut_incompatible` si l'app n'est pas validée ;
  - `preparation_incomplete` si la liste de vérification n'est pas complète ;
  - `campagne_existante` si une campagne a déjà démarré ;
  - `testeurs_insuffisants` avec `disponibles`.

  Effets : chaque testeur reçoit un SMS, le développeur reçoit un email. Le `groupeGoogle` enregistré est celui de `GROUPE_GOOGLE_TESTEURS`.
- `GET /api/apps/:id/campagne/testeurs.csv` → fichier `testeurs-<package>.csv`, une colonne `gmail`, testeurs actifs.
- Une fois la campagne démarrée, `PUT /api/apps/:id/preparation` répond `409 campagne_existante` : la liste est figée.

### 1.4 Routes admin

- `GET /api/admin/campagnes?statut=en_cours|terminee|annulee&page&parPage` → `{ "campagnes": [...], "total", "page", "parPage" }`. Chaque campagne de la liste n'a pas de `testeurs`. Les campagnes en cours sont triées de la plus ancienne à la plus récente.
- `GET /api/admin/campagnes/:id` → `{ "campagne" }` (vue admin).
- `POST /api/admin/campagnes/:id/affectations/:affectationId/remplacement` `{ "motif" }` (10 à 500 caractères) → `{ "campagne" }`.
  - Pendant les 2 premiers jours seulement, sinon `409 delai_depasse`.
  - Le remplaçant est choisi avec les mêmes règles, en tenant compte des testeurs restants.
  - Le testeur remplacé passe en `remplacee`, le remplaçant reçoit un SMS.
  - Erreurs : `409 statut_incompatible` (déjà remplacé, campagne finie), `409 testeurs_insuffisants`.

Le remplacement automatique arrivera avec US-27.

### 1.5 Migration `012_campagnes.sql`

- `campagnes` : app, développeur, statut, `testeurs_vises`, `jours_exiges`, `groupe_google`, `demarree_le`, `fin_prevue_le`, `terminee_le`. Index unique : une seule campagne `en_cours` par app.
- `affectations` :
  - campagne, `app_id` (copié de la campagne), testeur, statut `active | remplacee | terminee`, `affecte_le` ;
  - dates d'inscription et d'installation confirmées, chemin de la capture d'inscription ;
  - compteur `jours_valides` et `nombre_remises` (US-20) ;
  - champs de remplacement.

  Index unique `(app_id, testeur_id)` : jamais deux fois la même app.

### 1.6 Groupe Google

Pour l'instant, un seul groupe pour tous les testeurs (`GROUPE_GOOGLE_TESTEURS`). L'équipe y ajoute à la main le Gmail de chaque testeur validé. L'inscription réelle de chaque testeur à chaque app reste suivie par la confirmation avec capture (§2).

Les groupes par campagne, créés et remplis par l'API Admin SDK de Google Workspace, demandent un compte Workspace : ils viendront avec un adaptateur, comme les fournisseurs de paiement.

## 2. Côté testeur (US-17, US-18, US-19) · à venir

- `GET /api/testeurs/moi/apps` : les affectations actives, avec le jour, le rapport du jour, les liens d'inscription et de la fiche Play Store.
- Confirmation d'inscription avec capture, puis d'installation depuis le Play Store (source d'installation `com.android.vending`).
- Rapport quotidien, signal de connexion horodaté par le serveur, temps d'utilisation synchronisé.

## 3. Vérification de chaque nuit (US-20) · à venir

À minuit (heure du Bénin), pour chaque affectation active, le jour écoulé est validé seulement si les trois conditions sont réunies :
- au moins une connexion à l'app compagnon ;
- au moins 2 minutes d'usage de l'app testée ;
- le rapport du jour envoyé.

Sinon le compteur `jours_valides` repart à 0 et le testeur est prévenu.
