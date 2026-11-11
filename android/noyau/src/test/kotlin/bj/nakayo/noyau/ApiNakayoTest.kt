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
}
