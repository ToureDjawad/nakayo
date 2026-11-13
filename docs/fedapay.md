# Agrégateur FedaPay

FedaPay encaisse les développeurs (Mobile Money et carte) et verse leurs 500 FCFA aux testeurs (US-03, US-12, US-22). Le code est prêt. Il ne reste qu'à créer le compte marchand et à remplir la configuration ci-dessous.

API de référence : <https://docs.fedapay.com>. Les réponses de l'API sont enveloppées (`{"v1/transaction": {...}}`, `{"v1/payout": {...}}`).

## Configuration

| Variable | Rôle |
| --- | --- |
| `PAIEMENT_MODE=fedapay` | Les paiements des développeurs passent par FedaPay |
| `VERSEMENT_MODE=fedapay` | Les versements aux testeurs passent par FedaPay (dépôts à activer chez FedaPay) |
| `FEDAPAY_CLE_SECRETE` | Clé secrète du tableau de bord (`sk_sandbox_…` puis `sk_live_…`) |
| `FEDAPAY_ENVIRONNEMENT` | `sandbox` (par défaut) ou `live` |
| `FEDAPAY_SECRET_WEBHOOK` | Secret du webhook (Workbench > Webhooks), différent en test et en production |

Sans clé, le mode `fedapay` reste fermé : le paiement répond `503 paiement_indisponible`, et les versements attendent sans se perdre.

À déclarer dans le tableau de bord FedaPay : le webhook `https://<api>/api/fedapay/webhook`, avec les évènements des transactions et des payouts.

## 1. Paiement d'un développeur

1. `POST /api/apps/:id/paiements` crée le paiement Nakayo (`PAY-…`), puis la transaction FedaPay et son lien de paiement.
   - La réponse donne `redirection`, l'adresse de la page FedaPay. Le site y envoie le développeur.
   - Notre référence est transmise (`merchant_reference` et `custom_metadata.reference`). L'identifiant FedaPay est gardé dans `reference_fournisseur`.
2. **Devise** : FedaPay encaisse en FCFA. La carte est donc débitée du prix Mobile Money : 17 400 FCFA, soit la même valeur que 29 $ au taux de 600 FCFA.
   - `GET /api/offres` ajoute alors `debitCarte: { montant: 17400, devise: "XOF" }`, et la page de paiement l'affiche.
3. **Numéro** : pour le Mobile Money, le numéro saisi est prérempli chez FedaPay (pays couverts : Bénin, Togo, Côte d'Ivoire, Sénégal, Burkina Faso, Mali, Niger, Guinée).
4. **Panne** : si FedaPay ne répond pas, la réponse est `502 fournisseur_indisponible`. Le paiement est clos (`echoue`) et l'app reste en brouillon.

## 2. Retour du développeur

FedaPay renvoie le développeur sur `/mon-compte/paiements/:reference`, une page qui relit le paiement. Si le webhook n'est pas encore arrivé, `GET /api/paiements/:reference` relit le statut chez FedaPay et valide le paiement s'il est approuvé.

## 3. Webhook

`POST /api/fedapay/webhook`, sans session.

- **Signature** : l'en-tête `X-FEDAPAY-SIGNATURE: t=<horodatage>,s=<signature>`. La signature est un HMAC SHA-256 de `<horodatage>.<corps brut>`, calculé avec `FEDAPAY_SECRET_WEBHOOK`. Un horodatage de plus de 5 minutes est refusé (`401 signature_invalide`).
- **`transaction.approved` / `transferred`** : le paiement est réussi, puis viennent la facture et le reçu par email. **`declined` / `canceled` / `refunded` / `expired`** : le paiement échoue.
- **`payout.*`** : `sent` vaut versé, avec un SMS au testeur. `failed` vaut échec : nouvelle tentative, ou alerte admin après 4 essais, avec le motif `last_error_code`.
- Le paiement ou le versement est retrouvé par notre référence, ou à défaut par l'identifiant FedaPay.
- Les autres évènements sont acquittés sans effet. Tout est idempotent : FedaPay renvoie l'évènement jusqu'à 10 fois tant qu'il ne reçoit pas de 2xx.

## 4. Versements aux testeurs

Le passage des versements (toutes les 15 minutes) crée un payout FedaPay puis le lance (`POST /payouts`, puis `PUT /payouts/start`).

- **Opérateurs** : MTN (`mtn_open`), Moov (`moov`), Celtiis (`sbin`).
- **Statuts** :
  - `sent` : versé tout de suite ;
  - `pending` / `started` : en cours, le webhook confirmera ;
  - `failed` : nouvelle tentative.
- Un numéro hors des pays couverts échoue sans appel à FedaPay (motif `compte_non_pris_en_charge`).
- **Limite FedaPay** : 3 dépôts au plus vers un même numéro par 24 h.

## À vérifier à l'ouverture du compte

- Les frais des dépôts : la grille indique 150 FCFA par dépôt de moins de 10 000 FCFA, le support parle de gratuité.
- L'acceptation des cartes européennes et leurs frais.
- Un paiement de test de bout en bout dans l'environnement `sandbox`, puis le passage en `live`.
