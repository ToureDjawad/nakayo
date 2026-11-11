package bj.nakayo.testeur

import bj.nakayo.noyau.ErreurApi
import bj.nakayo.noyau.Resultat
import bj.nakayo.noyau.Sante
import bj.nakayo.testeur.ui.accueil.AccueilModele
import bj.nakayo.testeur.ui.accueil.EtatAccueil
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

class AccueilModeleTest {
    @Test
    fun `chargement puis service disponible`() = runTest {
        val reponse = CompletableDeferred<Resultat<Sante>>()
        val modele = AccueilModele({ reponse.await() }, porteeTest())
        advanceUntilIdle()
        assertEquals(EtatAccueil.Chargement, modele.etat.value)
        reponse.complete(Resultat.Succes(Sante("ok", "ok")))
        advanceUntilIdle()
        assertEquals(EtatAccueil.Disponible, modele.etat.value)
    }

    @Test
    fun `base injoignable côté serveur`() = runTest {
        val modele = AccueilModele({ Resultat.Succes(Sante("ok", "injoignable")) }, porteeTest())
        advanceUntilIdle()
        assertIs<EtatAccueil.Indisponible>(modele.etat.value)
    }

    @Test
    fun `réessayer après une coupure réseau`() = runTest {
        var appels = 0
        val modele = AccueilModele({
            appels++
            if (appels == 1) Resultat.Echec(ErreurApi.Reseau) else Resultat.Succes(Sante("ok", "ok"))
        }, porteeTest())
        advanceUntilIdle()
        assertTrue((modele.etat.value as EtatAccueil.Indisponible).message.startsWith("Pas de connexion"))
        modele.actualiser()
        advanceUntilIdle()
        assertEquals(EtatAccueil.Disponible, modele.etat.value)
        assertEquals(2, appels)
    }
}
