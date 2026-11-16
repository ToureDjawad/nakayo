package bj.nakayo.testeur.ui

// Textes des erreurs de champ (codes du contrat §1.3), en vouvoiement comme le site.
object MessagesChamps {
    fun telephone(code: String): String = when (code) {
        "requis" -> "Saisissez votre numéro de téléphone."
        "format_invalide" -> "Saisissez un numéro béninois à 10 chiffres commençant par 01, par exemple 01 97 00 00 00."
        "deja_utilise" -> "Ce numéro est déjà utilisé."
        else -> "Ce numéro n'est pas valide."
    }

    fun codeSms(code: String): String = when (code) {
        "requis" -> "Saisissez le code reçu par SMS."
        "format_invalide" -> "Le code contient 6 chiffres."
        else -> "Ce code n'est pas valide."
    }

    fun operateur(code: String): String = when (code) {
        "requis" -> "Choisissez l'opérateur de votre numéro Mobile Money."
        else -> "Choisissez MTN MoMo ou Moov Money."
    }

    fun nom(code: String): String = when (code) {
        "requis" -> "Saisissez votre nom et votre prénom."
        "trop_court" -> "Saisissez votre nom et votre prénom (2 caractères au moins)."
        "trop_long" -> "60 caractères au plus."
        else -> "Ce nom n'est pas valide."
    }

    fun ville(code: String): String = when (code) {
        "requis" -> "Choisissez votre ville."
        "trop_court", "trop_long" -> "Le nom de la ville doit faire entre 2 et 60 caractères."
        else -> "Cette ville n'est pas valide."
    }

    // US-39 : code de parrainage saisi à l'inscription.
    fun codeParrainage(code: String): String = when (code) {
        "inconnu" -> "Ce code ne correspond à aucun testeur. Vérifiez-le auprès de la personne qui vous a invité, ou laissez le champ vide."
        else -> "Un code de parrainage a 6 caractères, lettres et chiffres, par exemple K7Q2MP."
    }

    fun gmail(code: String): String = when (code) {
        "requis" -> "Saisissez l'adresse Gmail ouverte dans le Play Store de ce téléphone."
        "non_gmail" -> "Utilisez une adresse qui se termine par @gmail.com, celle du Play Store de ce téléphone."
        "deja_utilise" -> "Cette adresse Gmail est déjà utilisée par un autre compte."
        "trop_long" -> "Cette adresse est trop longue."
        else -> "Adresse incomplète. Utilisez le Gmail ouvert dans le Play Store de ce téléphone."
    }

    fun langues(code: String): String = when (code) {
        "requis" -> "Choisissez au moins une langue."
        else -> "Choisissez des langues de la liste."
    }

    fun photo(code: String): String = when (code) {
        "requis" -> "Ajoutez cette photo."
        "fichier_trop_lourd" -> "Photo trop lourde. Reprenez-la."
        "type_fichier_invalide" -> "Photo illisible. Reprenez-la."
        else -> "Reprenez cette photo."
    }

    fun motif(code: String): String = when (code) {
        "requis" -> "Expliquez pourquoi vous changez de numéro."
        "trop_court" -> "Expliquez en quelques mots (10 caractères au moins)."
        "trop_long" -> "300 caractères au plus."
        else -> "Ce motif n'est pas valide."
    }

    fun numeroMomo(code: String): String = when (code) {
        "identique" -> "C'est déjà votre numéro Mobile Money."
        "deja_utilise" -> "Ce numéro Mobile Money est déjà utilisé par un autre compte."
        else -> telephone(code)
    }

    fun sujet(code: String): String = when (code) {
        "requis" -> "Indiquez le sujet de votre message."
        "trop_court" -> "Le sujet doit faire 3 caractères au moins."
        "trop_long" -> "120 caractères au plus."
        else -> "Ce sujet n'est pas valide."
    }

    fun message(code: String): String = when (code) {
        "requis" -> "Écrivez votre message."
        "trop_court" -> "Expliquez en quelques mots (10 caractères au moins)."
        "trop_long" -> "2000 caractères au plus."
        else -> "Ce message n'est pas valide."
    }

    // Rapport du jour (§2.4).
    // US-33 : rapport de bug (docs/api-bugs.md §1.1).
    fun bug(champ: String, code: String): String = when (champ) {
        "titre" -> when (code) {
            "requis" -> "Donnez un titre court au bug."
            "trop_court" -> "Le titre doit faire 5 caractères au moins."
            "trop_long" -> "120 caractères au plus."
            else -> "Ce titre n'est pas valide."
        }
        "etapes" -> when (code) {
            "requis" -> "Indiquez les étapes pour reproduire le bug."
            "trop_court" -> "Décrivez les étapes (10 caractères au moins)."
            "trop_long" -> "2000 caractères au plus."
            else -> "Ces étapes ne sont pas valides."
        }
        "resultatAttendu" -> when (code) {
            "requis" -> "Dites ce qui aurait dû se passer."
            "trop_court" -> "5 caractères au moins."
            "trop_long" -> "1000 caractères au plus."
            else -> "Cette réponse n'est pas valide."
        }
        "resultatObtenu" -> when (code) {
            "requis" -> "Dites ce qui s'est passé à la place."
            "trop_court" -> "5 caractères au moins."
            "trop_long" -> "1000 caractères au plus."
            else -> "Cette réponse n'est pas valide."
        }
        "gravite" -> "Choisissez la gravité du bug."
        "captures" -> when (code) {
            "trop_nombreuses" -> "5 captures au plus."
            "fichier_trop_lourd" -> "Une capture est trop lourde. Choisissez une autre image."
            else -> "Une capture est illisible. Choisissez des images JPEG ou PNG."
        }
        else -> "Cette réponse n'est pas valide."
    }

    fun rapport(champ: String, code: String): String = when (champ) {
        "actions" -> when (code) {
            "requis" -> "Dites ce que vous avez fait dans l'app aujourd'hui."
            "trop_court" -> "Décrivez en une phrase (10 caractères au moins)."
            "trop_long" -> "500 caractères au plus."
            else -> "Cette réponse n'est pas valide."
        }
        "note" -> "Choisissez une note de 1 à 5."
        "bug" -> "Indiquez si vous avez rencontré un problème."
        "commentaireBug" -> when (code) {
            "requis" -> "Décrivez le problème rencontré."
            "trop_court" -> "Décrivez le problème en une phrase (10 caractères au moins)."
            "trop_long" -> "1000 caractères au plus."
            else -> "Cette description n'est pas valide."
        }
        "fonctionnalites" -> when (code) {
            "requis" -> "Cochez au moins une fonctionnalité utilisée."
            else -> "Cochez des fonctionnalités de la liste."
        }
        "retourDetaille" -> when (code) {
            "requis" -> "Écrivez votre avis détaillé sur l'app."
            "trop_court" -> "Votre avis doit faire 100 caractères au moins."
            "trop_long" -> "2000 caractères au plus."
            else -> "Cet avis n'est pas valide."
        }
        else -> "Cette réponse n'est pas valide."
    }

    // US-37 : questionnaire terrain (docs/api-offres.md §4.5).
    fun terrain(champ: String, code: String): String = when (champ) {
        "connexion" -> "Choisissez votre connexion."
        "reseau" -> "Dites comment l'app se comporte sur votre connexion."
        "telephone" -> "Dites comment l'app se comporte sur votre téléphone."
        "langue" -> "Choisissez la langue utilisée."
        "comprehension" -> "Choisissez une note de 1 à 5."
        "commentaire" -> when (code) {
            "trop_court" -> "Écrivez au moins 10 caractères, ou laissez vide."
            "trop_long" -> "1000 caractères au plus."
            else -> "Ce commentaire n'est pas valide."
        }
        else -> "Cette réponse n'est pas valide."
    }
}
