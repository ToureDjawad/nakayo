package bj.nakayo.testeur.ui.apps

import bj.nakayo.noyau.AffectationTesteur
import bj.nakayo.noyau.ErreurApi
import bj.nakayo.noyau.RapportJour
import bj.nakayo.noyau.Resultat
import bj.nakayo.noyau.ServiceTesteur
import bj.nakayo.testeur.campagne.OutilsApps
import bj.nakayo.testeur.ui.MessagesErreur
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

// Longueurs du contrat (§2.4), comptées comme le serveur.
const val ACTIONS_MIN = 10
const val ACTIONS_MAX = 500
const val COMMENTAIRE_MIN = 10
const val COMMENTAIRE_MAX = 1000
const val RETOUR_MIN = 100
const val RETOUR_MAX = 2000

data class EtatRapport(
    val actions: String = "",
    val note: Int? = null,
    val bug: Boolean? = null,
    val commentaireBug: String = "",
    val fonctionnalites: Set<String> = emptySet(),
    val retourDetaille: String = "",
    // Codes d'erreur par champ (« requis », « trop_court », « trop_long »...).
    val erreurs: Map<String, String> = emptyMap(),
    val envoiEnCours: Boolean = false,
    val erreur: String? = null,
)

fun validerLongueur(texte: String, min: Int, max: Int): String? {
    val t = texte.trim()
    return when {
        t.isEmpty() -> "requis"
        t.length < min -> "trop_court"
        t.length > max -> "trop_long"
        else -> null
    }
}

// Rapport du jour d'une app (US-19).
class RapportModele(
    private val service: ServiceTesteur,
    private val portee: CoroutineScope,
    val affectation: AffectationTesteur,
    private val outils: OutilsApps,
    private val surEnvoye: (AffectationTesteur) -> Unit,
    private val surQuitter: () -> Unit,
    private val surSessionExpiree: (message: String) -> Unit,
) {
    private val etatInterne = MutableStateFlow(EtatRapport())
    val etat: StateFlow<EtatRapport> = etatInterne.asStateFlow()

    private fun modifier(champ: String, changement: EtatRapport.() -> EtatRapport) =
        etatInterne.update { it.changement().copy(erreurs = it.erreurs - champ, erreur = null) }

    fun saisirActions(v: String) = modifier("actions") { copy(actions = v.take(ACTIONS_MAX + 50)) }
    fun choisirNote(n: Int) = modifier("note") { copy(note = n.coerceIn(1, 5)) }
    fun choisirBug(b: Boolean) = modifier("bug") { copy(bug = b) }
    fun saisirCommentaire(v: String) = modifier("commentaireBug") { copy(commentaireBug = v.take(COMMENTAIRE_MAX + 50)) }
    fun saisirRetour(v: String) = modifier("retourDetaille") { copy(retourDetaille = v.take(RETOUR_MAX + 100)) }
    fun basculerFonctionnalite(f: String) = modifier("fonctionnalites") {
        copy(fonctionnalites = if (f in fonctionnalites) fonctionnalites - f else fonctionnalites + f)
    }

    fun valider(e: EtatRapport): Map<String, String> = buildMap {
        validerLongueur(e.actions, ACTIONS_MIN, ACTIONS_MAX)?.let { put("actions", it) }
        if (e.note == null) put("note", "requis")
        if (e.bug == null) put("bug", "requis")
        if (e.bug == true) validerLongueur(e.commentaireBug, COMMENTAIRE_MIN, COMMENTAIRE_MAX)?.let { put("commentaireBug", it) }
        if (e.fonctionnalites.isEmpty()) put("fonctionnalites", "requis")
        if (affectation.retourDetailleAttendu) validerLongueur(e.retourDetaille, RETOUR_MIN, RETOUR_MAX)?.let { put("retourDetaille", it) }
    }

    // La version et la position sont lues sur le téléphone au moment de l'envoi.
    fun envoyer() {
        val e = etatInterne.value
        if (e.envoiEnCours) return
        val erreurs = valider(e)
        if (erreurs.isNotEmpty()) {
            etatInterne.update { it.copy(erreurs = erreurs, erreur = "Certaines réponses sont à compléter.") }
            return
        }
        val installation = outils.installation(affectation.app.paquet)
        if (installation == null) {
            etatInterne.update { it.copy(erreur = "${affectation.app.nom} n'est plus installée sur ce téléphone. Réinstallez-la depuis le Play Store.") }
            return
        }
        etatInterne.update { it.copy(envoiEnCours = true, erreur = null) }
        portee.launch {
            val position = outils.position()
            if (position == null) {
                etatInterne.update {
                    it.copy(
                        envoiEnCours = false,
                        erreur = "Nous n'avons pas pu lire votre position. Autorisez la localisation pour Nakayo et activez-la sur le téléphone, puis réessayez.",
                    )
                }
                return@launch
            }
            val rapport = RapportJour(
                actions = e.actions.trim(),
                note = e.note!!,
                bug = e.bug!!,
                commentaireBug = if (e.bug) e.commentaireBug.trim() else null,
                // Dans l'ordre de la liste du développeur.
                fonctionnalites = affectation.app.fonctionnalites.filter { it in e.fonctionnalites },
                versionApp = installation.version?.take(50)?.ifBlank { null } ?: "inconnue",
                position = position,
                retourDetaille = e.retourDetaille.trim().ifEmpty { null },
                wifi = outils.surWifi(),
            )
            when (val r = service.envoyerRapport(affectation.id, rapport)) {
                is Resultat.Succes -> surEnvoye(r.valeur)
                is Resultat.Echec -> {
                    val http = r.erreur as? ErreurApi.Http
                    if (http?.code == "non_authentifie") return@launch surSessionExpiree(MessagesErreur.pour(r.erreur))
                    val champs = http?.champs.orEmpty() - "position" - "versionApp"
                    etatInterne.update {
                        it.copy(
                            envoiEnCours = false,
                            erreurs = champs,
                            erreur = if (champs.isEmpty()) messageTest(r.erreur) else "Certaines réponses sont à compléter.",
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
