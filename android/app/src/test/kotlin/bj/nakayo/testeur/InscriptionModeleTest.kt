package bj.nakayo.testeur

import bj.nakayo.noyau.Appareil
import bj.nakayo.noyau.ErreurApi
import bj.nakayo.noyau.ProfilTesteur
import bj.nakayo.noyau.Resultat
import bj.nakayo.noyau.ServiceTesteurFactice
import bj.nakayo.testeur.ui.inscription.AUTRE_VILLE
import bj.nakayo.testeur.ui.inscription.ChampPhoto
import bj.nakayo.testeur.ui.inscription.EtapeInscription
import bj.nakayo.testeur.ui.inscription.InscriptionModele
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import java.io.File
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class InscriptionModeleTest {
    private val service = ServiceTesteurFactice()
    private val appareil = Appareil("Tecno", "Spark 10", "13", 33, "app-test-identifiant")
    private var inscrit: ProfilTesteur? = null
    private var expire: String? = null
    private var quitte = false
    private val compressees = mutableListOf<File>()

    private fun TestScope.modele(operateur: String? = "mtn", compresser: (File) -> ByteArray = { f -> compressees += f; byteArrayOf(0xFF.toByte(), 0xD8.toByte()) }) =
        InscriptionModele(
            service = service,
            appareil = { appareil },
            portee = porteeTest(),
            telephone = "+2290197000000",
            jetonInscription = "jeton-inscription",
            operateur = operateur,
            surInscrit = { inscrit = it },
            surJetonExpire = { expire = it },
            surQuitter = { quitte = true },
            compresser = compresser,
            calcul = StandardTestDispatcher(testScheduler),
        )

    private fun fichier(): File = kotlin.io.path.createTempFile("photo", ".jpg").toFile().apply { writeBytes(byteArrayOf(1, 2, 3)) }

    private fun InscriptionModele.profilValide() {
        saisirNom("  Afi Dossou ")
        choisirVille("Cotonou")
        saisirGmail(" Afi.Dossou@Gmail.com ")
        choisirAncienneteGmail("plus_6_mois")
    }

    @Test
    fun `le profil est vérifié sur place avec les règles du serveur`() = runTest {
        val m = modele(operateur = null)
        m.basculerLangue("fr")
        m.saisirGmail("afi.dossou@gmail")
        m.continuer()
        val erreurs = m.etat.value.erreurs
        assertEquals("requis", erreurs["nom"])
        assertEquals("requis", erreurs["ville"])
        assertEquals("format_invalide", erreurs["gmail"])
        assertEquals("requis", erreurs["ancienneteGmail"])
        assertEquals("requis", erreurs["operateurMomo"])
        assertEquals("requis", erreurs["langues"])
        assertEquals(EtapeInscription.Profil, m.etat.value.etape)

        m.saisirGmail("afi@yahoo.fr")
        m.continuer()
        assertEquals("non_gmail", m.etat.value.erreurs["gmail"])
        m.choisirVille(AUTRE_VILLE)
        m.continuer()
        assertEquals("requis", m.etat.value.erreurs["ville"])
        assertTrue(service.appels.isEmpty())
    }

    @Test
    fun `parcours complet, photos réduites, consentements, envoi puis langues`() = runTest {
        val m = modele()
        advanceUntilIdle()
        assertEquals(appareil, m.etat.value.appareil)
        m.profilValide()
        m.basculerLangue("en")
        m.continuer()
        assertEquals(EtapeInscription.Pieces, m.etat.value.etape)

        m.envoyer()
        assertEquals(setOf("pieceIdentite", "selfie", "accepteConditions", "consentementSuivi"), m.etat.value.erreurs.keys)

        val piece = fichier()
        val selfie = fichier()
        m.photoPrise(ChampPhoto.PieceIdentite, piece)
        assertEquals(ChampPhoto.PieceIdentite, m.etat.value.photoEnPreparation)
        advanceUntilIdle()
        m.photoPrise(ChampPhoto.Selfie, selfie)
        advanceUntilIdle()
        assertNull(m.etat.value.photoEnPreparation)
        assertNotNull(m.etat.value.pieceIdentite)
        // Les fichiers bruts de l'appareil photo sont supprimés après réduction.
        assertFalse(piece.exists())
        assertFalse(selfie.exists())

        m.accepterConditions(true)
        m.consentirSuivi(true)
        m.envoyer()
        advanceUntilIdle()

        val f = service.dernierFormulaire!!
        assertEquals("Afi Dossou", f.nom)
        assertEquals("Cotonou", f.ville)
        assertEquals("afi.dossou@gmail.com", f.gmail)
        assertEquals("plus_6_mois", f.ancienneteGmail)
        assertEquals("+2290197000000", f.numeroMomo)
        assertEquals("mtn", f.operateurMomo)
        assertEquals(appareil, f.appareil)
        assertTrue(f.accepteConditions && f.consentementSuivi)
        assertContentEquals(byteArrayOf(0xFF.toByte(), 0xD8.toByte()), service.dernieresPhotos!!.first.octets)
        assertTrue("inscription:jeton-inscription" in service.appels)
        assertTrue("profil:langues=fr,en" in service.appels)
        assertEquals(listOf("fr", "en"), inscrit!!.langues)
    }

    @Test
    fun `photo illisible, erreur sur le champ`() = runTest {
        val m = modele(compresser = { throw IllegalArgumentException("Image illisible") })
        m.profilValide()
        m.continuer()
        m.photoPrise(ChampPhoto.Selfie, fichier())
        advanceUntilIdle()
        assertEquals("illisible", m.etat.value.erreurs["selfie"])
        assertNull(m.etat.value.selfie)
    }

    private fun TestScope.pret(m: InscriptionModele) {
        m.profilValide()
        m.continuer()
        m.photoPrise(ChampPhoto.PieceIdentite, fichier())
        m.photoPrise(ChampPhoto.Selfie, fichier())
        advanceUntilIdle()
        m.accepterConditions(true)
        m.consentirSuivi(true)
    }

    @Test
    fun `code de parrainage facultatif, nettoyé, vérifié puis envoyé (US-39)`() = runTest {
        val m = modele()
        m.profilValide()
        m.saisirCodeParrainage("k7q-2m")
        m.continuer()
        assertEquals("format_invalide", m.etat.value.erreurs["codeParrainage"])
        m.saisirCodeParrainage("k7q 2mp")
        assertEquals("K7Q2MP", m.etat.value.codeParrainage)
        pret(m)
        m.envoyer()
        advanceUntilIdle()
        assertEquals("K7Q2MP", service.dernierFormulaire?.codeParrainage)
    }

    @Test
    fun `code de parrainage inconnu du serveur, retour au profil`() = runTest {
        service.reponseInscription = { Resultat.Echec(ErreurApi.Http(422, "validation", champs = mapOf("codeParrainage" to "inconnu"))) }
        val m = modele()
        pret(m)
        m.saisirCodeParrainage("ZZZZ22")
        m.envoyer()
        advanceUntilIdle()
        assertEquals(EtapeInscription.Profil, m.etat.value.etape)
        assertEquals("inconnu", m.etat.value.erreurs["codeParrainage"])
    }

    @Test
    fun `Gmail déjà utilisé, retour au profil avec l'erreur sur le champ`() = runTest {
        service.reponseInscription = { Resultat.Echec(ErreurApi.Http(409, "conflit", champs = mapOf("gmail" to "deja_utilise"))) }
        val m = modele()
        pret(m)
        m.envoyer()
        advanceUntilIdle()
        assertEquals(EtapeInscription.Profil, m.etat.value.etape)
        assertEquals("deja_utilise", m.etat.value.erreurs["gmail"])
        assertFalse(m.etat.value.enCours)
        assertNull(inscrit)
    }

    @Test
    fun `numéro MoMo déjà utilisé, message en bandeau`() = runTest {
        service.reponseInscription = { Resultat.Echec(ErreurApi.Http(409, "conflit", champs = mapOf("numeroMomo" to "deja_utilise"))) }
        val m = modele()
        pret(m)
        m.envoyer()
        advanceUntilIdle()
        assertEquals(EtapeInscription.Pieces, m.etat.value.etape)
        assertTrue(m.etat.value.message!!.contains("déjà utilisé"))
    }

    @Test
    fun `délai d'inscription dépassé, retour au numéro`() = runTest {
        service.reponseInscription = { Resultat.Echec(ErreurApi.Http(401, "non_authentifie")) }
        val m = modele()
        pret(m)
        m.envoyer()
        advanceUntilIdle()
        assertTrue(expire!!.contains("30 minutes"))
    }

    @Test
    fun `sans réseau, on reste sur l'écran pour réessayer`() = runTest {
        service.reponseInscription = { Resultat.Echec(ErreurApi.Reseau) }
        val m = modele()
        pret(m)
        m.envoyer()
        advanceUntilIdle()
        assertTrue(m.etat.value.message!!.contains("connexion"))
        assertNotNull(m.etat.value.pieceIdentite)
    }

    @Test
    fun `retour, des pièces au profil, puis sortie`() = runTest {
        val m = modele()
        m.profilValide()
        m.continuer()
        m.retour()
        assertEquals(EtapeInscription.Profil, m.etat.value.etape)
        assertFalse(quitte)
        m.retour()
        assertTrue(quitte)
    }

    @Test
    fun `opérateur demandé sur le profil quand il n'a pas été choisi avant`() = runTest {
        val m = modele(operateur = null)
        assertFalse(m.operateurDejaChoisi)
        m.profilValide()
        m.continuer()
        assertEquals(EtapeInscription.Profil, m.etat.value.etape)
        m.choisirOperateur("moov")
        m.continuer()
        assertEquals(EtapeInscription.Pieces, m.etat.value.etape)
    }
}
