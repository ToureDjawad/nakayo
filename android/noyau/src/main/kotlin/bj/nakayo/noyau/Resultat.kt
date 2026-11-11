package bj.nakayo.noyau

// Résultat d'un appel : jamais d'exception à attraper dans les écrans.
sealed interface Resultat<out T> {
    data class Succes<T>(val valeur: T) : Resultat<T>
    data class Echec(val erreur: ErreurApi) : Resultat<Nothing>
}

sealed interface ErreurApi {
    // Réponse d'erreur du serveur, au format du contrat (§1.3).
    data class Http(
        val statut: Int,
        val code: String,
        val message: String = "",
        val champs: Map<String, String> = emptyMap(),
        // En-tête Retry-After des réponses 429, en secondes.
        val reessayerDans: Int? = null,
        // Code SMS faux (400 code_invalide).
        val tentativesRestantes: Int? = null,
    ) : ErreurApi

    // Pas de réseau, serveur injoignable ou délai dépassé.
    data object Reseau : ErreurApi

    // Réponse reçue mais illisible (ne devrait pas arriver).
    data class Inattendue(val statut: Int) : ErreurApi
}

inline fun <T, R> Resultat<T>.map(transformer: (T) -> R): Resultat<R> = when (this) {
    is Resultat.Succes -> Resultat.Succes(transformer(valeur))
    is Resultat.Echec -> this
}
