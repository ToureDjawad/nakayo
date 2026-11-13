package bj.nakayo.testeur

import android.Manifest
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.test.performTextInput
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import bj.nakayo.noyau.DerniereRemise
import bj.nakayo.noyau.Position
import bj.nakayo.noyau.Resultat
import bj.nakayo.noyau.ServiceTesteurFactice
import bj.nakayo.testeur.campagne.InstallationApp
import bj.nakayo.testeur.campagne.OutilsApps
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import kotlin.test.assertEquals

// Test quotidien dans la vraie activité (US-17 à US-20), avec un faux service et un faux téléphone.
@RunWith(AndroidJUnit4::class)
class ParcoursTestQuotidienTest {
    @get:Rule
    val compose = createEmptyComposeRule()
    private val service = ServiceTesteurFactice("jeton").apply {
        reponseMoi = { Resultat.Succes(ServiceTesteurFactice.profil(statut = "valide")) }
    }
    private val application get() = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as NakayoApplication
    private lateinit var outilsAvant: OutilsApps

    @Before
    fun preparer() {
        outilsAvant = application.outils
        application.outils = object : OutilsApps {
            override fun installation(paquet: String) = InstallationApp("com.android.vending", "1.0.3")
            override suspend fun position() = Position(6.36536, 2.41833)
        }
        // La position est demandée à l'envoi du rapport : accordée d'avance pour ne pas afficher la fenêtre d'Android.
        InstrumentationRegistry.getInstrumentation().uiAutomation
            .grantRuntimePermission(application.packageName, Manifest.permission.ACCESS_COARSE_LOCATION)
    }

    @After
    fun retablir() {
        remplacerService(null)
        application.outils = outilsAvant
    }

    private fun lancer(): ActivityScenario<MainActivity> {
        remplacerService(service)
        return ActivityScenario.launch(MainActivity::class.java)
    }

    private fun toucher(texte: String) = compose.onNodeWithText(texte).performScrollTo().performClick()

    @Test
    fun listeDesAppsPuisRapportDuJour() {
        lancer().use {
            compose.attendreTexte("Votre app à tester")
            compose.onNodeWithText("Rapport du jour à envoyer").assertExists()
            toucher("Marché Facile")

            compose.attendreTexte("sur 14 jours validés")
            toucher("Écrire le rapport du jour")
            compose.attendreTexte("Rapport du jour 3")
            compose.onNodeWithContentDescription("Qu'avez-vous fait dans l'app aujourd'hui ?")
                .performTextInput("J'ai cherché du riz et ajouté deux articles au panier.")
            toucher("4")
            toucher("Non")
            toucher("Panier")
            compose.onNodeWithContentDescription("Votre avis détaillé").performScrollTo()
                .performTextInput("L'app est rapide et claire. La recherche trouve vite les produits, mais le panier mériterait un bouton plus visible.")
            // Clavier ouvert : le pied d'écran bouge pendant l'animation, un toucher simulé peut tomber à côté.
            // On déclenche donc directement l'action du bouton.
            compose.onNodeWithText("Envoyer le rapport").performSemanticsAction(SemanticsActions.OnClick)
            compose.waitUntil(30_000) { service.dernierRapport != null }

            compose.attendreTexte("Rapport envoyé. Merci, à demain !")
            compose.onNodeWithText("Rapport du jour envoyé").performScrollTo().assertExists()
            val rapport = service.dernierRapport!!
            assertEquals(4, rapport.note)
            assertEquals(listOf("Panier"), rapport.fonctionnalites)
            assertEquals("1.0.3", rapport.versionApp)
        }
    }

    @Test
    fun inscriptionAFaireEtCompteurRemisAZero() {
        service.reponseApps = {
            Resultat.Succes(
                listOf(
                    ServiceTesteurFactice.affectation(id = "31", inscription = false, installation = false),
                    ServiceTesteurFactice.affectation(id = "32", jour = 6, joursValides = 0)
                        .copy(derniereRemise = DerniereRemise("2026-11-11", listOf("rapport"))),
                ),
            )
        }
        lancer().use {
            compose.attendreTexte("Vos 2 apps à tester")
            compose.onNodeWithText("Inscription au test à faire").assertExists()
            compose.onNodeWithText("Jour 6 sur 16", substring = true).performScrollTo().performClick()
            compose.attendreTexte("Votre compteur est revenu à 0")
            compose.onNodeWithText("il manquait le rapport du jour", substring = true).assertExists()
            compose.onNodeWithText("ne vous désinscrivez pas", substring = true).assertExists()
        }
    }

    // US-23 : le portefeuille, depuis l'espace, puis retour à la liste des apps.
    @Test
    fun portefeuilleDepuisLEspace() {
        lancer().use {
            compose.attendreTexte("Votre app à tester")
            toucher("Mon portefeuille")
            compose.attendreTexte("Gains en attente".uppercase())
            compose.onNodeWithText("Jour atteint : 6 sur 14 jours validés").assertExists()
            compose.onNodeWithText("Référence de transaction : MP2611120001").performScrollTo().assertExists()
            compose.onNodeWithContentDescription("Retour").performClick()
            compose.attendreTexte("Votre app à tester")
        }
    }
}
