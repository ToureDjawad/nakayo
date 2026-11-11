package bj.nakayo.testeur

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import bj.nakayo.testeur.ui.accueil.EcranAccueil
import bj.nakayo.testeur.ui.accueil.EtatAccueil
import bj.nakayo.testeur.ui.theme.NakayoTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import kotlin.test.assertEquals

// Écran seul, avec des états fournis par le test.
@RunWith(AndroidJUnit4::class)
class EcranAccueilTest {
    @get:Rule
    val compose = createComposeRule()

    @Test
    fun afficheLErreurEtLeBoutonReessayer() {
        var essais = 0
        var etat by mutableStateOf<EtatAccueil>(EtatAccueil.Indisponible("Pas de connexion au serveur."))
        compose.setContent { NakayoTheme { EcranAccueil(etat, surReessayer = { essais++; etat = EtatAccueil.Chargement }) } }

        compose.onNodeWithText("Pas de connexion au serveur.").assertIsDisplayed()
        compose.onNodeWithText("Réessayer").performClick()
        assertEquals(1, essais)
        compose.onNodeWithText("Connexion au service…").assertIsDisplayed()
    }

    @Test
    fun afficheLeServiceDisponible() {
        compose.setContent { NakayoTheme { EcranAccueil(EtatAccueil.Disponible, surReessayer = {}) } }
        compose.onNodeWithText("Nakayo").assertIsDisplayed()
        compose.onNodeWithText("Le service est disponible.").assertIsDisplayed()
    }
}
