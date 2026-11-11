package bj.nakayo.testeur

import bj.nakayo.noyau.Appareil
import bj.nakayo.noyau.ErreurApi
import bj.nakayo.noyau.ProfilTesteur
import bj.nakayo.noyau.Resultat
import bj.nakayo.noyau.ResultatVerification
import bj.nakayo.noyau.ServiceTesteurFactice
import bj.nakayo.testeur.ui.connexion.ConnexionModele
import bj.nakayo.testeur.ui.connexion.EtapeConnexion
import bj.nakayo.testeur.ui.connexion.ModeConnexion
import bj.nakayo.testeur.ui.minutes
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ConnexionModeleTest {
    private val service = ServiceTesteurFactice()
    private val appareil = Appareil("Tecno", "Spark 20", "14", 34, "app-test-identifiant")
    private var connecte: ProfilTesteur? = null
    private var inscription: Pair<String, String>? = null

    private fun TestScope.modele(portee: CoroutineScope = porteeTest()) = ConnexionModele(
        service, { appareil }, portee,
        surConnecte = { connecte = it },
        surInscription = { t, j, _ -> inscription = t to j },
    )

    @Test
    fun `numéro mal saisi, aucun appel au serveur`() = runTest {
        val m = modele()
        m.saisirTelephone("97 00 00 00")
        m.envoyerCode()
        assertTrue(m.etat.value.erreurTelephone!!.contains("01"))
        assertTrue(service.appels.isEmpty())
    }

    @Test
    fun `le numéro est normalisé puis le code est vérifié avec l'appareil`() = runTest {
        var appareilRecu: Appareil? = null
        service.reponseVerification = { t, _, a ->
            appareilRecu = a
            Resultat.Succes(ResultatVerification.Connecte("jeton", ServiceTesteurFactice.profil(t)))
        }
        val m = modele()
        m.saisirTelephone("01 97 00 00 00")
        m.envoyerCode()
        runCurrent()
        assertEquals(EtapeConnexion.Code, m.etat.value.etape)
        assertEquals("+2290197000000", m.etat.value.telephoneNormalise)
        assertEquals(60, m.etat.value.renvoiDans)

        m.saisirCode("48 29-13")
        assertEquals("482913", m.etat.value.code)
        m.verifierCode()
        advanceUntilIdle()
        assertEquals("+2290197000000", connecte?.telephone)
        assertEquals(appareil, appareilRecu)
        assertEquals(listOf("envoi:+2290197000000", "verification:+2290197000000:482913"), service.appels)
    }

    @Test
    fun `numéro inconnu, vers l'inscription`() = runTest {
        service.reponseVerification = { _, _, _ -> Resultat.Succes(ResultatVerification.Inscription("jeton-inscription", 1800)) }
        val m = modele()
        m.saisirTelephone("0197000000")
        m.envoyerCode()
        runCurrent()
        m.saisirCode("123456")
        m.verifierCode()
        advanceUntilIdle()
        assertEquals("+2290197000000" to "jeton-inscription", inscription)
        assertNull(connecte)
    }

    @Test
    fun `code faux, essais restants affichés et champ vidé`() = runTest {
        service.reponseVerification = { _, _, _ -> Resultat.Echec(ErreurApi.Http(400, "code_invalide", tentativesRestantes = 2)) }
        val m = modele()
        m.saisirTelephone("0197000000")
        m.envoyerCode()
        runCurrent()
        m.saisirCode("000000")
        m.verifierCode()
        runCurrent()
        assertEquals("Code incorrect. Il vous reste 2 essais.", m.etat.value.erreurCode)
        assertEquals("", m.etat.value.code)
    }

    @Test
    fun `code incomplet refusé sans appel`() = runTest {
        val m = modele()
        m.saisirTelephone("0197000000")
        m.envoyerCode()
        runCurrent()
        m.saisirCode("123")
        m.verifierCode()
        assertEquals("Le code contient 6 chiffres.", m.etat.value.erreurCode)
        assertEquals(1, service.appels.size)
    }

    @Test
    fun `le renvoi attend la fin du compte à rebours`() = runTest {
        val m = modele()
        m.saisirTelephone("0197000000")
        m.envoyerCode()
        runCurrent()
        m.renvoyerCode()
        assertEquals(1, service.appels.size)
        advanceTimeBy(30_000)
        runCurrent()
        assertEquals(30, m.etat.value.renvoiDans)
        advanceTimeBy(31_000)
        runCurrent()
        assertEquals(0, m.etat.value.renvoiDans)
        m.renvoyerCode()
        runCurrent()
        assertEquals(2, service.appels.size)
    }

    @Test
    fun `trop de demandes, message avec le délai`() = runTest {
        service.reponseEnvoi = { Resultat.Echec(ErreurApi.Http(429, "trop_de_requetes", reessayerDans = 120)) }
        val m = modele()
        m.saisirTelephone("0197000000")
        m.envoyerCode()
        runCurrent()
        assertEquals("Trop de tentatives. Réessayez dans 2 minutes.", m.etat.value.message)
        assertEquals(EtapeConnexion.Telephone, m.etat.value.etape)
    }

    @Test
    fun `erreur de champ du serveur affichée sous le numéro`() = runTest {
        service.reponseEnvoi = { Resultat.Echec(ErreurApi.Http(422, "validation", champs = mapOf("telephone" to "format_invalide"))) }
        val m = modele()
        m.saisirTelephone("0197000000")
        m.envoyerCode()
        runCurrent()
        assertNotNull(m.etat.value.erreurTelephone)
        assertNull(m.etat.value.message)
    }

    @Test
    fun `modifier le numéro revient à la première étape`() = runTest {
        val m = modele()
        m.saisirTelephone("0197000000")
        m.envoyerCode()
        runCurrent()
        m.modifierNumero()
        assertEquals(EtapeConnexion.Telephone, m.etat.value.etape)
        assertEquals(0, m.etat.value.renvoiDans)
        assertEquals("0197000000", m.etat.value.telephone)
    }

    @Test
    fun `création de compte, l'opérateur est demandé avec le numéro puis transmis à l'inscription`() = runTest {
        service.reponseVerification = { _, _, _ -> Resultat.Succes(ResultatVerification.Inscription("jeton-inscription", 1800)) }
        var operateurTransmis: String? = null
        val m = ConnexionModele(
            service, { appareil }, porteeTest(),
            surConnecte = { connecte = it },
            surInscription = { _, _, o -> operateurTransmis = o },
            mode = ModeConnexion.Creation,
        )
        m.saisirTelephone("0197000000")
        m.envoyerCode()
        assertNotNull(m.etat.value.erreurOperateur)
        assertTrue(service.appels.isEmpty())

        m.choisirOperateur("moov")
        assertNull(m.etat.value.erreurOperateur)
        m.envoyerCode()
        runCurrent()
        m.saisirCode("482913")
        m.verifierCode()
        runCurrent()
        assertEquals("moov", operateurTransmis)
    }

    @Test
    fun `compte à rebours affiché comme sur la maquette`() {
        assertEquals("0:42", minutes(42))
        assertEquals("1:00", minutes(60))
        assertEquals("0:05", minutes(5))
    }
}
