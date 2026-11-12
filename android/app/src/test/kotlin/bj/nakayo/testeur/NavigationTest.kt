package bj.nakayo.testeur

import bj.nakayo.noyau.Appareil
import bj.nakayo.noyau.ErreurApi
import bj.nakayo.noyau.Resultat
import bj.nakayo.noyau.ServiceTesteurFactice
import bj.nakayo.testeur.ui.Ecran
import bj.nakayo.testeur.ui.Navigation
import bj.nakayo.testeur.ui.connexion.ModeConnexion
import bj.nakayo.testeur.ui.espace.EtatEspace
import bj.nakayo.testeur.ui.inscription.EtapeInscription
import bj.nakayo.noyau.ResultatVerification
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertTrue

class NavigationTest {
    private val appareil = Appareil("Tecno", "Spark 20", "14", 34, "app-test-identifiant")

    @Test
    fun `sans session, l'app s'ouvre sur l'accueil`() = runTest {
        val nav = Navigation(ServiceTesteurFactice(), { appareil }, porteeTest(), { ByteArray(0) })
        advanceUntilIdle()
        assertIs<Ecran.Accueil>(nav.ecran.value)
        assertFalse(nav.retour())
    }

    @Test
    fun `avec une session, l'app relit le profil et ouvre l'espace`() = runTest {
        val service = ServiceTesteurFactice(jeton = "jeton")
        service.reponseMoi = { Resultat.Succes(ServiceTesteurFactice.profil(statut = "valide")) }
        val nav = Navigation(service, { appareil }, porteeTest(), { ByteArray(0) })
        advanceUntilIdle()
        val espace = assertIs<Ecran.Espace>(nav.ecran.value)
        assertEquals("valide", (espace.modele.etat.value as EtatEspace.Pret).profil.statut)
    }

    @Test
    fun `session expirée, retour à l'accueil avec un message`() = runTest {
        val service = ServiceTesteurFactice(jeton = "jeton-perime")
        service.reponseMoi = { Resultat.Echec(ErreurApi.Http(401, "non_authentifie")) }
        val nav = Navigation(service, { appareil }, porteeTest(), { ByteArray(0) })
        advanceUntilIdle()
        val accueil = assertIs<Ecran.Accueil>(nav.ecran.value)
        assertTrue(accueil.modele.information!!.contains("session a expiré"))
    }

    @Test
    fun `déconnexion depuis l'espace`() = runTest {
        val service = ServiceTesteurFactice(jeton = "jeton")
        val nav = Navigation(service, { appareil }, porteeTest(), { ByteArray(0) })
        advanceUntilIdle()
        (nav.ecran.value as Ecran.Espace).modele.deconnecter()
        advanceUntilIdle()
        assertIs<Ecran.Accueil>(nav.ecran.value)
        assertFalse(service.sessionOuverte())
    }

    @Test
    fun `hors ligne avec un profil affiché, on le garde`() = runTest {
        val service = ServiceTesteurFactice(jeton = "jeton")
        service.reponseMoi = { Resultat.Echec(ErreurApi.Reseau) }
        val nav = Navigation(service, { appareil }, porteeTest(), { ByteArray(0) })
        advanceUntilIdle()
        nav.allerEspace(ServiceTesteurFactice.profil())
        advanceUntilIdle()
        assertIs<EtatEspace.Pret>((nav.ecran.value as Ecran.Espace).modele.etat.value)
    }

    @Test
    fun `le retour depuis le code revient au numéro, puis à l'accueil`() = runTest {
        val nav = Navigation(ServiceTesteurFactice(), { appareil }, porteeTest(), { ByteArray(0) })
        advanceUntilIdle()
        nav.allerConnexion(ModeConnexion.Connexion)
        val connexion = (nav.ecran.value as Ecran.Connexion).modele
        connexion.saisirTelephone("0197000000")
        connexion.envoyerCode()
        advanceUntilIdle()
        assertTrue(nav.retour())
        assertIs<Ecran.Connexion>(nav.ecran.value)
        assertTrue(nav.retour())
        assertIs<Ecran.Accueil>(nav.ecran.value)
    }

    @Test
    fun `numéro inconnu, inscription, retour pas à pas, puis espace une fois inscrit`() = runTest {
        val service = ServiceTesteurFactice()
        service.reponseVerification = { _, _, _ -> Resultat.Succes(ResultatVerification.Inscription("jeton-inscription", 1800)) }
        val nav = Navigation(service, { appareil }, porteeTest(), { ByteArray(0) }, StandardTestDispatcher(testScheduler))
        advanceUntilIdle()
        nav.allerConnexion(ModeConnexion.Creation)
        val connexion = (nav.ecran.value as Ecran.Connexion).modele
        connexion.choisirOperateur("mtn")
        connexion.saisirTelephone("0197000000")
        connexion.envoyerCode()
        advanceUntilIdle()
        connexion.saisirCode("482913")
        connexion.verifierCode()
        advanceUntilIdle()

        val inscription = assertIs<Ecran.Inscription>(nav.ecran.value).modele
        assertEquals("+2290197000000", inscription.telephone)
        assertTrue(inscription.operateurDejaChoisi)
        inscription.saisirNom("Afi Dossou")
        inscription.choisirVille("Cotonou")
        inscription.saisirGmail("afi.dossou@gmail.com")
        inscription.continuer()
        assertEquals(EtapeInscription.Pieces, inscription.etat.value.etape)
        assertTrue(nav.retour())
        assertEquals(EtapeInscription.Profil, inscription.etat.value.etape)
        assertTrue(nav.retour())
        assertIs<Ecran.Connexion>(nav.ecran.value)

        nav.allerInscription("+2290197000000", "jeton-inscription", "mtn")
        advanceUntilIdle()
        val m = (nav.ecran.value as Ecran.Inscription).modele
        m.saisirNom("Afi Dossou")
        m.choisirVille("Cotonou")
        m.saisirGmail("afi.dossou@gmail.com")
        m.continuer()
        val photo = kotlin.io.path.createTempFile().toFile().apply { writeBytes(byteArrayOf(1)) }
        m.photoPrise(bj.nakayo.testeur.ui.inscription.ChampPhoto.PieceIdentite, photo)
        val selfie = kotlin.io.path.createTempFile().toFile().apply { writeBytes(byteArrayOf(1)) }
        m.photoPrise(bj.nakayo.testeur.ui.inscription.ChampPhoto.Selfie, selfie)
        advanceUntilIdle()
        m.accepterConditions(true)
        m.consentirSuivi(true)
        m.envoyer()
        advanceUntilIdle()
        assertIs<Ecran.Espace>(nav.ecran.value)
        assertTrue(service.sessionOuverte())
    }

    @Test
    fun `profil ouvert depuis l'espace, puis retour avec le profil à jour`() = runTest {
        val service = ServiceTesteurFactice(jeton = "jeton")
        val nav = Navigation(service, { appareil }, porteeTest(), { ByteArray(0) })
        advanceUntilIdle()
        nav.allerProfil(ServiceTesteurFactice.profil())
        val profil = (nav.ecran.value as Ecran.Profil).modele
        profil.basculerLangue("en")
        profil.enregistrerLangues()
        advanceUntilIdle()
        assertTrue(nav.retour())
        val espace = assertIs<Ecran.Espace>(nav.ecran.value)
        assertEquals(listOf("fr", "en"), (espace.modele.etat.value as EtatEspace.Pret).profil.langues)
    }
}
