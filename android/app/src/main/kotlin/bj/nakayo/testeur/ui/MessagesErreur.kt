package bj.nakayo.testeur.ui

import bj.nakayo.noyau.ErreurApi

// Textes affichés pour les erreurs de l'API (le `message` du serveur ne sert qu'au débogage).
object MessagesErreur {
    fun pour(erreur: ErreurApi): String = when (erreur) {
        ErreurApi.Reseau -> "Pas de connexion au serveur. Vérifiez votre connexion Internet, puis réessayez."
        is ErreurApi.Inattendue -> "Une erreur inattendue est survenue. Réessayez dans quelques instants."
        is ErreurApi.Http -> when (erreur.code) {
            "trop_de_requetes" -> erreur.reessayerDans?.let { "Trop de tentatives. Réessayez dans ${duree(it)}." }
                ?: "Trop de tentatives. Réessayez dans quelques minutes."
            "non_authentifie" -> "Votre session a expiré. Reconnectez-vous avec votre numéro."
            "compte_suspendu" -> "Votre compte est suspendu. Contactez l'équipe Nakayo."
            "compte_banni" -> "Ce numéro ou ce téléphone est lié à un compte fermé. Vous ne pouvez plus utiliser Nakayo."
            "compte_bloque" -> "Ces informations sont liées à un compte fermé. L'inscription est impossible."
            "code_invalide" -> when (val restantes = erreur.tentativesRestantes) {
                null -> "Code incorrect."
                0 -> "Code incorrect. Demandez un nouveau code."
                1 -> "Code incorrect. Il vous reste 1 essai."
                else -> "Code incorrect. Il vous reste $restantes essais."
            }
            "code_expire" -> "Ce code a expiré. Demandez-en un nouveau."
            "service_indisponible" -> "Le service est momentanément indisponible. Réessayez dans quelques minutes."
            "validation" -> "Certaines informations sont à corriger."
            else -> "Une erreur est survenue. Réessayez dans quelques instants."
        }
    }

    fun duree(secondes: Int): String = when {
        secondes < 60 -> if (secondes <= 1) "1 seconde" else "$secondes secondes"
        else -> ((secondes + 59) / 60).let { if (it == 1) "1 minute" else "$it minutes" }
    }
}
