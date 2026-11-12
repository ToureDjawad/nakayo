package bj.nakayo.testeur

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import bj.nakayo.noyau.Appareil
import bj.nakayo.noyau.ServiceTesteur
import bj.nakayo.testeur.campagne.OutilsApps
import bj.nakayo.testeur.photo.CompressionPhoto
import bj.nakayo.testeur.ui.Navigation

// Garde la navigation pendant les rotations d'écran.
class AppViewModel(service: ServiceTesteur, appareil: suspend () -> Appareil, outils: OutilsApps) : ViewModel() {
    val navigation = Navigation(service, appareil, viewModelScope, CompressionPhoto::preparer, outils = outils)
}
