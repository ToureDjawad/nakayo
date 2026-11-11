package bj.nakayo.noyau

// Mêmes règles que le serveur (server/src/lib/testeurs.js, contrat §1.4) :
// numéro béninois au format E.164, « +229 » puis 10 chiffres commençant par 01.
object Telephone {
    private val SEPARATEURS = Regex("[\\s.\\-()]")
    private val BENIN = Regex("^\\+22901\\d{8}$")

    // Accepte « 01 97 00 00 00 », « 229 0197000000 », « 00229... » ou « +2290197000000 ».
    fun normaliser(saisie: String): String {
        val v = saisie.trim().replace(SEPARATEURS, "")
        return when {
            Regex("^01\\d{8}$").matches(v) -> "+229$v"
            Regex("^22901\\d{8}$").matches(v) -> "+$v"
            Regex("^0022901\\d{8}$").matches(v) -> "+${v.drop(2)}"
            else -> v
        }
    }

    // Code d'erreur de champ du contrat, ou null si le numéro est valide.
    fun valider(normalise: String): String? = when {
        normalise.isEmpty() -> "requis"
        BENIN.matches(normalise) -> null
        else -> "format_invalide"
    }
}

object CodeSms {
    private val SIX_CHIFFRES = Regex("^\\d{6}$")

    fun valider(code: String): String? = when {
        code.isEmpty() -> "requis"
        SIX_CHIFFRES.matches(code) -> null
        else -> "format_invalide"
    }
}
