package bj.nakayo.testeur

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import bj.nakayo.testeur.ui.AppNakayo
import bj.nakayo.testeur.ui.theme.NakayoTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val application = application as NakayoApplication
        setContent {
            NakayoTheme {
                val modele: AppViewModel = viewModel(
                    factory = viewModelFactory { initializer { AppViewModel(application.service, application.identiteAppareil::appareil) } },
                )
                AppNakayo(modele.navigation)
            }
        }
    }
}
