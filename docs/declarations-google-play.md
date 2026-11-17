# Déclarations Google Play de l'app Nakayo (US-04, US-41)

Réponses à reporter dans la Play Console au moment de publier l'app compagnon. Elles décrivent ce que fait le code au 17/11/2026 ; à revoir si la collecte change.

## Section « Sécurité des données »

Chiffrement en transit : oui (HTTPS). Suppression du compte : sur demande au support (voir la politique de confidentialité).

| Type de donnée Google | Collectée | Partagée | Finalité | Facultative |
|---|---|---|---|---|
| Nom | Oui | Non | Gestion du compte | Non |
| Numéro de téléphone | Oui | Non | Gestion du compte, paiements (Mobile Money) | Non |
| Adresse email (Gmail) | Oui | Oui, au développeur de l'app testée et à Google (groupe de test) | Fonctionnalités de l'app | Non |
| Position approximative | Oui | Non | Prévention de la fraude | Non |
| Pièce d'identité et selfie (photos) | Oui | Non | Prévention de la fraude, vérification du compte | Non |
| Interactions avec l'app (temps passé dans les apps testées) | Oui | Oui, au développeur (durée seulement) | Fonctionnalités de l'app, prévention de la fraude | Non |
| Contenu généré (rapports, captures de bugs) | Oui | Oui, au développeur de l'app testée | Fonctionnalités de l'app | Non |
| Identifiants de l'appareil et infos sur l'appareil | Oui | Non | Prévention de la fraude | Non |
| Informations financières (numéro Mobile Money) | Oui | Oui, au prestataire de paiement | Paiements | Non |

Pas de position précise, pas de position en arrière-plan, pas de liste des apps installées, pas de publicité.

## Autorisations sensibles

- `PACKAGE_USAGE_STATS` : un écran explique, avant d'ouvrir les réglages, que seul le temps passé dans les apps testées est envoyé (`EcranApp`, « Autorisez Nakayo à mesurer le temps d'utilisation »). Le consentement est aussi demandé par une case à l'inscription.
- `ACCESS_COARSE_LOCATION` : une note visible sur l'écran du rapport explique, avant la demande d'Android, que la position approximative est enregistrée seulement à l'envoi (`EcranRapport`). Aucune autorisation de position en arrière-plan n'est demandée.

## Liens à renseigner

- Politique de confidentialité : `<adresse du site>/confidentialite`
- Conditions d'utilisation : `<adresse du site>/conditions-utilisation`
