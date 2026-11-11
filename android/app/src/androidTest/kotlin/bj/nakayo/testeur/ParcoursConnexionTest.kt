package bj.nakayo.testeur

import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextClearance
import androidx.compose.ui.test.performTextInput
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import bj.nakayo.noyau.ErreurApi
import bj.nakayo.noyau.Resultat
import bj.nakayo.noyau.ServiceTesteurFactice
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import kotlin.test.assertTrue

// Parcours complet dans la vraie activité, avec un faux service (le serveur n'envoie pas de vrai SMS).
@RunWith(AndroidJUnit4::class)
class ParcoursConnexionTest {
    @get:Rule
    val compose = createEmptyComposeRule()
    private val service = ServiceTesteurFactice()

    @After
    fun retablir() = remplacerService(null)

    private fun lancer(): ActivityScenario<MainActivity> {
        remplacerService(service)
        return ActivityScenario.launch(MainActivity::class.java)
    }

    @Test
    fun connexionPuisDeconnexion() {
        lancer().use {
            compose.attendreTexte("J'ai déjà un compte")
            compose.onNodeWithText("J'ai déjà un compte").performClick()
            compose.onNodeWithContentDescription("Numéro de téléphone").performTextInput("01 97 00 00 00")
            compose.onNodeWithText("Recevoir le code").performClick()

            compose.attendreTexte("Code reçu par SMS".uppercase())
            compose.onNodeWithText("Renvoyer le code dans", substring = true).assertExists()
            compose.onNodeWithContentDescription("Code reçu par SMS").performTextInput("482913")
            compose.onNodeWithText("Continuer").performClick()

            compose.attendreTexte("Merci Koffi, on vérifie votre compte")
            compose.onNodeWithText("Vérification par l'équipe").assertExists()
            compose.onNodeWithText("Me déconnecter").performClick()
            compose.attendreTexte("J'ai déjà un compte")
            assertTrue("deconnexion" in service.appels)
        }
    }

    @Test
    fun numeroInvalideEtCodeFaux() {
        service.reponseVerification = { _, _, _ -> Resultat.Echec(ErreurApi.Http(400, "code_invalide", tentativesRestantes = 4)) }
        lancer().use {
            compose.attendreTexte("J'ai déjà un compte")
            compose.onNodeWithText("J'ai déjà un compte").performClick()
            val numero = compose.onNodeWithContentDescription("Numéro de téléphone")
            numero.performTextInput("97000000")
            compose.onNodeWithText("Recevoir le code").performClick()
            compose.attendreTexte("10 chiffres commençant par 01")

            numero.performTextClearance()
            numero.performTextInput("0197000000")
            compose.onNodeWithText("Recevoir le code").performClick()
            compose.attendreTexte("Code reçu par SMS".uppercase())
            compose.onNodeWithContentDescription("Code reçu par SMS").performTextInput("000000")
            compose.onNodeWithText("Continuer").performClick()
            compose.attendreTexte("Il vous reste 4 essais")
        }
    }

    @Test
    fun sessionGardeeAuRedemarrage() {
        service.jeton = "jeton-garde"
        service.reponseMoi = { Resultat.Succes(ServiceTesteurFactice.profil(statut = "refuse", motifRefus = "Photo du selfie floue.")) }
        lancer().use {
            compose.attendreTexte("Votre compte n'a pas été validé")
            compose.onNodeWithText("Photo du selfie floue.").assertExists()
        }
    }

    @Test
    fun profilLanguesEtDemandeMomo() {
        service.jeton = "jeton-garde"
        lancer().use {
            compose.attendreTexte("Mon profil")
            compose.onNodeWithText("Mon profil").performClick()
            compose.attendreTexte("Koffi Agbo")
            compose.onNodeWithText("Anglais").performClick()
            compose.onNodeWithText("Enregistrer mes langues").performClick()
            compose.attendreTexte("Vos langues sont enregistrées.")
            assertTrue("profil:langues=fr,en" in service.appels)

            compose.onNodeWithText("Demander une modification").performClick()
            compose.attendreTexte("Changer de numéro Mobile Money")
            compose.onNodeWithText("Moov Money").performClick()
            compose.onNodeWithContentDescription("Nouveau numéro Mobile Money").performTextInput("0195000000")
            compose.onNodeWithContentDescription("Pourquoi changer de numéro ?").performTextInput("J'ai perdu ma puce MTN")
            compose.onNodeWithText("Envoyer la demande").performClick()
            compose.attendreTexte("Changement en vérification")
            assertTrue("demande-momo:+2290195000000:moov" in service.appels)
        }
    }
}
