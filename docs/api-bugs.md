# Rapports de bugs avec captures (US-33, US-34)

Suite de `docs/api-offres.md`. Mêmes conventions : JSON, identifiants en chaînes, dates ISO 8601 en UTC, erreurs `{ "erreur": { "code", "message", "champs"? } }`.

Les rapports de bugs sont réservés aux apps en Offre Pro ou Lancement Afrique. Le testeur les envoie depuis l'app Android, à tout moment de sa campagne. Le développeur accepte ou refuse chaque bug (US-34). Un bug accepté rapporte un bonus au testeur.

## 1. Testeur (app Android)

Authentification par jeton (`Authorization: Bearer …`), compte testeur validé. `:id` est l'identifiant de l'affectation, comme pour le rapport du jour (`docs/api-sprint3.md` §2). L'affectation doit être active, dans une campagne en cours, sinon `404`.

L'objet « app à tester » (§2.1 du Sprint 3) porte `rapportsDeBugs: true` quand l'offre de l'app les prévoit.

### 1.1 `POST /api/testeurs/moi/apps/:id/bugs`

Formulaire `multipart/form-data` :

| Champ | Règle |
| --- | --- |
| `titre` | 5 à 120 caractères |
| `etapes` | étapes pour reproduire, 10 à 2000 caractères |
| `resultatAttendu` | 5 à 1000 caractères |
| `resultatObtenu` | 5 à 1000 caractères |
| `gravite` | `mineure`, `genante` ou `bloquante` |
| `versionApp` | version installée, 1 à 50 caractères (lue par l'app Android) |
| `captures` | 0 à 5 fichiers JPEG ou PNG, 5 Mo chacun au plus |

Réponse `201` :

```json
{ "bug": {
  "id": "8", "titre": "Le panier se vide", "etapes": "1. …", "resultatAttendu": "…", "resultatObtenu": "…",
  "gravite": "genante", "versionApp": "1.0.3", "captures": 2,
  "statut": "nouveau", "motifRefus": null, "signaleLe": "2026-11-13T09:00:00.000Z", "decideLe": null
} }
```

Erreurs :

| Statut | Code | Cas |
| --- | --- | --- |
| `403` | `offre_sans_rapports_de_bugs` | app en Offre Standard |
| `413` | `fichier_trop_lourd` | une capture dépasse 5 Mo (`champs.captures`) |
| `422` | `validation` | champs invalides ; `captures` : `trop_nombreuses` ou `type_fichier_invalide` |

Les captures sont gardées hors du dossier public, comme les pièces d'identité. Elles ne sont servies qu'au développeur de l'app et aux admins (US-34). Si l'enregistrement échoue, les fichiers déjà écrits sont supprimés.

### 1.2 `GET /api/testeurs/moi/apps/:id/bugs`

Les bugs du testeur sur cette app, du plus récent au plus ancien, avec la décision du développeur : `{ "bugs": [ … ] }`, même objet qu'au §1.1.

## 2. Développeur (US-34)

À venir : liste des bugs d'une app, captures, décision (accepter ou refuser avec un motif) et export CSV.

## 3. Bonus des bugs acceptés

- **Montant.** 200 FCFA par bug accepté (`BONUS_BUG`, `server/src/lib/offres.js`).
- **Versement.** Le bonus s'ajoute au versement de clôture du testeur (J16) : 800 FCFA en Pro, plus 200 FCFA par bug accepté. Un seul transfert Mobile Money par testeur et par campagne, donc des frais et une limite FedaPay (3 versements par numéro et par 24 h) épargnés.
- **Condition.** Comme la paie, le bonus va aux testeurs qui ont leurs 14 jours à la clôture.
- **Délai.** Seuls les bugs acceptés avant la clôture comptent. Le portefeuille du testeur montre le gain prévu, bonus compris.

## 4. Base de données (migration 019)

Table `bugs` : affectation, campagne, app, testeur, champs du formulaire, chemins des captures (5 au plus), `statut` (`nouveau`, `accepte`, `refuse`), `motif_refus`, `decide_le`, `signale_le`.

## 5. App Android

- Page de l'app : bouton « Signaler un bug » quand `rapportsDeBugs` est vrai et l'installation confirmée.
- Écran « Signaler un bug » : titre, étapes, résultat attendu, résultat obtenu, gravité. On y ajoute les captures une à une, 5 au plus, chacune réduite avant l'envoi comme la capture d'inscription.
- Sous le formulaire, les bugs déjà signalés : en attente, accepté (+200 FCFA) ou refusé avec le motif.
