package bj.nakayo.testeur

import bj.nakayo.noyau.Appareil
import bj.nakayo.noyau.BugSignale
import bj.nakayo.noyau.ErreurApi
import bj.nakayo.noyau.Resultat
import bj.nakayo.noyau.ServiceTesteurFactice
import bj.nakayo.noyau.ServiceTesteurFactice.Companion.affectation
import bj.nakayo.testeur.ui.Ecran
import bj.nakayo.testeur.ui.Navigation
import bj.nakayo.testeur.ui.apps.CAPTURES_MAX
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

// US-33 côté Android : rapport de bug avec captures (offres Pro et Lancement Afrique).
class RapportBugTest {
    private val service = ServiceTesteurFactice("jeton").apply {
        reponseMoi = { Resultat.Succes(ServiceTesteurFactice.profil(statut = "valide")) }
    }
    private val outils = OutilsFactices()
    private val pro = affectation().copy(rapportsDeBugs = true)

    private fun TestScope.navigation() = Navigation(
        service,
        { Appareil("Tecno", "Spark 20", "14", 34) },
        porteeTest(),
        { byteArrayOf(1, 2, 3) },
        calcul = UnconfinedTestDispatcher(testScheduler),
        outils = outils,
    )

    private fun fichier(): File = File.createTempFile("capture", ".img")

    @Test
    fun `une app Standard ne propose pas le rapport de bug`() = runTest {
        val nav = navigation()
        advanceUntilIdle()
        nav.allerApp(affectation(), null)
        assertIs<Ecran.App>(nav.ecran.value).modele.signalerBug()
        assertIs<Ecran.App>(nav.ecran.value)
    }

    @Test
    fun `envoie le bug avec ses captures et la version installée, puis vide le formulaire`() = runTest {
        service.reponseMesBugs = { Resultat.Succes(listOf(BugSignale("3", "Ancien bug", "mineure", 0, "accepte", signaleLe = "2026-11-12T09:00:00.000Z"))) }
        val nav = navigation()
        advanceUntilIdle()
        nav.allerApp(pro, null)
        assertIs<Ecran.App>(nav.ecran.value).modele.signalerBug()
        val m = assertIs<Ecran.Bug>(nav.ecran.value).modele
        advanceUntilIdle()
        assertEquals(listOf("Ancien bug"), m.etat.value.signales?.map { it.titre })

        // Champs manquants : rien n'est envoyé.
        m.envoyer()
        assertEquals(setOf("titre", "etapes", "resultatAttendu", "resultatObtenu", "gravite"), m.etat.value.erreurs.keys)
        assertTrue(service.appels.none { it.startsWith("bug:") })

        m.saisirTitre("Le panier se vide")
        m.saisirEtapes("1. Ajouter du riz. 2. Quitter l'app. 3. Revenir.")
        m.saisirAttendu("Le riz est toujours là.")
        m.saisirObtenu("Le panier est vide.")
        m.choisirGravite("genante")
        repeat(2) {
            m.captureChoisie(fichier())
            advanceUntilIdle()
        }
        assertEquals(2, m.etat.value.captures.size)
        m.retirerCapture(0)
        assertEquals(1, m.etat.value.captures.size)

        m.envoyer()
        advanceUntilIdle()
        assertTrue("bug:31:1" in service.appels)
        val (bug, captures) = assertNotNull(service.dernierBug)
        assertEquals("genante", bug.gravite)
        assertEquals("1.0.3", bug.versionApp)
        assertEquals(1, captures.size)
        val etat = m.etat.value
        assertEquals("", etat.titre)
        assertEquals(listOf("Le panier se vide", "Ancien bug"), etat.signales?.map { it.titre })
        assertNotNull(etat.information)
    }

    @Test
    fun `5 captures au plus`() = runTest {
        val nav = navigation()
        advanceUntilIdle()
        nav.allerBug(pro)
        val m = assertIs<Ecran.Bug>(nav.ecran.value).modele
        repeat(CAPTURES_MAX + 2) {
            m.captureChoisie(fichier())
            advanceUntilIdle()
        }
        assertEquals(CAPTURES_MAX, m.etat.value.captures.size)
    }

    @Test
    fun `les erreurs de champ du serveur sont affichées`() = runTest {
        service.reponseBug = { _, _, _ -> Resultat.Echec(ErreurApi.Http(422, "validation", "Formulaire invalide.", mapOf("captures" to "type_fichier_invalide"))) }
        val nav = navigation()
        advanceUntilIdle()
        nav.allerBug(pro)
        val m = assertIs<Ecran.Bug>(nav.ecran.value).modele
        m.saisirTitre("Le panier se vide")
        m.saisirEtapes("1. Ajouter du riz. 2. Quitter l'app.")
        m.saisirAttendu("Le riz est là.")
        m.saisirObtenu("Le panier est vide.")
        m.choisirGravite("bloquante")
        m.envoyer()
        advanceUntilIdle()
        assertEquals(mapOf("captures" to "type_fichier_invalide"), m.etat.value.erreurs)
        assertNull(m.etat.value.information)

        // Retour : écran de l'app.
        nav.retour()
        assertIs<Ecran.App>(nav.ecran.value)
    }
}
