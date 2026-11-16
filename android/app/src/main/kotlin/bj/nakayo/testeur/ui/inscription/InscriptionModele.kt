package bj.nakayo.testeur.ui.inscription

import bj.nakayo.noyau.Appareil
import bj.nakayo.noyau.ErreurApi
import bj.nakayo.noyau.FormulaireInscription
import bj.nakayo.noyau.Photo
import bj.nakayo.noyau.ProfilTesteur
import bj.nakayo.noyau.Resultat
import bj.nakayo.noyau.ServiceTesteur
import bj.nakayo.testeur.ui.MessagesChamps
import bj.nakayo.testeur.ui.MessagesErreur
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

// Actions de l'écran, regroupées pour garder des signatures lisibles.
interface ActionsInscription {
    fun retour()
    fun saisirNom(valeur: String)
    fun choisirVille(valeur: String)
    fun saisirVilleLibre(valeur: String)
    fun saisirGmail(valeur: String)
    fun saisirCodeParrainage(valeur: String)
    fun choisirOperateur(code: String)
    fun basculerLangue(code: String)
    fun continuer()
    fun photoPrise(champ: ChampPhoto, fichier: File)
    fun photoImpossible(message: String)
    fun accepterConditions(valeur: Boolean)
    fun consentirSuivi(valeur: Boolean)
    fun envoyer()
}

enum class EtapeInscription { Profil, Pieces }

enum class ChampPhoto(val cle: String) { PieceIdentite("pieceIdentite"), Selfie("selfie") }

// Langues du contrat (§4.4) : les testeurs suivent les apps en français ou en anglais.
val LANGUES = listOf(
    "fr" to "Français",
    "en" to "Anglais",
)

// Principales villes du Bénin ; « Autre ville » ouvre un champ libre.
val VILLES = listOf(
    "Cotonou", "Abomey-Calavi", "Porto-Novo", "Parakou", "Sèmè-Podji", "Bohicon", "Djougou", "Natitingou",
    "Ouidah", "Lokossa", "Abomey", "Kandi", "Allada", "Savalou", "Dassa-Zoumè", "Pobè", "Malanville", "Nikki", "Comè", "Aplahoué",
)
const val AUTRE_VILLE = "Autre ville"

data class EtatInscription(
    val etape: EtapeInscription = EtapeInscription.Profil,
    val nom: String = "",
    // Ville de la liste, ou AUTRE_VILLE avec `villeLibre`.
    val ville: String = "",
    val villeLibre: String = "",
    val gmail: String = "",
    // US-39 : code du parrain, facultatif.
    val codeParrainage: String = "",
    val langues: Set<String> = setOf("fr"),
    val operateur: String? = null,
    val appareil: Appareil? = null,
    val pieceIdentite: Photo? = null,
    val selfie: Photo? = null,
    // Photo en cours de compression.
    val photoEnPreparation: ChampPhoto? = null,
    // Cases jamais précochées.
    val accepteConditions: Boolean = false,
    val consentementSuivi: Boolean = false,
    // Erreurs par champ, avec les clés du contrat (nom, ville, gmail, operateurMomo, pieceIdentite...).
    val erreurs: Map<String, String> = emptyMap(),
    val message: String? = null,
    val enCours: Boolean = false,
) {
    val villeChoisie: String get() = if (ville == AUTRE_VILLE) villeLibre.trim() else ville
}

// Inscription d'un testeur après le code SMS (contrat §4.3), en deux écrans : profil puis pièces.
class InscriptionModele(
    private val service: ServiceTesteur,
    private val appareil: suspend () -> Appareil,
    private val portee: CoroutineScope,
    val telephone: String,
    private val jetonInscription: String,
    operateur: String?,
    private val surInscrit: (ProfilTesteur) -> Unit,
    // Jeton d'inscription expiré (30 min) : retour à l'étape du numéro.
    private val surJetonExpire: (message: String) -> Unit,
    // Retour depuis le premier écran du formulaire.
    private val surQuitter: () -> Unit,
    private val compresser: (File) -> ByteArray,
    private val calcul: CoroutineDispatcher = Dispatchers.Default,
) : ActionsInscription {
    private val etatInterne = MutableStateFlow(EtatInscription(operateur = operateur))
    // L'opérateur a-t-il déjà été choisi à l'étape du numéro ? Sinon il est demandé sur le profil.
    val operateurDejaChoisi = operateur != null
    val etat: StateFlow<EtatInscription> = etatInterne.asStateFlow()

    init {
        portee.launch {
            val a = appareil()
            etatInterne.update { it.copy(appareil = a) }
        }
    }

    private fun modifier(cle: String, transformer: (EtatInscription) -> EtatInscription) =
        etatInterne.update { transformer(it).copy(erreurs = it.erreurs - cle, message = null) }

    override fun saisirNom(valeur: String) = modifier("nom") { it.copy(nom = valeur.take(60)) }
    override fun choisirVille(valeur: String) = modifier("ville") { it.copy(ville = valeur) }
    override fun saisirVilleLibre(valeur: String) = modifier("ville") { it.copy(villeLibre = valeur.take(60)) }
    override fun saisirGmail(valeur: String) = modifier("gmail") { it.copy(gmail = valeur.trim().lowercase().take(254)) }
    override fun saisirCodeParrainage(valeur: String) = modifier("codeParrainage") {
        it.copy(codeParrainage = valeur.uppercase().filter { c -> c.isLetterOrDigit() }.take(6))
    }
    override fun choisirOperateur(code: String) = modifier("operateurMomo") { it.copy(operateur = code) }
    override fun basculerLangue(code: String) = modifier("langues") {
        it.copy(langues = if (code in it.langues) it.langues - code else it.langues + code)
    }
    override fun accepterConditions(valeur: Boolean) = modifier("accepteConditions") { it.copy(accepteConditions = valeur) }
    override fun consentirSuivi(valeur: Boolean) = modifier("consentementSuivi") { it.copy(consentementSuivi = valeur) }

    // Mêmes règles que le serveur, pour répondre tout de suite sans réseau.
    private fun erreursProfil(e: EtatInscription): Map<String, String> = buildMap {
        val nom = e.nom.trim()
        when {
            nom.isEmpty() -> put("nom", "requis")
            nom.length < 2 -> put("nom", "trop_court")
        }
        val ville = e.villeChoisie
        when {
            ville.isEmpty() -> put("ville", "requis")
            ville.length < 2 -> put("ville", "trop_court")
        }
        when {
            e.gmail.isEmpty() -> put("gmail", "requis")
            !Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$").matches(e.gmail) -> put("gmail", "format_invalide")
            !e.gmail.endsWith("@gmail.com") -> put("gmail", "non_gmail")
            !Regex("^[a-z0-9.+]+@gmail\\.com$").matches(e.gmail) -> put("gmail", "format_invalide")
        }
        if (e.codeParrainage.isNotEmpty() && !FORMAT_CODE_PARRAINAGE.matches(e.codeParrainage)) put("codeParrainage", "format_invalide")
        if (e.operateur == null) put("operateurMomo", "requis")
        if (e.langues.isEmpty()) put("langues", "requis")
    }

    override fun continuer() {
        val erreurs = erreursProfil(etatInterne.value)
        etatInterne.update { if (erreurs.isEmpty()) it.copy(etape = EtapeInscription.Pieces, erreurs = emptyMap()) else it.copy(erreurs = erreurs) }
    }

    // Retour : des pièces vers le profil, du profil vers l'écran précédent. Rien pendant l'envoi.
    override fun retour() {
        val actuel = etatInterne.value
        when {
            actuel.enCours -> Unit
            actuel.etape == EtapeInscription.Pieces -> etatInterne.update { it.copy(etape = EtapeInscription.Profil, message = null) }
            else -> surQuitter()
        }
    }

    // Photo prise par l'appareil photo : réduite (300 Ko environ, sans métadonnées) puis gardée en mémoire.
    override fun photoPrise(champ: ChampPhoto, fichier: File) {
        etatInterne.update { it.copy(photoEnPreparation = champ, erreurs = it.erreurs - champ.cle, message = null) }
        portee.launch {
            val octets = try {
                withContext(calcul) { compresser(fichier) }
            } catch (e: Exception) {
                if (e is CancellationException) throw e
                null
            } finally {
                withContext(calcul) { fichier.delete() }
            }
            etatInterne.update {
                when {
                    octets == null -> it.copy(photoEnPreparation = null, erreurs = it.erreurs + (champ.cle to "illisible"))
                    champ == ChampPhoto.PieceIdentite -> it.copy(photoEnPreparation = null, pieceIdentite = Photo(octets))
                    else -> it.copy(photoEnPreparation = null, selfie = Photo(octets))
                }
            }
        }
    }

    override fun photoImpossible(message: String) = etatInterne.update { it.copy(message = message) }

    override fun envoyer() {
        val e = etatInterne.value
        if (e.enCours || e.photoEnPreparation != null) return
        val erreurs = buildMap {
            if (e.pieceIdentite == null) put(ChampPhoto.PieceIdentite.cle, "requis")
            if (e.selfie == null) put(ChampPhoto.Selfie.cle, "requis")
            if (!e.accepteConditions) put("accepteConditions", "doit_etre_accepte")
            if (!e.consentementSuivi) put("consentementSuivi", "doit_etre_accepte")
        }
        if (erreurs.isNotEmpty()) {
            etatInterne.update { it.copy(erreurs = erreurs) }
            return
        }
        etatInterne.update { it.copy(enCours = true, message = null) }
        portee.launch {
            val formulaire = FormulaireInscription(
                nom = e.nom.trim(),
                ville = e.villeChoisie,
                gmail = e.gmail,
                numeroMomo = telephone,
                operateurMomo = e.operateur!!,
                appareil = e.appareil ?: appareil(),
                consentementSuivi = true,
                accepteConditions = true,
                codeParrainage = e.codeParrainage.ifEmpty { null },
            )
            when (val r = service.inscrire(jetonInscription, formulaire, e.pieceIdentite!!, e.selfie!!)) {
                is Resultat.Succes -> {
                    // Les langues ne font pas partie du formulaire d'inscription : enregistrées juste après.
                    // En cas d'échec, le testeur peut les corriger dans son profil.
                    val profil = when (val l = service.modifierProfil(langues = LANGUES.map { it.first }.filter { it in e.langues })) {
                        is Resultat.Succes -> l.valeur
                        is Resultat.Echec -> r.valeur
                    }
                    surInscrit(profil)
                }
                is Resultat.Echec -> echec(r.erreur)
            }
        }
    }

    private fun echec(erreur: ErreurApi) {
        val http = erreur as? ErreurApi.Http
        if (http?.code == "non_authentifie") {
            surJetonExpire("Le délai de 30 minutes pour finir l'inscription est dépassé. Recevez un nouveau code pour reprendre.")
            return
        }
        val champs = http?.champs.orEmpty()
        val surProfil = champs.keys.any { it in setOf("nom", "ville", "gmail", "operateurMomo", "codeParrainage") }
        etatInterne.update {
            it.copy(
                enCours = false,
                etape = if (surProfil) EtapeInscription.Profil else it.etape,
                erreurs = champs,
                // Un champ sans place à l'écran (numéro MoMo déjà pris, appareil...) passe dans le bandeau.
                message = when {
                    "numeroMomo" in champs -> MessagesChamps.numeroMomo(champs.getValue("numeroMomo"))
                    champs.isEmpty() || champs.keys.none { k -> k in CHAMPS_AFFICHES } -> MessagesErreur.pour(erreur)
                    else -> null
                },
            )
        }
    }

    private companion object {
        // Mêmes caractères que le serveur : sans 0, O, 1, I ni L.
        val FORMAT_CODE_PARRAINAGE = Regex("^[A-HJKMNP-Z2-9]{6}$")
        val CHAMPS_AFFICHES = setOf("nom", "ville", "gmail", "operateurMomo", "codeParrainage", "langues", "pieceIdentite", "selfie", "accepteConditions", "consentementSuivi")
    }
}
