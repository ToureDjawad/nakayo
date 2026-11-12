package bj.nakayo.testeur.ui.espace

import bj.nakayo.noyau.Appareil
import bj.nakayo.noyau.ErreurApi
import bj.nakayo.noyau.ProfilTesteur
import bj.nakayo.noyau.Resultat
import bj.nakayo.noyau.ServiceTesteur
import bj.nakayo.testeur.ui.MessagesErreur
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface EtatEspace {
    data object Chargement : EtatEspace
    data class Pret(val profil: ProfilTesteur, val deconnexionEnCours: Boolean = false) : EtatEspace
    data class Erreur(val message: String) : EtatEspace
}

// Espace du testeur connecté : statut du compte et déconnexion.
class EspaceModele(
    private val service: ServiceTesteur,
    private val portee: CoroutineScope,
    profilConnu: ProfilTesteur?,
    // Téléphone actuel, renvoyé au serveur une fois par ouverture (contrôle d'appareil partagé, US-07 et US-10).
    private val appareil: (suspend () -> Appareil)?,
    // Appelé après la déconnexion, ou quand la session a expiré (avec un message).
    private val surSortie: (message: String?) -> Unit,
) {
    private val etatInterne = MutableStateFlow<EtatEspace>(profilConnu?.let { EtatEspace.Pret(it) } ?: EtatEspace.Chargement)
    val etat: StateFlow<EtatEspace> = etatInterne.asStateFlow()

    // Numéro WhatsApp du support publié par l'admin, ou null : l'écran n'affiche alors aucun contact.
    private val whatsappInterne = MutableStateFlow<String?>(null)
    val whatsapp: StateFlow<String?> = whatsappInterne.asStateFlow()

    private var appareilSynchronise = false

    init {
        // Le profil est toujours relu au démarrage, pour voir une décision prise entre-temps par l'admin.
        actualiser()
        portee.launch { (service.support() as? Resultat.Succes)?.let { whatsappInterne.value = it.valeur.whatsapp } }
    }

    private suspend fun synchroniserAppareil() {
        val lire = appareil ?: return
        if (appareilSynchronise) return
        appareilSynchronise = true
        when (val r = service.modifierProfil(appareil = lire())) {
            is Resultat.Succes -> if (etatInterne.value is EtatEspace.Pret) etatInterne.value = EtatEspace.Pret(r.valeur)
            // Sans réseau, nouvel essai à la prochaine actualisation.
            is Resultat.Echec -> appareilSynchronise = false
        }
    }

    fun actualiser() {
        if (etatInterne.value !is EtatEspace.Pret) etatInterne.value = EtatEspace.Chargement
        portee.launch {
            when (val r = service.moi()) {
                is Resultat.Succes -> {
                    etatInterne.value = EtatEspace.Pret(r.valeur)
                    synchroniserAppareil()
                }
                is Resultat.Echec -> {
                    val code = (r.erreur as? ErreurApi.Http)?.code
                    when {
                        code == "non_authentifie" -> surSortie(MessagesErreur.pour(r.erreur))
                        code == "compte_suspendu" -> etatInterne.value = EtatEspace.Erreur(MessagesErreur.pour(r.erreur))
                        // Hors ligne avec un profil déjà affiché : on le garde plutôt que d'afficher une erreur.
                        etatInterne.value is EtatEspace.Pret -> Unit
                        else -> etatInterne.value = EtatEspace.Erreur(MessagesErreur.pour(r.erreur))
                    }
                }
            }
        }
    }

    fun deconnecter() {
        val actuel = etatInterne.value
        if (actuel is EtatEspace.Pret) etatInterne.value = actuel.copy(deconnexionEnCours = true)
        portee.launch {
            service.deconnecter()
            surSortie(null)
        }
    }
}
