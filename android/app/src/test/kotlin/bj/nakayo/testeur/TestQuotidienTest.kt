package bj.nakayo.testeur

import bj.nakayo.noyau.Appareil
import bj.nakayo.noyau.DerniereRemise
import bj.nakayo.noyau.ErreurApi
import bj.nakayo.noyau.Position
import bj.nakayo.noyau.Resultat
import bj.nakayo.noyau.ServiceTesteurFactice
import bj.nakayo.noyau.ServiceTesteurFactice.Companion.affectation
import bj.nakayo.testeur.ui.apps.MESSAGE_GMAIL_PRINCIPAL
import bj.nakayo.testeur.campagne.InstallationApp
import bj.nakayo.testeur.campagne.OutilsApps
import bj.nakayo.testeur.ui.Ecran
import bj.nakayo.testeur.ui.Navigation
import bj.nakayo.testeur.ui.apps.AppModele
import bj.nakayo.testeur.ui.apps.Etape
import bj.nakayo.testeur.ui.apps.etape
import bj.nakayo.testeur.ui.apps.remiseVisible
import bj.nakayo.testeur.ui.apps.texteManques
import bj.nakayo.testeur.ui.espace.EtatEspace
import bj.nakayo.testeur.ui.jourBenin
import bj.nakayo.testeur.ui.jourCourt
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import java.io.File
import java.time.Instant
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

class OutilsFactices(
    var installation: InstallationApp? = InstallationApp("com.android.vending", "1.0.3"),
    var position: Position? = Position(6.36536, 2.41833),
    var wifi: Boolean? = true,
    var integrite: bj.nakayo.noyau.Integrite? = null,
) : OutilsApps {
    override fun integrite() = integrite
    override fun installation(paquet: String) = installation
    override suspend fun position() = position
    override fun surWifi() = wifi
}

// Sprint 3 côté Android : apps à tester, inscription, installation, rapport du jour (US-17 à US-20).
class TestQuotidienTest {
    private val service = ServiceTesteurFactice("jeton").apply {
        reponseMoi = { Resultat.Succes(ServiceTesteurFactice.profil(statut = "valide")) }
    }
    private val outils = OutilsFactices()
    private var compressions = 0
    private val compresser: (File) -> ByteArray = { compressions++; byteArrayOf(1, 2, 3) }

    private fun TestScope.navigation() = Navigation(
        service,
        { Appareil("Tecno", "Spark 20", "14", 34) },
        porteeTest(),
        compresser,
        calcul = UnconfinedTestDispatcher(testScheduler),
        outils = outils,
    )

    private fun Navigation.espace() = assertIs<Ecran.Espace>(ecran.value).modele

    @Test
    fun `le signal transmet un appareil suspect (US-28)`() = runTest {
        outils.integrite = bj.nakayo.noyau.Integrite(emulateur = true, root = false)
        navigation()
        advanceUntilIdle()
        assertEquals(bj.nakayo.noyau.Integrite(emulateur = true, root = false), service.derniereIntegrite)
    }

    @Test
    fun `compte validé, les apps sont chargées et chaque ouverture signalée une fois`() = runTest {
        val nav = navigation()
        advanceUntilIdle()
        val etat = assertIs<EtatEspace.Pret>(nav.espace().etat.value)
        assertEquals(listOf("31"), etat.apps?.map { it.id })
        assertEquals(1, service.appels.count { it == "signal" })
        assertEquals(null, service.derniereIntegrite)

        // Plusieurs écrans dans la même ouverture : un seul signal.
        nav.allerApp(affectation(), ServiceTesteurFactice.profil(statut = "valide"))
        nav.retour()
        advanceUntilIdle()
        assertEquals(1, service.appels.count { it == "signal" })

        // Retour dans l'app : nouvelle ouverture.
        nav.auPremierPlan()
        advanceUntilIdle()
        assertEquals(2, service.appels.count { it == "signal" })
    }

    @Test
    fun `signal sans réseau, nouvel essai au retour dans l'app`() = runTest {
        service.reponseSignal = { Resultat.Echec(ErreurApi.Reseau) }
        val nav = navigation()
        advanceUntilIdle()
        service.reponseSignal = { Resultat.Succes(Unit) }
        nav.auPremierPlan()
        advanceUntilIdle()
        assertEquals(2, service.appels.count { it == "signal" })
    }

    @Test
    fun `compte en attente, ni apps ni signal`() = runTest {
        service.reponseMoi = { Resultat.Succes(ServiceTesteurFactice.profil()) }
        navigation()
        advanceUntilIdle()
        assertTrue("apps" !in service.appels)
        assertTrue("signal" !in service.appels)
    }

    @Test
    fun `apps injoignables, l'erreur est affichée`() = runTest {
        service.reponseApps = { Resultat.Echec(ErreurApi.Reseau) }
        val nav = navigation()
        advanceUntilIdle()
        val etat = assertIs<EtatEspace.Pret>(nav.espace().etat.value)
        assertNull(etat.apps)
        assertTrue(etat.erreurApps!!.startsWith("Pas de connexion"))
    }

    private fun TestScope.ouvrirApp(nav: Navigation, a: bj.nakayo.noyau.AffectationTesteur): AppModele {
        nav.allerApp(a, ServiceTesteurFactice.profil(statut = "valide"))
        return assertIs<Ecran.App>(nav.ecran.value).modele
    }

    @Test
    fun `inscription au test avec la capture, réduite puis envoyée`() = runTest {
        val nav = navigation()
        advanceUntilIdle()
        val m = ouvrirApp(nav, affectation(inscription = false, installation = false))
        assertEquals(Etape.Inscription, etape(m.etat.value.affectation))
        val fichier = File.createTempFile("capture", ".img")
        m.captureChoisie(fichier)
        advanceUntilIdle()
        assertEquals(1, compressions)
        assertFalse(fichier.exists())
        assertTrue("inscription-test:31" in service.appels)
        assertEquals(Etape.Installation, etape(m.etat.value.affectation))
        assertTrue(m.etat.value.information!!.startsWith("Inscription confirmée"))
        assertEquals(false, service.dernierGmailPrincipal)
    }

    @Test
    fun `première campagne, le Gmail principal du Play Store est confirmé avant la capture (US-07)`() = runTest {
        val nav = navigation()
        advanceUntilIdle()
        val m = ouvrirApp(nav, affectation(inscription = false, installation = false).copy(gmailPrincipalAConfirmer = true, gmail = "afi@gmail.com"))
        assertTrue(m.gmailPrincipalManquant())
        assertEquals(MESSAGE_GMAIL_PRINCIPAL, m.etat.value.erreur)
        val sansCase = File.createTempFile("capture", ".img")
        m.captureChoisie(sansCase)
        advanceUntilIdle()
        assertFalse(sansCase.exists())
        assertTrue(service.appels.none { it.startsWith("inscription-test") })

        m.confirmerGmailPrincipal(true)
        assertFalse(m.gmailPrincipalManquant())
        assertNull(m.etat.value.erreur)
        m.captureChoisie(File.createTempFile("capture", ".img"))
        advanceUntilIdle()
        assertEquals(true, service.dernierGmailPrincipal)
    }

    @Test
    fun `installation, seule une app du Play Store est acceptée`() = runTest {
        val nav = navigation()
        advanceUntilIdle()
        val m = ouvrirApp(nav, affectation(installation = false))

        outils.installation = null
        m.confirmerInstallation()
        assertTrue(m.etat.value.erreur!!.contains("pas encore installée"))

        outils.installation = InstallationApp("com.google.android.packageinstaller", "1.0.3")
        m.confirmerInstallation()
        assertEquals(AppModele.MESSAGE_PAS_PLAY_STORE, m.etat.value.erreur)
        assertTrue(service.appels.none { it.startsWith("installation:") })

        outils.installation = InstallationApp("com.android.vending", "1.0.3")
        m.confirmerInstallation()
        advanceUntilIdle()
        assertTrue("installation:31:com.android.vending" in service.appels)
        assertNull(m.etat.value.erreur)
        assertEquals(Etape.Rapport, etape(m.etat.value.affectation))
    }

    @Test
    fun `refus du serveur, message clair et état relu`() = runTest {
        val nav = navigation()
        advanceUntilIdle()
        val m = ouvrirApp(nav, affectation(installation = false))
        service.reponseInstallation = { _, _ -> Resultat.Echec(ErreurApi.Http(409, "inscription_requise")) }
        service.appels.clear()
        m.confirmerInstallation()
        advanceUntilIdle()
        assertEquals("Confirmez d'abord votre inscription au test.", m.etat.value.erreur)
        assertTrue("apps" in service.appels)
    }

    @Test
    fun `rapport du jour, vérifié puis envoyé avec la version et la position`() = runTest {
        val nav = navigation()
        advanceUntilIdle()
        val app = ouvrirApp(nav, affectation(jour = 3))
        app.ecrireRapport()
        val m = assertIs<Ecran.Rapport>(nav.ecran.value).modele

        m.envoyer()
        assertEquals(
            setOf("actions", "note", "bug", "fonctionnalites", "retourDetaille"),
            m.etat.value.erreurs.keys,
        )
        m.saisirActions("  J'ai cherché du riz et ajouté au panier.  ")
        m.choisirNote(4)
        m.choisirBug(true)
        m.basculerFonctionnalite("Panier")
        m.basculerFonctionnalite("Recherche de produits")
        m.saisirRetour("x".repeat(99))
        m.envoyer()
        assertEquals(setOf("commentaireBug", "retourDetaille"), m.etat.value.erreurs.keys)
        assertEquals("trop_court", m.etat.value.erreurs["retourDetaille"])

        m.saisirCommentaire("Le panier se vide quand je quitte l'app.")
        m.saisirRetour("Très pratique. ".repeat(10))
        m.envoyer()
        advanceUntilIdle()
        val envoye = service.dernierRapport!!
        assertEquals("J'ai cherché du riz et ajouté au panier.", envoye.actions)
        assertEquals(listOf("Recherche de produits", "Panier"), envoye.fonctionnalites)
        assertEquals("1.0.3", envoye.versionApp)
        assertEquals(Position(6.36536, 2.41833), envoye.position)
        assertEquals(true, envoye.wifi)
        assertEquals("Le panier se vide quand je quitte l'app.", envoye.commentaireBug)

        val retour = assertIs<Ecran.App>(nav.ecran.value).modele
        assertEquals(Etape.JourFait, etape(retour.etat.value.affectation))
        assertEquals("Rapport envoyé. Merci, à demain !", retour.etat.value.information)
    }

    @Test
    fun `rapport sans position, sans problème rencontré, et déjà envoyé`() = runTest {
        val nav = navigation()
        advanceUntilIdle()
        ouvrirApp(nav, affectation(jour = 4)).ecrireRapport()
        val m = assertIs<Ecran.Rapport>(nav.ecran.value).modele
        m.saisirActions("J'ai suivi ma livraison.")
        m.choisirNote(5)
        m.choisirBug(false)
        m.basculerFonctionnalite("Suivi de livraison")

        outils.position = null
        m.envoyer()
        advanceUntilIdle()
        assertTrue(m.etat.value.erreur!!.contains("position"))
        assertTrue(service.appels.none { it.startsWith("rapport:") })

        outils.position = Position(6.4, 2.3)
        service.reponseRapport = { _, _ -> Resultat.Echec(ErreurApi.Http(409, "rapport_deja_envoye")) }
        m.envoyer()
        advanceUntilIdle()
        assertNull(service.dernierRapport!!.commentaireBug)
        assertNull(service.dernierRapport!!.retourDetaille)
        assertEquals("Vous avez déjà envoyé le rapport du jour pour cette app.", m.etat.value.erreur)
        assertFalse(m.etat.value.envoiEnCours)

        assertTrue(nav.retour())
        assertIs<Ecran.App>(nav.ecran.value)
        assertTrue(nav.retour())
        assertIs<Ecran.Espace>(nav.ecran.value)
    }

    @Test
    fun `étapes, remise à zéro et jours du Bénin`() {
        assertEquals(Etape.Inscription, etape(affectation(inscription = false, installation = false)))
        assertEquals(Etape.Rapport, etape(affectation()))
        assertEquals(Etape.JourFait, etape(affectation().copy(rapportDuJour = true)))
        assertEquals(Etape.Acquis, etape(affectation(joursValides = 14).copy(joursAcquis = true)))

        val remise = affectation(joursValides = 0).copy(derniereRemise = DerniereRemise("2026-11-11", listOf("usage", "rapport")))
        assertTrue(remiseVisible(remise))
        assertFalse(remiseVisible(remise.copy(joursAcquis = true)))
        assertEquals("2 minutes dans l'app et le rapport du jour", texteManques(listOf("usage", "rapport")))
        assertEquals("l'ouverture de Nakayo, 2 minutes dans l'app et le rapport du jour", texteManques(listOf("connexion", "usage", "rapport")))

        assertEquals("2026-11-12", jourBenin(Instant.parse("2026-11-11T23:30:00Z")))
        assertEquals("2026-11-11", jourBenin(Instant.parse("2026-11-11T22:59:00Z")))
        assertEquals("11 nov.", jourCourt("2026-11-11"))
    }
}
