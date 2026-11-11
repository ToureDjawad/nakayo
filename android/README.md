# App Android testeur

App des testeurs Nakayo, en Kotlin avec Jetpack Compose. Android 8.0 (API 26) minimum.

## Écrans

Les écrans suivent la maquette (Figma « Nakayo · Maquette complète », parcours testeur T01 à T05 et T14) :

| Écran | Maquette | Contenu |
|---|---|---|
| Accueil | T01 | promesse, « Créer mon compte » ou « J'ai déjà un compte » |
| Numéro et code SMS | T02 | opérateur Mobile Money (création), numéro, code à 6 chiffres, renvoi après le délai |
| Profil | T03 | nom, ville, Gmail du Play Store, langues, téléphone détecté |
| Pièce d'identité et selfie | T04 | photos prises à l'appareil photo, réduites à 300 Ko environ sans métadonnées, deux consentements jamais précochés |
| En attente, refus, validé | T05, T05 bis | statut du compte, motif du refus |
| Mon profil | T14 | téléphone, numéro MoMo, demande de changement de numéro, langues |

L'étape 4 sur 4 (autorisations d'usage et de position, T06) arrive avec la mesure du temps d'usage.

## Modules

| Module | Contenu | Besoin |
|---|---|---|
| `noyau/` | client de l'API (connexion, inscription avec photos, profil, demande de changement MoMo), règles de validation, modèles du contrat, faux service pour les tests | Java seulement |
| `app/` | écrans Compose, stockage chiffré du jeton (Keystore Android), identité de l'appareil | SDK Android |

Le noyau ne dépend pas d'Android : il se teste sur n'importe quelle machine, y compris contre la vraie API. Sans SDK Android, Gradle ne construit que lui.

## Prérequis

- Java 11 ou plus pour lancer Gradle. Le JDK 17 qui compile le projet est téléchargé automatiquement par Gradle s'il manque (dans `~/.gradle/jdks`).
- Pour l'app : Android Studio, qui installe le SDK et un émulateur, ou le SDK seul avec `ANDROID_HOME` défini. Ouvrir le dossier `android/` dans Android Studio.

## Commandes

Depuis `android/` :

| Commande | Rôle |
|---|---|
| `./gradlew :noyau:test` | tests unitaires et d'intégration du noyau (faux serveur HTTP) |
| `./gradlew :noyau:apiReelle` | bout en bout : le noyau contre le vrai serveur Node, sur la base de test (`npm run db:test:up` avant) |
| `./gradlew :app:testDebugUnitTest` | tests unitaires de l'app (JVM) |
| `./gradlew :app:lintDebug` | lint Android |
| `./gradlew :app:installDebug` | installer l'app sur l'émulateur ou le téléphone branché |
| `./gradlew :app:connectedDebugAndroidTest` | tests instrumentés sur émulateur, dont un parcours contre l'API (`npm run dev` lancé avant) |

## Adresse de l'API

- **Debug** : `http://10.0.2.2:3000/`, c'est-à-dire le `npm run dev` de la machine vu depuis l'émulateur. Pour un vrai téléphone sur le même Wi-Fi : `./gradlew :app:installDebug -Pnakayo.api.debug=http://192.168.x.x:3000/`.
- **Release** : HTTPS obligatoire, `-Pnakayo.api.release=https://...`. Sans cette option, l'app pointe vers un domaine réservé qui n'existe pas.

## Sécurité

- Le jeton de session est chiffré en AES-256-GCM avec une clé du Keystore Android, qui ne quitte pas le téléphone.
- Pas de sauvegarde cloud ni de transfert vers un autre appareil (`allowBackup=false`, `data_extraction_rules.xml`).
- Release : HTTPS seulement, certificats système uniquement, code réduit et obscurci par R8. Le HTTP en clair n'est permis qu'en debug, vers le serveur de développement.
- L'identifiant d'appareil est tiré au hasard par l'app : ni IMEI, ni identifiant publicitaire.
- Photos d'identité : prises dans le cache de l'app (FileProvider non exporté), réencodées en JPEG sans métadonnées (ni position GPS ni modèle), le fichier d'origine est supprimé aussitôt. Pas d'accès à la galerie.

## Polices et icônes

Celles de la maquette : Bricolage Grotesque (titres), DM Sans (texte) et Instrument Serif italique (accent), sous licence SIL Open Font License, dans `app/src/main/res/font/`. Icônes Lucide (licence ISC) en vector drawables. Les licences sont dans `app/src/main/assets/licences/`.
