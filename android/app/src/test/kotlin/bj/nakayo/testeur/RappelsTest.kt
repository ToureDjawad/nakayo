package bj.nakayo.testeur

import bj.nakayo.noyau.ErreurApi
import bj.nakayo.noyau.Resultat
import bj.nakayo.noyau.ServiceTesteurFactice
import bj.nakayo.testeur.campagne.IssueRappel
import bj.nakayo.testeur.campagne.Rappel
import bj.nakayo.testeur.campagne.appsSansRapport
import bj.nakayo.testeur.campagne.delaiJusqua
import bj.nakayo.testeur.campagne.enumerer
import bj.nakayo.testeur.campagne.preparerRappel
import bj.nakayo.testeur.campagne.rappel
import kotlinx.coroutines.test.runTest
import java.time.Duration
import java.time.ZoneId
import java.time.ZonedDateTime
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class RappelsTest {
    private val benin = ZoneId.of("Africa/Porto-Novo")
    private fun a(id: String, nom: String) = ServiceTesteurFactice.affectation(id).let { it.copy(app = it.app.copy(nom = nom)) }

    @Test
    fun `seules les apps installées, sans rapport et pas encore acquises sont rappelées`() {
        val apps = listOf(
            a("1", "Marché Facile"),
            a("2", "Zem Express").copy(rapportDuJour = true),
            a("3", "Tontine").copy(installationConfirmee = false),
            a("4", "Agri Météo").copy(joursValides = 14, joursAcquis = true),
            a("5", "Taxi Bénin"),
        )
        assertEquals(listOf("Marché Facile", "Taxi Bénin"), appsSansRapport(apps))
    }

    @Test
    fun `texte du rappel avec la liste des apps, plus pressant à 21 h`() {
        assertNull(rappel(emptyList(), 19))
        assertEquals(
            Rappel("Rapport du jour à envoyer", "Il manque votre rapport pour Marché Facile. Envoyez-le avant minuit pour garder votre compteur."),
            rappel(listOf("Marché Facile"), 19),
        )
        val dernier = rappel(listOf("A", "B", "C"), 21)!!
        assertEquals("Dernier rappel : rapport du jour à envoyer", dernier.titre)
        assertEquals("Il manque vos rapports pour A, B et C. Envoyez-les avant minuit pour garder votre compteur.", dernier.texte)
        assertEquals("A et B", enumerer(listOf("A", "B")))
    }

    @Test
    fun `délai jusqu'à la prochaine heure de rappel, à l'heure du Bénin`() {
        val midi = ZonedDateTime.of(2026, 11, 12, 12, 30, 0, 0, benin)
        assertEquals(Duration.ofMinutes(6 * 60 + 30), delaiJusqua(19, midi))
        val soir = ZonedDateTime.of(2026, 11, 12, 19, 0, 0, 0, benin)
        assertEquals(Duration.ofHours(24), delaiJusqua(19, soir))
        // Un instant donné en UTC est ramené au Bénin (UTC+1).
        val utc = ZonedDateTime.of(2026, 11, 12, 19, 30, 0, 0, ZoneId.of("UTC"))
        assertEquals(Duration.ofMinutes(30), delaiJusqua(21, utc))
    }

    @Test
    fun `la tâche ne rappelle rien sans session, réessaie sans réseau`() = runTest {
        val service = ServiceTesteurFactice()
        assertEquals(IssueRappel.Rien, preparerRappel(service, 19))
        service.jeton = "jeton"
        assertEquals(IssueRappel.Notifier(rappel(listOf("Marché Facile"), 19)!!), preparerRappel(service, 19))
        service.reponseApps = { Resultat.Echec(ErreurApi.Reseau) }
        assertEquals(IssueRappel.Reessayer, preparerRappel(service, 21))
        service.reponseApps = { Resultat.Echec(ErreurApi.Http(403, "compte_non_valide")) }
        assertEquals(IssueRappel.Rien, preparerRappel(service, 21))
        service.reponseApps = { Resultat.Succes(emptyList()) }
        assertEquals(IssueRappel.Rien, preparerRappel(service, 21))
    }
}
