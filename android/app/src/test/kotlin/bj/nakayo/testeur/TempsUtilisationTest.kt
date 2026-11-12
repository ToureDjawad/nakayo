package bj.nakayo.testeur

import bj.nakayo.noyau.Appareil
import bj.nakayo.noyau.ErreurApi
import bj.nakayo.noyau.Position
import bj.nakayo.noyau.Resultat
import bj.nakayo.noyau.ServiceTesteurFactice
import bj.nakayo.noyau.ServiceTesteurFactice.Companion.affectation
import bj.nakayo.noyau.UsageJour
import bj.nakayo.testeur.campagne.EvenementUsage
import bj.nakayo.testeur.campagne.InstallationApp
import bj.nakayo.testeur.campagne.IssueEnvoi
import bj.nakayo.testeur.campagne.OutilsApps
import bj.nakayo.testeur.campagne.cumulerPremierPlan
import bj.nakayo.testeur.campagne.envoyerUsages
import bj.nakayo.testeur.campagne.joursAMesurer
import bj.nakayo.testeur.ui.Navigation
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import java.time.Instant
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

// US-18 : temps passé dans les apps testées, mesuré sur le téléphone puis envoyé au serveur.
class TempsUtilisationTest {
    private val a = "bj.studioawa.marche"
    private val b = "bj.autre.app"

    @Test
    fun `temps au premier plan, plusieurs ouvertures et activités`() {
        val evenements = listOf(
            EvenementUsage(a, true, 1_000),
            EvenementUsage(a, false, 61_000),
            // Deux activités de la même app : compté une seule fois.
            EvenementUsage(a, true, 100_000),
            EvenementUsage(a, true, 100_500),
            EvenementUsage(a, false, 101_000),
            EvenementUsage(a, false, 130_000),
            EvenementUsage(b, true, 5_000),
            EvenementUsage(b, false, 8_000),
        )
        assertEquals(mapOf(a to 90_000L, b to 3_000L), cumulerPremierPlan(evenements, 0, 200_000))
    }

    @Test
    fun `app ouverte avant le début ou encore ouverte à la fin`() {
        val evenements = listOf(EvenementUsage(a, false, 30_000), EvenementUsage(b, true, 170_000))
        assertEquals(mapOf(a to 30_000L, b to 30_000L), cumulerPremierPlan(evenements, 0, 200_000))
        assertEquals(emptyMap(), cumulerPremierPlan(listOf(EvenementUsage(a, true, 300_000)), 0, 200_000))
    }

    @Test
    fun `hier et aujourd'hui à l'heure du Bénin`() {
        val jours = joursAMesurer(Instant.parse("2026-11-12T08:00:00Z"))
        assertEquals(listOf("2026-11-11", "2026-11-12"), jours.map { it.jour })
        assertEquals(Instant.parse("2026-11-10T23:00:00Z").toEpochMilli(), jours[0].debut)
        assertEquals(Instant.parse("2026-11-11T23:00:00Z").toEpochMilli(), jours[1].debut)
        assertEquals(jours[1].debut, jours[0].fin)
        assertEquals(Instant.parse("2026-11-12T08:00:00Z").toEpochMilli(), jours[1].fin)
    }

    @Test
    fun `envoi des cumuls des seules apps installées et en cours`() = runTest {
        val service = ServiceTesteurFactice("jeton")
        service.reponseApps = {
            Resultat.Succes(
                listOf(
                    affectation(id = "31"),
                    affectation(id = "32", installation = false).let { it.copy(app = it.app.copy(paquet = "pas.installee")) },
                    affectation(id = "33", joursValides = 14).let { it.copy(joursAcquis = true, app = it.app.copy(paquet = "deja.acquise")) },
                ),
            )
        }
        var demandes: Set<String>? = null
        val issue = envoyerUsages(service) { paquets ->
            demandes = paquets
            paquets.map { UsageJour(it, "2026-11-12", 130) }
        }
        assertEquals(IssueEnvoi.Fait, issue)
        assertEquals(setOf(a), demandes)
        assertEquals(listOf(UsageJour(a, "2026-11-12", 130)), service.dernieresUsages)
    }

    @Test
    fun `sans réseau on réessaie, sans session ou compte non valide on arrête`() = runTest {
        val service = ServiceTesteurFactice("jeton")
        service.reponseUsages = { Resultat.Echec(ErreurApi.Reseau) }
        assertEquals(IssueEnvoi.Reessayer, envoyerUsages(service) { listOf(UsageJour(a, "2026-11-12", 10)) })

        service.reponseApps = { Resultat.Echec(ErreurApi.Http(403, "compte_non_valide")) }
        assertEquals(IssueEnvoi.Arrete, envoyerUsages(service) { emptyList() })

        service.jeton = null
        assertEquals(IssueEnvoi.Arrete, envoyerUsages(service) { emptyList() })
    }

    @Test
    fun `accès non donné, bandeau affiché et aucune mesure planifiée`() = runTest {
        var autorisee = false
        var planifications = 0
        val outils = object : OutilsApps {
            override fun installation(paquet: String) = InstallationApp("com.android.vending", "1.0.3")
            override suspend fun position() = Position(6.4, 2.4)
            override fun mesureAutorisee() = autorisee
            override fun planifierMesure() { planifications++ }
        }
        val service = ServiceTesteurFactice("jeton").apply {
            reponseMoi = { Resultat.Succes(ServiceTesteurFactice.profil(statut = "valide")) }
        }
        val nav = Navigation(service, { Appareil("Tecno", "Spark 20", "14", 34) }, porteeTest(), { ByteArray(0) }, outils = outils)
        advanceUntilIdle()
        assertFalse(nav.mesureAutorisee.value)
        assertEquals(0, planifications)

        // Retour des réglages avec l'accès donné.
        autorisee = true
        nav.auPremierPlan()
        advanceUntilIdle()
        assertTrue(nav.mesureAutorisee.value)
        assertEquals(1, planifications)
    }
}
