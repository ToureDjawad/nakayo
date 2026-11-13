package bj.nakayo.testeur.ui.apps

import bj.nakayo.noyau.AffectationTesteur
import bj.nakayo.noyau.BugSignale
import bj.nakayo.noyau.ErreurApi
import bj.nakayo.noyau.Photo
import bj.nakayo.noyau.RapportBug
import bj.nakayo.noyau.Resultat
import bj.nakayo.noyau.ServiceTesteur
import bj.nakayo.testeur.campagne.OutilsApps
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

// Bornes du contrat (docs/api-bugs.md §1.1), comptées comme le serveur.
const val CAPTURES_MAX = 5
val LIMITES_BUG = mapOf(
    "titre" to (5 to 120),
    "etapes" to (10 to 2000),
    "resultatAttendu" to (5 to 1000),
    "resultatObtenu" to (5 to 1000),
)
val GRAVITES = listOf("mineure" to "Mineure", "genante" to "Gênante", "bloquante" to "Bloquante")

data class EtatBug(
    val titre: String = "",
    val etapes: String = "",
    val resultatAttendu: String = "",
    val resultatObtenu: String = "",
    val gravite: String? = null,
    val captures: List<Photo> = emptyList(),
    val ajoutCapture: Boolean = false,
    // Bugs déjà signalés sur cette app (null : pas encore chargés).
    val signales: List<BugSignale>? = null,
    val erreurs: Map<String, String> = emptyMap(),
    val envoiEnCours: Boolean = false,
    val information: String? = null,
    val erreur: String? = null,
)

// US-33 : rapport de bug avec captures d'écran (offres Pro et Lancement Afrique).
class BugModele(
    private val service: ServiceTesteur,
    private val portee: CoroutineScope,
    val affectation: AffectationTesteur,
    private val outils: OutilsApps,
    private val compresser: (File) -> ByteArray,
    private val calcul: CoroutineDispatcher,
    private val surQuitter: () -> Unit,
    private val surSessionExpiree: (message: String) -> Unit,
) {
    private val etatInterne = MutableStateFlow(EtatBug())
    val etat: StateFlow<EtatBug> = etatInterne.asStateFlow()

    init {
        chargerSignales()
    }

    private fun chargerSignales() {
        portee.launch {
            when (val r = service.mesBugs(affectation.id)) {
                is Resultat.Succes -> etatInterne.update { it.copy(signales = r.valeur) }
                // Sans la liste, le formulaire reste utilisable.
                is Resultat.Echec -> if (!expiree(r.erreur)) etatInterne.update { it.copy(signales = emptyList()) }
            }
        }
    }

    private fun modifier(champ: String, changement: EtatBug.() -> EtatBug) =
        etatInterne.update { it.changement().copy(erreurs = it.erreurs - champ, erreur = null, information = null) }

    private fun borne(champ: String, v: String) = v.take(LIMITES_BUG.getValue(champ).second + 50)

    fun saisirTitre(v: String) = modifier("titre") { copy(titre = borne("titre", v)) }
    fun saisirEtapes(v: String) = modifier("etapes") { copy(etapes = borne("etapes", v)) }
    fun saisirAttendu(v: String) = modifier("resultatAttendu") { copy(resultatAttendu = borne("resultatAttendu", v)) }
    fun saisirObtenu(v: String) = modifier("resultatObtenu") { copy(resultatObtenu = borne("resultatObtenu", v)) }
    fun choisirGravite(g: String) = modifier("gravite") { copy(gravite = g.takeIf { code -> GRAVITES.any { it.first == code } }) }
    fun retirerCapture(index: Int) = modifier("captures") { copy(captures = captures.filterIndexed { i, _ -> i != index }) }

    // Chaque capture est réduite avant l'envoi, comme celle de l'inscription.
    fun captureChoisie(fichier: File) {
        val e = etatInterne.value
        if (e.ajoutCapture || e.captures.size >= CAPTURES_MAX) {
            fichier.delete()
            return
        }
        etatInterne.update { it.copy(ajoutCapture = true, erreur = null, information = null, erreurs = it.erreurs - "captures") }
        portee.launch {
            val octets = try {
                withContext(calcul) { compresser(fichier) }
            } catch (_: Exception) {
                null
            } finally {
                fichier.delete()
            }
            etatInterne.update {
                if (octets == null) it.copy(ajoutCapture = false, erreur = "Image illisible. Choisissez une autre capture d'écran.")
                else it.copy(ajoutCapture = false, captures = (it.captures + Photo(octets)).take(CAPTURES_MAX))
            }
        }
    }

    fun afficherErreur(message: String) = etatInterne.update { it.copy(erreur = message, information = null) }

    fun valider(e: EtatBug): Map<String, String> = buildMap {
        LIMITES_BUG.forEach { (champ, bornes) ->
            val valeur = when (champ) {
                "titre" -> e.titre
                "etapes" -> e.etapes
                "resultatAttendu" -> e.resultatAttendu
                else -> e.resultatObtenu
            }
            validerLongueur(valeur, bornes.first, bornes.second)?.let { put(champ, it) }
        }
        if (e.gravite == null) put("gravite", "requis")
    }

    // La version de l'app testée est lue sur le téléphone au moment de l'envoi.
    fun envoyer() {
        val e = etatInterne.value
        if (e.envoiEnCours || e.ajoutCapture) return
        val erreurs = valider(e)
        if (erreurs.isNotEmpty()) {
            etatInterne.update { it.copy(erreurs = erreurs, erreur = "Certaines réponses sont à compléter.", information = null) }
            return
        }
        val version = outils.installation(affectation.app.paquet)?.version?.take(50)?.ifBlank { null } ?: "inconnue"
        etatInterne.update { it.copy(envoiEnCours = true, erreur = null, information = null) }
        portee.launch {
            val bug = RapportBug(e.titre.trim(), e.etapes.trim(), e.resultatAttendu.trim(), e.resultatObtenu.trim(), e.gravite!!, version)
            when (val r = service.envoyerBug(affectation.id, bug, e.captures)) {
                // Formulaire vidé pour un autre bug ; le nouveau apparaît en tête de liste.
                is Resultat.Succes -> etatInterne.update {
                    EtatBug(
                        signales = listOf(r.valeur) + it.signales.orEmpty(),
                        information = "Bug envoyé. Le développeur va l'examiner : s'il l'accepte, vous gagnez 200 FCFA de plus.",
                    )
                }
                is Resultat.Echec -> {
                    if (expiree(r.erreur)) return@launch
                    val http = r.erreur as? ErreurApi.Http
                    val champs = http?.champs.orEmpty() - "versionApp"
                    etatInterne.update {
                        it.copy(
                            envoiEnCours = false,
                            erreurs = champs,
                            erreur = when {
                                champs.isNotEmpty() -> "Certaines réponses sont à compléter."
                                http?.code == "offre_sans_rapports_de_bugs" -> "Cette app ne prend pas de rapports de bugs."
                                http?.code == "fichier_trop_lourd" -> "Une capture est trop lourde. Retirez-la et choisissez une autre image."
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

    private fun expiree(erreur: ErreurApi): Boolean {
        if ((erreur as? ErreurApi.Http)?.code != "non_authentifie") return false
        surSessionExpiree(MessagesErreur.pour(erreur))
        return true
    }
}
