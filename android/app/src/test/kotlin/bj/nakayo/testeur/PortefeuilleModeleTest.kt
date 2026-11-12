package bj.nakayo.testeur

import bj.nakayo.noyau.ErreurApi
import bj.nakayo.noyau.Resultat
import bj.nakayo.noyau.ServiceTesteurFactice
import bj.nakayo.testeur.ui.portefeuille.EtatPortefeuille
import bj.nakayo.testeur.ui.portefeuille.PortefeuilleModele
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class PortefeuilleModeleTest {
    private val service = ServiceTesteurFactice("jeton")
    private var quitte = false
    private var expiree: String? = null

    private fun TestScope.modele() = PortefeuilleModele(service, porteeTest(), null, { quitte = true }) { expiree = it }

    @Test
    fun `charge les gains en attente et l'historique`() = runTest {
        val m = modele()
        assertIs<EtatPortefeuille.Chargement>(m.etat.value)
        advanceUntilIdle()
        val p = assertIs<EtatPortefeuille.Pret>(m.etat.value).portefeuille
        assertEquals(6, p.enAttente.single().joursValides)
        assertEquals("MP2611120001", p.historique.single().referenceTransaction)
        m.retour()
        assertTrue(quitte)
    }

    @Test
    fun `erreur réseau puis nouvel essai, un portefeuille affiché reste visible`() = runTest {
        service.reponsePortefeuille = { Resultat.Echec(ErreurApi.Reseau) }
        val m = modele()
        advanceUntilIdle()
        assertIs<EtatPortefeuille.Erreur>(m.etat.value)

        service.reponsePortefeuille = { Resultat.Succes(ServiceTesteurFactice.portefeuilleExemple()) }
        m.actualiser()
        advanceUntilIdle()
        assertIs<EtatPortefeuille.Pret>(m.etat.value)

        service.reponsePortefeuille = { Resultat.Echec(ErreurApi.Reseau) }
        m.actualiser()
        advanceUntilIdle()
        assertIs<EtatPortefeuille.Pret>(m.etat.value)
    }

    @Test
    fun `session expirée, retour à l accueil`() = runTest {
        service.reponsePortefeuille = { Resultat.Echec(ErreurApi.Http(401, "non_authentifie")) }
        modele()
        advanceUntilIdle()
        assertNotNull(expiree)
    }
}
