package bj.nakayo.testeur.ui.apps

import bj.nakayo.noyau.AffectationTesteur
import bj.nakayo.noyau.ErreurApi
import bj.nakayo.noyau.Photo
import bj.nakayo.noyau.Resultat
import bj.nakayo.noyau.ServiceTesteur
import bj.nakayo.testeur.campagne.OutilsApps
import bj.nakayo.testeur.campagne.SOURCE_PLAY_STORE
import bj.nakayo.testeur.ui.MessagesErreur
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

data class EtatApp(
    val affectation: AffectationTesteur,
    val envoiCapture: Boolean = false,
    // US-07 : case « ce Gmail est le compte principal du Play Store » (première campagne).
    val gmailPrincipalConfirme: Boolean = false,
    val verificationInstallation: Boolean = false,
    val information: String? = null,
    val erreur: String? = null,
)

// Une app à tester (US-17, US-18, US-19) : inscription au test, installation, test du jour.
class AppModele(
    private val service: ServiceTesteur,
    private val portee: CoroutineScope,
    affectation: AffectationTesteur,
    private val outils: OutilsApps,
    private val compresser: (File) -> ByteArray,
    private val calcul: CoroutineDispatcher,
    information: String? = null,
    private val surRapport: (AffectationTesteur) -> Unit,
    // US-33 : rapport de bug (offres Pro et Plus).
    private val surBug: (AffectationTesteur) -> Unit = {},
    // US-37 : questionnaire terrain (Offre Plus).
    private val surTerrain: (AffectationTesteur) -> Unit = {},
    private val surQuitter: () -> Unit,
    private val surSessionExpiree: (message: String) -> Unit,
) {
    private val etatInterne = MutableStateFlow(EtatApp(affectation, information = information))
    val etat: StateFlow<EtatApp> = etatInterne.asStateFlow()

    private val id get() = etatInterne.value.affectation.id

    // Relit l'app au retour sur l'écran (après le Play Store, ou le lendemain).
    fun actualiser() {
        portee.launch {
            when (val r = service.mesApps()) {
                is Resultat.Succes -> {
                    val aJour = r.valeur.firstOrNull { it.id == id }
                    if (aJour == null) {
                        etatInterne.update { it.copy(erreur = "Cette app ne fait plus partie de vos tests.") }
                    } else {
                        etatInterne.update { it.copy(affectation = aJour) }
                    }
                }
                // Hors ligne : on garde ce qui est affiché.
                is Resultat.Echec -> expiree(r.erreur)
            }
        }
    }

    fun confirmerGmailPrincipal(valeur: Boolean) = etatInterne.update { it.copy(gmailPrincipalConfirme = valeur, erreur = null) }

    // US-07 : la case doit être cochée avant la capture, à la première campagne.
    fun gmailPrincipalManquant(): Boolean {
        val e = etatInterne.value
        if (!e.affectation.gmailPrincipalAConfirmer || e.gmailPrincipalConfirme) return false
        etatInterne.update { it.copy(erreur = MESSAGE_GMAIL_PRINCIPAL, information = null) }
        return true
    }

    // US-17 : capture de la page « Vous êtes testeur », réduite puis envoyée.
    fun captureChoisie(fichier: File) {
        if (etatInterne.value.envoiCapture) return
        if (gmailPrincipalManquant()) {
            fichier.delete()
            return
        }
        etatInterne.update { it.copy(envoiCapture = true, erreur = null, information = null) }
        portee.launch {
            val octets = try {
                withContext(calcul) { compresser(fichier) }
            } catch (_: Exception) {
                null
            } finally {
                fichier.delete()
            }
            if (octets == null) {
                etatInterne.update { it.copy(envoiCapture = false, erreur = "Image illisible. Choisissez une autre capture d'écran.") }
                return@launch
            }
            when (val r = service.confirmerInscription(id, Photo(octets), gmailPrincipal = etatInterne.value.gmailPrincipalConfirme)) {
                is Resultat.Succes -> etatInterne.update {
                    it.copy(affectation = r.valeur, envoiCapture = false, information = "Inscription confirmée. Installez maintenant l'app depuis le Play Store.")
                }
                is Resultat.Echec -> echec(r.erreur) { copy(envoiCapture = false) }
            }
        }
    }

    fun afficherErreur(message: String) = etatInterne.update { it.copy(erreur = message, information = null) }

    // US-18 : l'app doit être installée depuis le Play Store, pas depuis un APK.
    fun confirmerInstallation() {
        val actuel = etatInterne.value
        if (actuel.verificationInstallation) return
        val installation = outils.installation(actuel.affectation.app.paquet)
        if (installation == null) {
            etatInterne.update {
                it.copy(erreur = "${it.affectation.app.nom} n'est pas encore installée sur ce téléphone. Installez-la depuis le Play Store.", information = null)
            }
            return
        }
        if (installation.source != SOURCE_PLAY_STORE) {
            etatInterne.update { it.copy(erreur = MESSAGE_PAS_PLAY_STORE, information = null) }
            return
        }
        etatInterne.update { it.copy(verificationInstallation = true, erreur = null, information = null) }
        portee.launch {
            when (val r = service.confirmerInstallation(id, installation.source)) {
                is Resultat.Succes -> etatInterne.update {
                    it.copy(affectation = r.valeur, verificationInstallation = false, information = "Installation confirmée. Votre test commence aujourd'hui.")
                }
                is Resultat.Echec -> echec(r.erreur) { copy(verificationInstallation = false) }
            }
        }
    }

    fun ecrireRapport() {
        val a = etatInterne.value.affectation
        if (etape(a) == Etape.Rapport) surRapport(a)
    }

    fun signalerBug() {
        val a = etatInterne.value.affectation
        if (a.rapportsDeBugs && a.installationConfirmee) surBug(a)
    }

    fun repondreTerrain() {
        val a = etatInterne.value.affectation
        if (a.questionnaireTerrain?.ouvert == true) surTerrain(a)
    }

    fun retour() = surQuitter()

    private fun echec(erreur: ErreurApi, remettre: EtatApp.() -> EtatApp) {
        if (expiree(erreur)) return
        etatInterne.update { it.remettre().copy(erreur = messageTest(erreur)) }
        // L'app a changé côté serveur (déjà inscrit, remplacé…) : on relit son état.
        if ((erreur as? ErreurApi.Http)?.statut in setOf(404, 409)) actualiser()
    }

    private fun expiree(erreur: ErreurApi): Boolean {
        if ((erreur as? ErreurApi.Http)?.code != "non_authentifie") return false
        surSessionExpiree(MessagesErreur.pour(erreur))
        return true
    }

    companion object {
        const val MESSAGE_PAS_PLAY_STORE =
            "Cette app n'a pas été installée depuis le Play Store. Désinstallez-la, puis installez-la avec le bouton « Installer depuis le Play Store »."
    }
}

// Erreurs propres au test quotidien (docs/api-sprint3.md §2).
fun messageTest(erreur: ErreurApi): String {
    val http = erreur as? ErreurApi.Http ?: return MessagesErreur.pour(erreur)
    return when {
        http.code == "inscription_requise" -> "Confirmez d'abord votre inscription au test."
        http.code == "installation_requise" -> "Installez l'app depuis le Play Store avant votre premier rapport."
        http.code == "rapport_deja_envoye" -> "Vous avez déjà envoyé le rapport du jour pour cette app."
        http.code == "compte_non_valide" -> "Votre compte testeur n'est pas actif."
        http.code == "fichier_trop_lourd" -> "Capture trop lourde. Choisissez une autre image."
        http.champs["capture"] != null -> "Capture illisible. Choisissez une capture d'écran en JPEG ou PNG."
        http.champs["sourceInstallation"] != null -> AppModele.MESSAGE_PAS_PLAY_STORE
        http.statut == 404 -> "Cette app ne fait plus partie de vos tests."
        else -> MessagesErreur.pour(erreur)
    }
}

const val MESSAGE_GMAIL_PRINCIPAL =
    "Cochez d'abord la case : le Gmail de votre compte Nakayo doit être le compte principal du Play Store de ce téléphone."
