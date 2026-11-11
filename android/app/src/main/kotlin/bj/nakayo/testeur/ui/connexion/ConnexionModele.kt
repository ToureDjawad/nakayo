package bj.nakayo.testeur.ui.connexion

import bj.nakayo.noyau.Appareil
import bj.nakayo.noyau.CodeSms
import bj.nakayo.noyau.ErreurApi
import bj.nakayo.noyau.ProfilTesteur
import bj.nakayo.noyau.Resultat
import bj.nakayo.noyau.ResultatVerification
import bj.nakayo.noyau.ServiceTesteur
import bj.nakayo.noyau.Telephone
import bj.nakayo.testeur.ui.MessagesChamps
import bj.nakayo.testeur.ui.MessagesErreur
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class EtapeConnexion { Telephone, Code }

// « Créer mon compte » (étape 1 de l'inscription, avec l'opérateur) ou « J'ai déjà un compte ».
enum class ModeConnexion { Creation, Connexion }

val OPERATEURS = listOf("mtn" to "MTN MoMo", "moov" to "Moov Money")

data class EtatConnexion(
    val mode: ModeConnexion = ModeConnexion.Connexion,
    val etape: EtapeConnexion = EtapeConnexion.Telephone,
    // Opérateur Mobile Money choisi à la création du compte (le numéro sert aussi au paiement).
    val operateur: String? = null,
    val erreurOperateur: String? = null,
    val telephone: String = "",
    val erreurTelephone: String? = null,
    // Numéro au format E.164, retenu après l'envoi du code.
    val telephoneNormalise: String = "",
    val code: String = "",
    val erreurCode: String? = null,
    // Erreur générale (réseau, limite atteinte...), affichée dans un bandeau.
    val message: String? = null,
    val enCours: Boolean = false,
    // Secondes avant de pouvoir redemander un code.
    val renvoiDans: Int = 0,
)

// Connexion et début d'inscription d'un testeur par code SMS (contrat §4.1 et §4.2).
class ConnexionModele(
    private val service: ServiceTesteur,
    private val appareil: suspend () -> Appareil,
    private val portee: CoroutineScope,
    private val surConnecte: (ProfilTesteur) -> Unit,
    private val surInscription: (telephone: String, jetonInscription: String, operateur: String?) -> Unit,
    mode: ModeConnexion = ModeConnexion.Connexion,
    // Message affiché à l'arrivée (par exemple après l'expiration du délai d'inscription).
    message: String? = null,
) {
    private val etatInterne = MutableStateFlow(EtatConnexion(mode = mode, message = message))
    val etat: StateFlow<EtatConnexion> = etatInterne.asStateFlow()
    private var compteARebours: Job? = null

    fun saisirTelephone(valeur: String) = etatInterne.update {
        it.copy(telephone = valeur.filter { c -> c.isDigit() || c == '+' || c == ' ' }.take(20), erreurTelephone = null, message = null)
    }

    fun choisirOperateur(code: String) = etatInterne.update { it.copy(operateur = code, erreurOperateur = null) }

    fun saisirCode(valeur: String) = etatInterne.update {
        it.copy(code = valeur.filter(Char::isDigit).take(6), erreurCode = null, message = null)
    }

    fun envoyerCode() {
        val actuel = etatInterne.value
        if (actuel.enCours) return
        val normalise = Telephone.normaliser(actuel.telephone)
        val erreurTelephone = Telephone.valider(normalise)?.let(MessagesChamps::telephone)
        val erreurOperateur = if (actuel.mode == ModeConnexion.Creation && actuel.operateur == null) MessagesChamps.operateur("requis") else null
        if (erreurTelephone != null || erreurOperateur != null) {
            etatInterne.update { it.copy(erreurTelephone = erreurTelephone, erreurOperateur = erreurOperateur) }
            return
        }
        demanderCode(normalise)
    }

    fun renvoyerCode() {
        val actuel = etatInterne.value
        if (actuel.enCours || actuel.renvoiDans > 0) return
        demanderCode(actuel.telephoneNormalise)
    }

    private fun demanderCode(telephone: String) {
        etatInterne.update { it.copy(enCours = true, message = null) }
        portee.launch {
            when (val r = service.envoyerCode(telephone)) {
                is Resultat.Succes -> {
                    etatInterne.update {
                        it.copy(enCours = false, etape = EtapeConnexion.Code, telephoneNormalise = telephone, code = "", erreurCode = null)
                    }
                    lancerCompteARebours(r.valeur.renvoiPossibleDans)
                }
                is Resultat.Echec -> {
                    val erreur = r.erreur
                    val champ = (erreur as? ErreurApi.Http)?.champs?.get("telephone")
                    etatInterne.update {
                        it.copy(
                            enCours = false,
                            erreurTelephone = champ?.let(MessagesChamps::telephone),
                            message = if (champ == null) MessagesErreur.pour(erreur) else null,
                        )
                    }
                    (erreur as? ErreurApi.Http)?.reessayerDans?.let { if (etatInterne.value.etape == EtapeConnexion.Code) lancerCompteARebours(it) }
                }
            }
        }
    }

    fun verifierCode() {
        val actuel = etatInterne.value
        if (actuel.enCours) return
        CodeSms.valider(actuel.code)?.let { code ->
            etatInterne.update { it.copy(erreurCode = MessagesChamps.codeSms(code)) }
            return
        }
        etatInterne.update { it.copy(enCours = true, message = null) }
        portee.launch {
            val r = service.verifierCode(actuel.telephoneNormalise, actuel.code, appareil())
            when (r) {
                is Resultat.Succes -> {
                    etatInterne.update { it.copy(enCours = false) }
                    when (val v = r.valeur) {
                        is ResultatVerification.Connecte -> surConnecte(v.utilisateur)
                        is ResultatVerification.Inscription -> surInscription(actuel.telephoneNormalise, v.jetonInscription, actuel.operateur)
                    }
                }
                is Resultat.Echec -> {
                    val erreur = r.erreur
                    val http = erreur as? ErreurApi.Http
                    etatInterne.update {
                        when (http?.code) {
                            "code_invalide" -> it.copy(enCours = false, code = "", erreurCode = MessagesErreur.pour(erreur))
                            "validation" -> it.copy(
                                enCours = false,
                                erreurCode = http.champs["code"]?.let(MessagesChamps::codeSms),
                                message = if (http.champs["code"] == null) MessagesErreur.pour(erreur) else null,
                            )
                            else -> it.copy(enCours = false, code = "", message = MessagesErreur.pour(erreur))
                        }
                    }
                }
            }
        }
    }

    fun modifierNumero() {
        compteARebours?.cancel()
        etatInterne.update { it.copy(etape = EtapeConnexion.Telephone, code = "", erreurCode = null, message = null, renvoiDans = 0) }
    }

    private fun lancerCompteARebours(secondes: Int) {
        compteARebours?.cancel()
        compteARebours = portee.launch {
            var restant = secondes
            while (restant > 0) {
                etatInterne.update { it.copy(renvoiDans = restant) }
                delay(1_000)
                restant--
            }
            etatInterne.update { it.copy(renvoiDans = 0) }
        }
    }
}
