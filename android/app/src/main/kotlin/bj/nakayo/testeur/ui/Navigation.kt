package bj.nakayo.testeur.ui

import bj.nakayo.noyau.Appareil
import bj.nakayo.noyau.ProfilTesteur
import bj.nakayo.noyau.ServiceTesteur
import bj.nakayo.testeur.ui.accueil.AccueilModele
import bj.nakayo.testeur.ui.connexion.ConnexionModele
import bj.nakayo.testeur.ui.connexion.EtapeConnexion
import bj.nakayo.testeur.ui.connexion.ModeConnexion
import bj.nakayo.testeur.ui.espace.EspaceModele
import bj.nakayo.testeur.ui.inscription.InscriptionModele
import bj.nakayo.testeur.ui.profil.ProfilModele
import bj.nakayo.testeur.ui.support.SupportModele
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.io.File

sealed interface Ecran {
    data object Demarrage : Ecran
    data class Accueil(val modele: AccueilModele) : Ecran
    data class Connexion(val modele: ConnexionModele) : Ecran
    data class Inscription(val modele: InscriptionModele) : Ecran
    data class Espace(val modele: EspaceModele) : Ecran
    data class Profil(val modele: ProfilModele) : Ecran
    data class Support(val modele: SupportModele) : Ecran
}

// Parcours de l'app. Chaque écran a sa portée, annulée quand on le quitte.
class Navigation(
    private val service: ServiceTesteur,
    private val appareil: suspend () -> Appareil,
    private val portee: CoroutineScope,
    // Réduction des photos de l'inscription (Android) ; remplacée dans les tests.
    private val compresser: (File) -> ByteArray,
    private val calcul: CoroutineDispatcher = Dispatchers.Default,
) {
    private val ecranInterne = MutableStateFlow<Ecran>(Ecran.Demarrage)
    val ecran: StateFlow<Ecran> = ecranInterne.asStateFlow()
    private var porteeEcran: CoroutineScope? = null

    init {
        portee.launch {
            if (service.sessionOuverte()) allerEspace(null) else allerAccueil(null)
        }
    }

    fun allerAccueil(information: String?): Unit = changer { AccueilModele(service::sante, it, information).let(Ecran::Accueil) }

    fun allerConnexion(mode: ModeConnexion, message: String? = null): Unit = changer {
        Ecran.Connexion(
            ConnexionModele(
                service = service,
                appareil = appareil,
                portee = it,
                surConnecte = { profil -> allerEspace(profil) },
                surInscription = { telephone, jeton, operateur -> allerInscription(telephone, jeton, operateur, mode) },
                mode = mode,
                message = message,
            ),
        )
    }

    fun allerInscription(telephone: String, jetonInscription: String, operateur: String?, mode: ModeConnexion = ModeConnexion.Creation): Unit = changer {
        Ecran.Inscription(
            InscriptionModele(
                service = service,
                appareil = appareil,
                portee = it,
                telephone = telephone,
                jetonInscription = jetonInscription,
                operateur = operateur,
                surInscrit = { profil -> allerEspace(profil) },
                surJetonExpire = { message -> allerConnexion(mode, message) },
                surQuitter = { allerConnexion(mode) },
                compresser = compresser,
                calcul = calcul,
            ),
        )
    }

    fun allerEspace(profil: ProfilTesteur?): Unit = changer {
        Ecran.Espace(EspaceModele(service, it, profil, appareil, surSortie = { message -> allerAccueil(message) }))
    }

    fun allerProfil(profil: ProfilTesteur): Unit = changer {
        Ecran.Profil(
            ProfilModele(
                service = service,
                portee = it,
                profil = profil,
                surQuitter = { aJour -> allerEspace(aJour) },
                surSessionExpiree = { message -> allerAccueil(message) },
            ),
        )
    }

    fun allerSupport(profil: ProfilTesteur?): Unit = changer {
        Ecran.Support(
            SupportModele(
                service = service,
                portee = it,
                profil = profil,
                surQuitter = { connu -> allerEspace(connu) },
                surSessionExpiree = { message -> allerAccueil(message) },
            ),
        )
    }

    // Bouton retour du téléphone. Renvoie false quand l'app doit se fermer.
    fun retour(): Boolean = when (val actuel = ecranInterne.value) {
        is Ecran.Connexion -> {
            val m = actuel.modele
            if (m.etat.value.etape == EtapeConnexion.Code) m.modifierNumero() else allerAccueil(null)
            true
        }
        is Ecran.Inscription -> {
            actuel.modele.retour()
            true
        }
        is Ecran.Profil -> {
            actuel.modele.retour()
            true
        }
        is Ecran.Support -> {
            actuel.modele.retour()
            true
        }
        else -> false
    }

    private fun changer(creer: (CoroutineScope) -> Ecran) {
        porteeEcran?.fermer()
        val nouvelle = portee.porteeEnfant()
        porteeEcran = nouvelle
        ecranInterne.value = creer(nouvelle)
    }
}
