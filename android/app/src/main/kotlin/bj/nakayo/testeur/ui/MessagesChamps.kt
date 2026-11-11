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
}
