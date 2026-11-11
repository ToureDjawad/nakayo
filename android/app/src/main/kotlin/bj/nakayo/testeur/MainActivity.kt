package bj.nakayo.testeur

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import bj.nakayo.testeur.ui.accueil.AccueilViewModel
import bj.nakayo.testeur.ui.accueil.EcranAccueil
import bj.nakayo.testeur.ui.theme.NakayoTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val api = (application as NakayoApplication).api
        setContent {
            NakayoTheme {
                val modele: AccueilViewModel = viewModel(factory = viewModelFactory { initializer { AccueilViewModel(api::sante) } })
                val etat by modele.etat.collectAsStateWithLifecycle()
                EcranAccueil(etat, surReessayer = modele::actualiser)
            }
        }
    }
}
