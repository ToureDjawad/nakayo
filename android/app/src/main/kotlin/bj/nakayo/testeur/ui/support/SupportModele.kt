package bj.nakayo.testeur.ui.support

import bj.nakayo.noyau.ErreurApi
import bj.nakayo.noyau.ProfilTesteur
import bj.nakayo.noyau.Resultat
import bj.nakayo.noyau.ServiceTesteur
import bj.nakayo.noyau.Ticket
import bj.nakayo.testeur.ui.MessagesErreur
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

// Longueurs du contrat (§12.1), en caractères comme le serveur.
const val SUJET_MIN = 3
const val SUJET_MAX = 120
const val MESSAGE_MIN = 10
const val MESSAGE_MAX = 2000

data class EtatSupport(
    val sujet: String = "",
    val message: String = "",
    // Codes d'erreur par champ (« requis », « trop_court », « trop_long »).
    val erreurs: Map<String, String> = emptyMap(),
    val envoiEnCours: Boolean = false,
    val information: String? = null,
    val erreur: String? = null,
    // Messages déjà envoyés, du plus récent au plus ancien ; null tant qu'ils ne sont pas chargés.
    val tickets: List<Ticket>? = null,
)

private fun longueur(texte: String) = texte.codePointCount(0, texte.length)

fun validerSujet(sujet: String): String? {
    val s = sujet.trim().replace(Regex("\\s+"), " ")
    return when {
        s.isEmpty() -> "requis"
        longueur(s) < SUJET_MIN -> "trop_court"
        longueur(s) > SUJET_MAX -> "trop_long"
        else -> null
    }
}

fun validerMessage(message: String): String? {
    val m = message.trim()
    return when {
        m.isEmpty() -> "requis"
        longueur(m) < MESSAGE_MIN -> "trop_court"
        longueur(m) > MESSAGE_MAX -> "trop_long"
        else -> null
    }
}

// Écrire à l'équipe Nakayo (US-40, contrat §12.1) depuis l'espace du testeur.
class SupportModele(
    private val service: ServiceTesteur,
    private val portee: CoroutineScope,
    // Profil de l'espace, rendu au retour.
    private val profil: ProfilTesteur?,
    private val surQuitter: (ProfilTesteur?) -> Unit,
    private val surSessionExpiree: (message: String) -> Unit,
) {
    private val etatInterne = MutableStateFlow(EtatSupport())
    val etat: StateFlow<EtatSupport> = etatInterne.asStateFlow()

    init {
        portee.launch {
            when (val r = service.mesTickets()) {
                is Resultat.Succes -> etatInterne.update { it.copy(tickets = r.valeur) }
                // Sans historique, le formulaire reste utilisable.
                is Resultat.Echec -> expiree(r.erreur)
            }
        }
    }

    fun saisirSujet(valeur: String) = etatInterne.update {
        it.copy(sujet = valeur.take(SUJET_MAX + 20), erreurs = it.erreurs - "sujet", information = null)
    }

    fun saisirMessage(valeur: String) = etatInterne.update {
        it.copy(message = valeur.take(MESSAGE_MAX + 100), erreurs = it.erreurs - "message", information = null)
    }

    fun envoyer() {
        val actuel = etatInterne.value
        if (actuel.envoiEnCours) return
        val erreurs = buildMap {
            validerSujet(actuel.sujet)?.let { put("sujet", it) }
            validerMessage(actuel.message)?.let { put("message", it) }
        }
        if (erreurs.isNotEmpty()) {
            etatInterne.update { it.copy(erreurs = erreurs, erreur = null) }
            return
        }
        etatInterne.update { it.copy(envoiEnCours = true, erreur = null, information = null) }
        portee.launch {
            val sujet = actuel.sujet.trim().replace(Regex("\\s+"), " ")
            when (val r = service.envoyerTicket(sujet, actuel.message.trim())) {
                is Resultat.Succes -> etatInterne.update {
                    it.copy(
                        sujet = "",
                        message = "",
                        envoiEnCours = false,
                        information = "Message envoyé. L'équipe Nakayo vous répond par SMS ou sur WhatsApp.",
                        tickets = listOf(r.valeur) + it.tickets.orEmpty(),
                    )
                }
                is Resultat.Echec -> {
                    if (expiree(r.erreur)) return@launch
                    val champs = (r.erreur as? ErreurApi.Http)?.champs.orEmpty()
                    etatInterne.update {
                        it.copy(envoiEnCours = false, erreurs = champs, erreur = if (champs.isEmpty()) MessagesErreur.pour(r.erreur) else null)
                    }
                }
            }
        }
    }

    private fun expiree(erreur: ErreurApi): Boolean {
        if ((erreur as? ErreurApi.Http)?.code != "non_authentifie") return false
        surSessionExpiree(MessagesErreur.pour(erreur))
        return true
    }

    fun retour() {
        if (!etatInterne.value.envoiEnCours) surQuitter(profil)
    }
}
