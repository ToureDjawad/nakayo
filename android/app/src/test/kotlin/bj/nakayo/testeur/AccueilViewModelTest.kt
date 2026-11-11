package bj.nakayo.testeur

import bj.nakayo.noyau.ErreurApi
import bj.nakayo.noyau.Resultat
import bj.nakayo.noyau.Sante
import bj.nakayo.testeur.ui.accueil.AccueilViewModel
import bj.nakayo.testeur.ui.accueil.EtatAccueil
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

@OptIn(ExperimentalCoroutinesApi::class)
class AccueilViewModelTest {
    private val planificateur = StandardTestDispatcher()

    @Before
    fun avant() = Dispatchers.setMain(planificateur)

    @After
    fun apres() = Dispatchers.resetMain()

    @Test
    fun `chargement puis service disponible`() = runTest(planificateur) {
        val reponse = CompletableDeferred<Resultat<Sante>>()
        val modele = AccueilViewModel { reponse.await() }
        advanceUntilIdle()
        assertEquals(EtatAccueil.Chargement, modele.etat.value)
        reponse.complete(Resultat.Succes(Sante("ok", "ok")))
        advanceUntilIdle()
        assertEquals(EtatAccueil.Disponible, modele.etat.value)
    }

    @Test
    fun `base injoignable côté serveur`() = runTest(planificateur) {
        val modele = AccueilViewModel { Resultat.Succes(Sante("ok", "injoignable")) }
        advanceUntilIdle()
        assertIs<EtatAccueil.Indisponible>(modele.etat.value)
    }

    @Test
    fun `réessayer après une coupure réseau`() = runTest(planificateur) {
        var appels = 0
        val modele = AccueilViewModel {
            appels++
            if (appels == 1) Resultat.Echec(ErreurApi.Reseau) else Resultat.Succes(Sante("ok", "ok"))
        }
        advanceUntilIdle()
        val erreur = assertIs<EtatAccueil.Indisponible>(modele.etat.value)
        assertEquals(true, erreur.message.startsWith("Pas de connexion"))
        modele.actualiser()
        advanceUntilIdle()
        assertEquals(EtatAccueil.Disponible, modele.etat.value)
        assertEquals(2, appels)
    }
}
