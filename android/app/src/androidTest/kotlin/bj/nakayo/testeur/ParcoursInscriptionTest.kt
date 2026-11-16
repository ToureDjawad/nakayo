package bj.nakayo.testeur

import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import bj.nakayo.noyau.Resultat
import bj.nakayo.noyau.ResultatVerification
import bj.nakayo.noyau.ServiceTesteurFactice
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import kotlin.test.assertTrue

// Création de compte jusqu'à l'écran des pièces (l'appareil photo n'est pas piloté par le test).
@RunWith(AndroidJUnit4::class)
class ParcoursInscriptionTest {
    @get:Rule
    val compose = createEmptyComposeRule()
    private val service = ServiceTesteurFactice().apply {
        reponseVerification = { _, _, _ -> Resultat.Succes(ResultatVerification.Inscription("jeton-inscription", 1800)) }
    }

    @After
    fun retablir() = remplacerService(null)

    @Test
    fun creationJusquAuxPieces() {
        remplacerService(service)
        ActivityScenario.launch(MainActivity::class.java).use {
            compose.attendreTexte("Créer mon compte")
            compose.onNodeWithText("Créer mon compte").performClick()
            compose.attendreTexte("Étape 1 sur 4")
            compose.onNodeWithContentDescription("Numéro de téléphone").performTextInput("0197000000")
            compose.onNodeWithText("Recevoir le code").performClick()
            compose.attendreTexte("opérateur de votre numéro")
            assertTrue(service.appels.none { it.startsWith("envoi") })

            compose.onNodeWithText("MTN MoMo").performClick()
            compose.onNodeWithText("Recevoir le code").performClick()
            compose.attendreTexte("Code reçu par SMS".uppercase())
            compose.onNodeWithContentDescription("Code reçu par SMS").performTextInput("482913")
            compose.onNodeWithText("Continuer").performClick()

            compose.attendreTexte("Faisons connaissance")
            compose.onNodeWithText("Étape 2 sur 4").assertExists()
            compose.onNodeWithText("Continuer").performClick()
            compose.attendreTexte("Saisissez votre nom et votre prénom.")

            compose.onNodeWithContentDescription("Nom et prénom").performTextInput("Afi Dossou")
            compose.onNodeWithContentDescription("Ville").performClick()
            compose.onNodeWithText("Cotonou").performClick()
            compose.onNodeWithContentDescription("Adresse Gmail du Play Store").performTextInput("afi.dossou@gmail")
            compose.onNodeWithText("Continuer").performClick()
            compose.attendreTexte("Adresse incomplète")
            compose.onNodeWithContentDescription("Adresse Gmail du Play Store").performTextInput(".com")
            compose.onNodeWithText("Plus de 6 mois").performScrollTo().performClick()
            compose.onNodeWithText("Continuer").performClick()

            compose.attendreTexte("Une personne, un compte")
            compose.onNodeWithText("Étape 3 sur 4").assertExists()
            compose.onNodeWithText("Envoyer pour validation").performClick()
            compose.attendreTexte("Cochez les deux cases")
            compose.onNodeWithText("Carte d'identité ou CIP").performScrollTo()
            assertTrue(service.appels.none { it.startsWith("inscription") })
        }
    }
}
