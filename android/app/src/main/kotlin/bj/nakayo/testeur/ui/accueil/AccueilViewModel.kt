package bj.nakayo.testeur.ui.accueil

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import bj.nakayo.noyau.Resultat
import bj.nakayo.noyau.Sante
import bj.nakayo.testeur.ui.MessagesErreur
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface EtatAccueil {
    data object Chargement : EtatAccueil
    data object Disponible : EtatAccueil
    data class Indisponible(val message: String) : EtatAccueil
}

// Vérifie au lancement que le service répond. `verifier` = ApiNakayo::sante, remplaçable dans les tests.
class AccueilViewModel(private val verifier: suspend () -> Resultat<Sante>) : ViewModel() {
    private val etatInterne = MutableStateFlow<EtatAccueil>(EtatAccueil.Chargement)
    val etat: StateFlow<EtatAccueil> = etatInterne.asStateFlow()

    init {
        actualiser()
    }

    fun actualiser() {
        etatInterne.value = EtatAccueil.Chargement
        viewModelScope.launch {
            etatInterne.value = when (val r = verifier()) {
                is Resultat.Succes ->
                    if (r.valeur.base == "ok") EtatAccueil.Disponible
                    else EtatAccueil.Indisponible("Le service est momentanément indisponible. Réessayez dans quelques minutes.")
                is Resultat.Echec -> EtatAccueil.Indisponible(MessagesErreur.pour(r.erreur))
            }
        }
    }
}
