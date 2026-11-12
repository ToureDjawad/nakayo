package bj.nakayo.noyau

import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.SocketPolicy
import org.junit.After
import org.junit.Before
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

// Le client contre un faux serveur HTTP : forme des requêtes, lecture des réponses et des erreurs.
class ApiNakayoTest {
    private lateinit var serveur: MockWebServer
    private lateinit var stockage: StockageJetonMemoire
    private lateinit var api: ApiNakayo

    private val appareil = Appareil("Tecno", "Spark 20", "14", 34, "app-8f3c2b1a9d")
    private val profil = """{"id":"77","role":"testeur","statut":"en_attente","telephone":"+2290197000000","nom":"Koffi Agbo",
        |"ville":"Cotonou","langues":["fr"],"appareil":{"fabricant":"Tecno","modele":"Spark 20","versionAndroid":"14","niveauApi":34},
        |"demandeChangementMomo":null,"motifRefus":null,"creeLe":"2026-11-10T14:07:01.512Z","champFutur":true}""".trimMargin()

    @Before
    fun demarrer() {
        serveur = MockWebServer().apply { start() }
        stockage = StockageJetonMemoire()
        api = ApiNakayo(serveur.url("/").toString(), stockage)
    }

    @After
    fun arreter() = serveur.shutdown()

    private fun repondre(statut: Int, corps: String) = serveur.enqueue(MockResponse().setResponseCode(statut).setBody(corps))

    @Test
    fun `envoi du code SMS`() = runTest {
        repondre(202, """{"expireDans":600,"renvoiPossibleDans":60}""")
        assertEquals(Resultat.Succes(EnvoiCode(600, 60)), api.envoyerCode("+2290197000000"))
        val requete = serveur.takeRequest()
        assertEquals("POST", requete.method)
        assertEquals("/api/auth/sms/envoi", requete.path)
        assertEquals("""{"telephone":"+2290197000000"}""", requete.body.readUtf8())
        assertEquals("application/json; charset=utf-8", requete.getHeader("Content-Type"))
        assertNull(requete.getHeader("Authorization"))
    }

    @Test
    fun `numéro connu, la session est ouverte et le jeton gardé`() = runTest {
        repondre(200, """{"resultat":"connecte","jeton":"jeton-secret","utilisateur":$profil}""")
        val resultat = api.verifierCode("+2290197000000", "482913", appareil)
        val connecte = assertIs<ResultatVerification.Connecte>((resultat as Resultat.Succes).valeur)
        assertEquals("Koffi Agbo", connecte.utilisateur.nom)
        assertEquals("jeton-secret", stockage.lire())

        val corps = Json.parseToJsonElement(serveur.takeRequest().body.readUtf8()).jsonObject
        assertEquals("482913", corps["code"]!!.jsonPrimitive.content)
        assertEquals(34, corps["appareil"]!!.jsonObject["niveauApi"]!!.jsonPrimitive.int)
    }

    @Test
    fun `numéro inconnu, jeton d'inscription, pas de session`() = runTest {
        repondre(200, """{"resultat":"inscription","jetonInscription":"jeton-inscription","expireDans":1800}""")
        assertEquals(
            Resultat.Succes(ResultatVerification.Inscription("jeton-inscription", 1800)),
            api.verifierCode("+2290197000000", "482913", appareil),
        )
        assertNull(stockage.lire())
    }

    @Test
    fun `le profil est demandé avec le jeton Bearer`() = runTest {
        stockage.ecrire("jeton-secret")
        repondre(200, """{"utilisateur":$profil}""")
        val resultat = api.moi() as Resultat.Succes
        assertEquals(listOf("fr"), resultat.valeur.langues)
        assertEquals("Bearer jeton-secret", serveur.takeRequest().getHeader("Authorization"))
    }

    @Test
    fun `une session expirée efface le jeton gardé`() = runTest {
        stockage.ecrire("jeton-perime")
        repondre(401, """{"erreur":{"code":"non_authentifie","message":"Session absente ou expirée."}}""")
        val erreur = (api.moi() as Resultat.Echec).erreur as ErreurApi.Http
        assertEquals("non_authentifie", erreur.code)
        assertNull(stockage.lire())
    }

    @Test
    fun `trop de demandes, le délai Retry-After est remonté`() = runTest {
        serveur.enqueue(
            MockResponse().setResponseCode(429).setHeader("Retry-After", "37")
                .setBody("""{"erreur":{"code":"trop_de_requetes","message":"Trop de tentatives."}}"""),
        )
        val erreur = (api.envoyerCode("+2290197000000") as Resultat.Echec).erreur as ErreurApi.Http
        assertEquals(37, erreur.reessayerDans)
    }

    @Test
    fun `contact du support, sans jeton`() = runTest {
        stockage.ecrire("jeton-secret")
        repondre(200, """{"support":{"whatsapp":"+2290197000000"}}""")
        assertEquals(Resultat.Succes(Support("+2290197000000")), api.support())
        val requete = serveur.takeRequest()
        assertEquals("/api/support", requete.path)
        assertNull(requete.getHeader("Authorization"))

        repondre(200, """{"support":{"whatsapp":null}}""")
        assertEquals(Resultat.Succes(Support(null)), api.support())
    }

    @Test
    fun `message au support avec le jeton, puis historique`() = runTest {
        stockage.ecrire("jeton-secret")
        repondre(201, """{"ticket":{"id":"12","sujet":"Paiement","message":"Mon paiement n'est pas arrivé.","statut":"ouvert","creeLe":"2026-11-12T09:00:00.000Z","traiteLe":null}}""")
        val envoye = api.envoyerTicket("Paiement", "Mon paiement n'est pas arrivé.") as Resultat.Succes
        assertEquals("12", envoye.valeur.id)
        val requete = serveur.takeRequest()
        assertEquals("/api/tickets", requete.path)
        assertEquals("Bearer jeton-secret", requete.getHeader("Authorization"))
        assertEquals("""{"sujet":"Paiement","message":"Mon paiement n'est pas arrivé."}""", requete.body.readUtf8())

        repondre(200, """{"tickets":[]}""")
        assertEquals(Resultat.Succes(emptyList<Ticket>()), api.mesTickets())
        assertEquals("/api/tickets/moi", serveur.takeRequest().path)
    }

    @Test
    fun `coupure réseau`() = runTest {
        serveur.enqueue(MockResponse().setSocketPolicy(SocketPolicy.DISCONNECT_AT_START))
        assertEquals(Resultat.Echec(ErreurApi.Reseau), api.sante())
    }

    @Test
    fun `réponse de succès illisible`() = runTest {
        repondre(200, "pas du json")
        assertEquals(Resultat.Echec(ErreurApi.Inattendue(200)), api.sante())
    }

    @Test
    fun `la déconnexion envoie le jeton puis l'efface`() = runTest {
        stockage.ecrire("jeton-secret")
        repondre(204, "")
        api.deconnecter()
        val requete = serveur.takeRequest()
        assertEquals("/api/auth/deconnexion", requete.path)
        assertEquals("Bearer jeton-secret", requete.getHeader("Authorization"))
        assertNull(stockage.lire())
    }

    @Test
    fun `la déconnexion efface le jeton même si le serveur est injoignable`() = runTest {
        stockage.ecrire("jeton-secret")
        serveur.shutdown()
        api.deconnecter()
        assertNull(stockage.lire())
    }

    private val formulaire = FormulaireInscription(
        nom = "Koffi Agbo",
        ville = "Cotonou",
        gmail = "koffi.agbo@gmail.com",
        numeroMomo = "+2290197000000",
        operateurMomo = "mtn",
        appareil = appareil,
        consentementSuivi = true,
        accepteConditions = true,
    )

    @Test
    fun `inscription en multipart avec le jeton d'inscription, session gardée`() = runTest {
        repondre(201, """{"jeton":"jeton-session","utilisateur":$profil}""")
        val piece = Photo(byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte(), 1))
        val selfie = Photo(byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte(), 2))
        val resultat = api.inscrire("jeton-inscription", formulaire, piece, selfie)
        assertEquals("Koffi Agbo", (resultat as Resultat.Succes).valeur.nom)
        assertEquals("jeton-session", stockage.lire())

        val requete = serveur.takeRequest()
        assertEquals("/api/testeurs/inscription", requete.path)
        assertEquals("Bearer jeton-inscription", requete.getHeader("Authorization"))
        assertTrue(requete.getHeader("Content-Type")!!.startsWith("multipart/form-data; boundary="))
        val corps = requete.body.readUtf8()
        for (champ in listOf("nom", "ville", "gmail", "numeroMomo", "operateurMomo", "consentementSuivi", "accepteConditions", "appareil")) {
            assertTrue(corps.contains("name=\"$champ\""), "champ $champ absent")
        }
        assertTrue(corps.contains("name=\"pieceIdentite\"; filename=\"piece-identite.jpg\""))
        assertTrue(corps.contains("name=\"selfie\"; filename=\"selfie.jpg\""))
        assertTrue(corps.contains("Content-Type: image/jpeg"))
        assertTrue(corps.contains(""""identifiant":"app-8f3c2b1a9d""""))
    }

    @Test
    fun `inscription refusée, jeton d'inscription expiré, rien n'est gardé`() = runTest {
        repondre(401, """{"erreur":{"code":"non_authentifie","message":"Session expirée."}}""")
        val photo = Photo(byteArrayOf(1, 2, 3))
        val erreur = (api.inscrire("perime", formulaire, photo, photo) as Resultat.Echec).erreur as ErreurApi.Http
        assertEquals("non_authentifie", erreur.code)
        assertNull(stockage.lire())
    }

    @Test
    fun `modification des langues en PATCH, sans champ vide`() = runTest {
        stockage.ecrire("jeton-secret")
        repondre(200, """{"utilisateur":$profil}""")
        assertIs<Resultat.Succes<ProfilTesteur>>(api.modifierProfil(langues = listOf("fr", "en")))
        val requete = serveur.takeRequest()
        assertEquals("PATCH", requete.method)
        assertEquals("/api/testeurs/moi", requete.path)
        assertEquals("Bearer jeton-secret", requete.getHeader("Authorization"))
        assertEquals("""{"langues":["fr","en"]}""", requete.body.readUtf8())
    }

    @Test
    fun `demande de changement de numéro Mobile Money`() = runTest {
        stockage.ecrire("jeton-secret")
        repondre(201, """{"demande":{"id":"5","numeroMomo":"+2290196000000","operateurMomo":"moov","statut":"en_attente","creeLe":"2026-11-11T10:00:00.000Z"}}""")
        val demande = (api.demanderChangementMomo("+2290196000000", "moov", "Nouveau numéro professionnel") as Resultat.Succes).valeur
        assertEquals("en_attente", demande.statut)
        val requete = serveur.takeRequest()
        assertEquals("/api/testeurs/moi/demande-changement-momo", requete.path)
        assertEquals("""{"numeroMomo":"+2290196000000","operateurMomo":"moov","motif":"Nouveau numéro professionnel"}""", requete.body.readUtf8())
    }
}
