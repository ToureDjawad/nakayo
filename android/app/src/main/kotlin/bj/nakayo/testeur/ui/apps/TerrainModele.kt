package bj.nakayo.testeur.ui.apps

import bj.nakayo.noyau.AffectationTesteur
import bj.nakayo.noyau.ErreurApi
import bj.nakayo.noyau.Resultat
import bj.nakayo.noyau.RetourTerrain
import bj.nakayo.noyau.ServiceTesteur
import bj.nakayo.testeur.ui.MessagesErreur
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

// Choix du questionnaire terrain (docs/api-offres.md §4.5), avec leur libellé.
val CONNEXIONS = listOf("wifi" to "Wi-Fi", "4g" to "4G", "3g" to "3G", "2g" to "2G")
val TENUES = listOf("fluide" to "Fluide", "lent" to "Lent", "inutilisable" to "Bloqué")
val LANGUES_TERRAIN = listOf("fr" to "Français", "en" to "Anglais")
val NOTES_COMPREHENSION = (1..5).map { it.toString() to it.toString() }
val COMMENTAIRE_TERRAIN = 10 to 1000

data class EtatTerrain(
    val connexion: String? = null,
    val reseau: String? = null,
    val telephone: String? = null,
    val langue: String? = null,
    val comprehension: Int? = null,
    val commentaire: String = "",
    val erreurs: Map<String, String> = emptyMap(),
    val envoiEnCours: Boolean = false,
    val erreur: String? = null,
)

// US-37 : questionnaire terrain de l'Offre Plus, une fois par app à partir du 7e jour.
class TerrainModele(
    private val service: ServiceTesteur,
    private val portee: CoroutineScope,
    val affectation: AffectationTesteur,
    private val surEnvoye: (AffectationTesteur) -> Unit,
    private val surQuitter: () -> Unit,
    private val surSessionExpiree: (message: String) -> Unit,
) {
    private val etatInterne = MutableStateFlow(EtatTerrain())
    val etat: StateFlow<EtatTerrain> = etatInterne.asStateFlow()

    private fun modifier(champ: String, changement: EtatTerrain.() -> EtatTerrain) =
        etatInterne.update { it.changement().copy(erreurs = it.erreurs - champ, erreur = null) }

    private fun connu(code: String, choix: List<Pair<String, String>>) = code.takeIf { c -> choix.any { it.first == c } }

    fun choisirConnexion(c: String) = modifier("connexion") { copy(connexion = connu(c, CONNEXIONS)) }
    fun choisirReseau(c: String) = modifier("reseau") { copy(reseau = connu(c, TENUES)) }
    fun choisirTelephone(c: String) = modifier("telephone") { copy(telephone = connu(c, TENUES)) }
    fun choisirLangue(c: String) = modifier("langue") { copy(langue = connu(c, LANGUES_TERRAIN)) }
    fun choisirComprehension(n: Int) = modifier("comprehension") { copy(comprehension = n.takeIf { it in 1..5 }) }
    fun saisirCommentaire(v: String) = modifier("commentaire") { copy(commentaire = v.take(COMMENTAIRE_TERRAIN.second + 50)) }

    fun valider(e: EtatTerrain): Map<String, String> = buildMap {
        if (e.connexion == null) put("connexion", "requis")
        if (e.reseau == null) put("reseau", "requis")
        if (e.telephone == null) put("telephone", "requis")
        if (e.langue == null) put("langue", "requis")
        if (e.comprehension == null) put("comprehension", "requis")
        // Le commentaire est facultatif, mais un commentaire écrit doit être utile.
        if (e.commentaire.isNotBlank()) validerLongueur(e.commentaire, COMMENTAIRE_TERRAIN.first, COMMENTAIRE_TERRAIN.second)?.let { put("commentaire", it) }
    }

    fun envoyer() {
        val e = etatInterne.value
        if (e.envoiEnCours) return
        val erreurs = valider(e)
        if (erreurs.isNotEmpty()) {
            etatInterne.update { it.copy(erreurs = erreurs, erreur = "Certaines réponses sont à compléter.") }
            return
        }
        etatInterne.update { it.copy(envoiEnCours = true, erreur = null) }
        portee.launch {
            val retour = RetourTerrain(e.connexion!!, e.reseau!!, e.telephone!!, e.langue!!, e.comprehension!!, e.commentaire.trim().ifBlank { null })
            when (val r = service.envoyerRetourTerrain(affectation.id, retour)) {
                is Resultat.Succes -> surEnvoye(r.valeur)
                is Resultat.Echec -> {
                    val http = r.erreur as? ErreurApi.Http
                    if (http?.code == "non_authentifie") {
                        surSessionExpiree(MessagesErreur.pour(r.erreur))
                        return@launch
                    }
                    val champs = http?.champs.orEmpty()
                    etatInterne.update {
                        it.copy(
                            envoiEnCours = false,
                            erreurs = champs,
                            erreur = when {
                                champs.isNotEmpty() -> "Certaines réponses sont à compléter."
                                http?.code == "deja_envoye" -> "Vous avez déjà répondu au questionnaire pour cette app."
                                http?.code == "trop_tot" -> "Le questionnaire s'ouvre au jour ${affectation.questionnaireTerrain?.ouvertLe ?: 7}."
                                http?.code == "campagne_terminee" -> "La campagne de test est terminée."
                                else -> messageTest(r.erreur)
                            },
                        )
                    }
                }
            }
        }
    }

    fun retour() {
        if (!etatInterne.value.envoiEnCours) surQuitter()
    }
}
