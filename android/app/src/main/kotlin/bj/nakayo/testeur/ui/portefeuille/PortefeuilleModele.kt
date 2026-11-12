package bj.nakayo.testeur.ui.portefeuille

import bj.nakayo.noyau.ErreurApi
import bj.nakayo.noyau.Portefeuille
import bj.nakayo.noyau.ProfilTesteur
import bj.nakayo.noyau.Resultat
import bj.nakayo.noyau.ServiceTesteur
import bj.nakayo.testeur.ui.MessagesErreur
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface EtatPortefeuille {
    data object Chargement : EtatPortefeuille
    data class Erreur(val message: String) : EtatPortefeuille
    data class Pret(val portefeuille: Portefeuille) : EtatPortefeuille
}

// US-23 : gains en attente par app, total versé et historique des versements (docs/api-sprint4.md §3).
class PortefeuilleModele(
    private val service: ServiceTesteur,
    private val portee: CoroutineScope,
    // Profil de l'espace, rendu au retour.
    private val profil: ProfilTesteur?,
    private val surQuitter: (ProfilTesteur?) -> Unit,
    private val surSessionExpiree: (message: String) -> Unit,
) {
    private val etatInterne = MutableStateFlow<EtatPortefeuille>(EtatPortefeuille.Chargement)
    val etat: StateFlow<EtatPortefeuille> = etatInterne.asStateFlow()

    init {
        actualiser()
    }

    fun actualiser() {
        // Un portefeuille déjà affiché reste visible pendant la relecture.
        if (etatInterne.value is EtatPortefeuille.Erreur) etatInterne.value = EtatPortefeuille.Chargement
        portee.launch {
            when (val r = service.portefeuille()) {
                is Resultat.Succes -> etatInterne.value = EtatPortefeuille.Pret(r.valeur)
                is Resultat.Echec -> {
                    if ((r.erreur as? ErreurApi.Http)?.code == "non_authentifie") {
                        surSessionExpiree(MessagesErreur.pour(r.erreur))
                    } else if (etatInterne.value !is EtatPortefeuille.Pret) {
                        etatInterne.value = EtatPortefeuille.Erreur(MessagesErreur.pour(r.erreur))
                    }
                }
            }
        }
    }

    fun retour() = surQuitter(profil)
}
