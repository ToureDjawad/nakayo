package bj.nakayo.testeur

import bj.nakayo.noyau.ErreurApi
import bj.nakayo.noyau.Resultat
import bj.nakayo.noyau.ServiceTesteurFactice
import bj.nakayo.noyau.Ticket
import bj.nakayo.testeur.ui.Ecran
import bj.nakayo.testeur.ui.Navigation
import bj.nakayo.testeur.ui.support.SupportModele
import bj.nakayo.testeur.ui.support.validerMessage
import bj.nakayo.testeur.ui.support.validerSujet
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class SupportModeleTest {
    private val service = ServiceTesteurFactice("jeton")
    private var quitte = false
    private var expiree: String? = null

    private fun TestScope.modele() = SupportModele(service, porteeTest(), null, { quitte = true }) { expiree = it }

    @Test
    fun `charge l'historique, vérifie les champs puis envoie`() = runTest {
        val ancien = Ticket("3", "Paiement", "Mon paiement n'est pas arrivé.", "traite", "2026-11-10T09:00:00.000Z", "2026-11-10T10:00:00.000Z")
        service.reponseMesTickets = { Resultat.Succes(listOf(ancien)) }
        val m = modele()
        advanceUntilIdle()
        assertEquals(listOf(ancien), m.etat.value.tickets)

        m.envoyer()
        assertEquals(mapOf("sujet" to "requis", "message" to "requis"), m.etat.value.erreurs)
        assertTrue(service.appels.none { it.startsWith("ticket:") })

        m.saisirSujet("  Campagne   de test ")
        m.saisirMessage("Bonjour, quand commence la prochaine campagne ?\n")
        assertTrue(m.etat.value.erreurs.isEmpty())
        m.envoyer()
        advanceUntilIdle()
        assertTrue("ticket:Campagne de test" in service.appels)
        val etat = m.etat.value
        assertEquals("", etat.sujet)
        assertEquals("", etat.message)
        assertNotNull(etat.information)
        assertEquals(listOf("12", "3"), etat.tickets!!.map { it.id })
    }

    @Test
    fun `erreurs du serveur par champ, et limite de messages`() = runTest {
        val m = modele()
        m.saisirSujet("Sujet valide")
        m.saisirMessage("Un message assez long.")
        service.reponseTicket = { _, _ -> Resultat.Echec(ErreurApi.Http(422, "validation", champs = mapOf("message" to "trop_long"))) }
        m.envoyer()
        advanceUntilIdle()
        assertEquals(mapOf("message" to "trop_long"), m.etat.value.erreurs)
        assertNull(m.etat.value.erreur)

        service.reponseTicket = { _, _ -> Resultat.Echec(ErreurApi.Http(429, "trop_de_requetes", reessayerDans = 1200)) }
        m.envoyer()
        advanceUntilIdle()
        assertEquals("Trop de tentatives. Réessayez dans 20 minutes.", m.etat.value.erreur)
    }

    @Test
    fun `session expirée`() = runTest {
        service.reponseMesTickets = { Resultat.Echec(ErreurApi.Http(401, "non_authentifie")) }
        modele()
        advanceUntilIdle()
        assertNotNull(expiree)
    }

    @Test
    fun `l'historique est facultatif, sans réseau le formulaire reste utilisable`() = runTest {
        service.reponseMesTickets = { Resultat.Echec(ErreurApi.Reseau) }
        val m = modele()
        advanceUntilIdle()
        assertNull(m.etat.value.tickets)
        assertNull(expiree)
        m.retour()
        assertTrue(quitte)
    }

    @Test
    fun `longueurs du contrat, en caractères`() {
        assertEquals("trop_court", validerSujet(" ab "))
        assertEquals("trop_long", validerSujet("x".repeat(121)))
        assertNull(validerSujet("😀".repeat(120)))
        assertEquals("trop_court", validerMessage("court"))
        assertEquals("trop_long", validerMessage("x".repeat(2001)))
        assertNull(validerMessage("x".repeat(10)))
    }

    @Test
    fun `ouvert depuis l'espace, retour à l'espace`() = runTest {
        val nav = Navigation(service, { bj.nakayo.noyau.Appareil("Tecno", "Spark 20", "14", 34) }, porteeTest(), { ByteArray(0) })
        advanceUntilIdle()
        val profil = ServiceTesteurFactice.profil()
        nav.allerSupport(profil)
        assertTrue(nav.ecran.value is Ecran.Support)
        assertTrue(nav.retour())
        assertTrue(nav.ecran.value is Ecran.Espace)
    }
}
