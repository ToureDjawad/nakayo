package bj.nakayo.testeur.ui

import bj.nakayo.noyau.AffectationTesteur
import bj.nakayo.noyau.Appareil
import bj.nakayo.noyau.Resultat
import bj.nakayo.testeur.campagne.OutilsApps
import bj.nakayo.testeur.ui.apps.AppModele
import bj.nakayo.testeur.ui.apps.BugModele
import bj.nakayo.testeur.ui.apps.RapportModele
import bj.nakayo.noyau.ProfilTesteur
import bj.nakayo.noyau.ServiceTesteur
import bj.nakayo.testeur.ui.accueil.AccueilModele
import bj.nakayo.testeur.ui.connexion.ConnexionModele
import bj.nakayo.testeur.ui.connexion.EtapeConnexion
import bj.nakayo.testeur.ui.connexion.ModeConnexion
import bj.nakayo.testeur.ui.espace.EspaceModele
import bj.nakayo.testeur.ui.inscription.InscriptionModele
import bj.nakayo.testeur.ui.portefeuille.PortefeuilleModele
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
    data class App(val modele: AppModele) : Ecran
    data class Rapport(val modele: RapportModele) : Ecran
    data class Bug(val modele: BugModele) : Ecran
    data class Portefeuille(val modele: PortefeuilleModele) : Ecran
}

// Parcours de l'app. Chaque écran a sa portée, annulée quand on le quitte.
class Navigation(
    private val service: ServiceTesteur,
    private val appareil: suspend () -> Appareil,
    private val portee: CoroutineScope,
    // Réduction des photos de l'inscription (Android) ; remplacée dans les tests.
    private val compresser: (File) -> ByteArray,
    private val calcul: CoroutineDispatcher = Dispatchers.Default,
    // Apps installées et position (Android) ; remplacées dans les tests.
    private val outils: OutilsApps = OutilsApps.Aucun,
) {
    private val ecranInterne = MutableStateFlow<Ecran>(Ecran.Demarrage)
    val ecran: StateFlow<Ecran> = ecranInterne.asStateFlow()
    private var porteeEcran: CoroutineScope? = null
    // Ouverture en cours de l'app (incrémentée à chaque retour au premier plan) et dernière signalée.
    private var ouverture = 0
    private var ouvertureSignalee = -1

    // US-18 : accès aux statistiques d'usage donné dans les réglages du téléphone.
    private val mesureInterne = MutableStateFlow(true)
    val mesureAutorisee: StateFlow<Boolean> = mesureInterne.asStateFlow()
    private var testeurValide = false
    // Profil de l'espace, gardé pendant la visite des écrans d'app.
    private var profilEspace: ProfilTesteur? = null

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
        Ecran.Espace(
            EspaceModele(
                service, it, profil, appareil,
                surSortie = { message -> allerAccueil(message) },
                surValide = ::signalerOuverture,
            ),
        )
    }

    // US-17 : une app à tester, ouverte depuis la liste de l'espace.
    fun allerApp(affectation: AffectationTesteur, profil: ProfilTesteur?, information: String? = null): Unit = changer {
        profilEspace = profil
        Ecran.App(
            AppModele(
                service = service,
                portee = it,
                affectation = affectation,
                outils = outils,
                compresser = compresser,
                calcul = calcul,
                information = information,
                surRapport = { a -> allerRapport(a) },
                surBug = { a -> allerBug(a) },
                surQuitter = { allerEspace(profilEspace) },
                surSessionExpiree = { message -> allerAccueil(message) },
            ),
        )
    }

    // US-19 : rapport du jour ; retour à l'app une fois envoyé.
    fun allerRapport(affectation: AffectationTesteur): Unit = changer {
        Ecran.Rapport(
            RapportModele(
                service = service,
                portee = it,
                affectation = affectation,
                outils = outils,
                surEnvoye = { aJour -> allerApp(aJour, profilEspace, "Rapport envoyé. Merci, à demain !") },
                surQuitter = { allerApp(affectation, profilEspace) },
                surSessionExpiree = { message -> allerAccueil(message) },
            ),
        )
    }

    // US-33 : rapport de bug avec captures ; retour à l'app quand le testeur a fini.
    fun allerBug(affectation: AffectationTesteur): Unit = changer {
        Ecran.Bug(
            BugModele(
                service = service,
                portee = it,
                affectation = affectation,
                outils = outils,
                compresser = compresser,
                calcul = calcul,
                surQuitter = { allerApp(affectation, profilEspace) },
                surSessionExpiree = { message -> allerAccueil(message) },
            ),
        )
    }

    // L'app revient au premier plan : on relit l'écran affiché (un nouveau jour a pu commencer).
    fun auPremierPlan() {
        ouverture++
        if (testeurValide) lancerMesure()
        when (val actuel = ecranInterne.value) {
            is Ecran.Espace -> actuel.modele.actualiser()
            is Ecran.Portefeuille -> actuel.modele.actualiser()
            is Ecran.App -> {
                signalerOuverture()
                actuel.modele.actualiser()
            }
            else -> Unit
        }
    }

    // Le temps d'utilisation part en arrière-plan, et seulement si le testeur a donné l'accès.
    private fun lancerMesure() {
        mesureInterne.value = outils.mesureAutorisee()
        if (mesureInterne.value) outils.planifierMesure()
    }

    // US-18 : chaque ouverture de l'app compagnon est signalée au serveur, qui l'horodate.
    // Un seul signal par ouverture, même si plusieurs écrans le demandent ; sans réseau, nouvel essai à la suivante.
    private fun signalerOuverture() {
        // Première fois : on lance la mesure et les rappels du soir ; ensuite, auPremierPlan() relance la mesure.
        if (!testeurValide) {
            lancerMesure()
            outils.planifierRappels()
        }
        testeurValide = true
        if (ouvertureSignalee == ouverture) return
        val courante = ouverture
        ouvertureSignalee = courante
        portee.launch { if (service.signaler() is Resultat.Echec && ouvertureSignalee == courante) ouvertureSignalee = -1 }
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

    // US-23 : gains en attente et versements reçus.
    fun allerPortefeuille(profil: ProfilTesteur?): Unit = changer {
        Ecran.Portefeuille(
            PortefeuilleModele(
                service = service,
                portee = it,
                profil = profil,
                surQuitter = { connu -> allerEspace(connu) },
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
        is Ecran.App -> {
            actuel.modele.retour()
            true
        }
        is Ecran.Rapport -> {
            actuel.modele.retour()
            true
        }
        is Ecran.Bug -> {
            actuel.modele.retour()
            true
        }
        is Ecran.Portefeuille -> {
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
