package bj.nakayo.testeur.ui.accueil

import bj.nakayo.noyau.Resultat
import bj.nakayo.noyau.Sante
import bj.nakayo.testeur.ui.MessagesErreur
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface EtatAccueil {
    data object Chargement : EtatAccueil
    data object Disponible : EtatAccueil
    data class Indisponible(val message: String) : EtatAccueil
}

// Vérifie au lancement que le service répond. `verifier` = ServiceTesteur::sante.
class AccueilModele(
    private val verifier: suspend () -> Resultat<Sante>,
    private val portee: CoroutineScope,
    // Message affiché en haut de l'accueil (ex. après une déconnexion ou une session expirée).
    val information: String? = null,
) {
    private val etatInterne = MutableStateFlow<EtatAccueil>(EtatAccueil.Chargement)
    val etat: StateFlow<EtatAccueil> = etatInterne.asStateFlow()

    init {
        actualiser()
    }

    fun actualiser() {
        etatInterne.value = EtatAccueil.Chargement
        portee.launch {
            etatInterne.value = when (val r = verifier()) {
                is Resultat.Succes ->
                    if (r.valeur.base == "ok") EtatAccueil.Disponible
                    else EtatAccueil.Indisponible("Le service est momentanément indisponible. Réessayez dans quelques minutes.")
                is Resultat.Echec -> EtatAccueil.Indisponible(MessagesErreur.pour(r.erreur))
            }
        }
    }
}
