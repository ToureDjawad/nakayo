package bj.nakayo.noyau

import kotlinx.coroutines.runBlocking
import org.junit.AfterClass
import org.junit.BeforeClass
import java.io.File
import java.net.ServerSocket
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.util.Collections
import kotlin.random.Random
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

// Bout en bout : le client Kotlin parle au vrai serveur Node (node src/index.js) branché sur la base de test.
// Les SMS ne partent pas en test : le code est lu dans le journal du serveur, comme dans les tests de l'API.
class ApiReelleTest {
    companion object {
        private val racine = File(System.getProperty("nakayo.racine") ?: error("nakayo.racine manquant"))
        private val dossierServeur = File(racine, "server")
        private val journal: MutableList<String> = Collections.synchronizedList(mutableListOf())
        private lateinit var processus: Process
        private lateinit var url: String

        private fun environnement() = mapOf(
            "NODE_ENV" to "test",
            "DATABASE_URL" to System.getenv("DATABASE_URL_TEST"),
            "CONTROLES_RESEAU" to "false",
        )

        @BeforeClass
        @JvmStatic
        fun demarrer() {
            val migration = ProcessBuilder("node", "src/db/migrate.js").directory(dossierServeur).redirectErrorStream(true)
            migration.environment().putAll(environnement())
            val sortie = migration.start()
            val texte = sortie.inputStream.bufferedReader().readText()
            check(sortie.waitFor() == 0) { "Migrations impossibles :\n$texte" }

            val port = ServerSocket(0).use { it.localPort }
            url = "http://127.0.0.1:$port"
            val serveur = ProcessBuilder("node", "src/index.js").directory(dossierServeur).redirectErrorStream(true)
            serveur.environment().putAll(environnement() + ("PORT" to port.toString()))
            processus = serveur.start()
            Thread { processus.inputStream.bufferedReader().forEachLine { journal.add(it) } }.apply { isDaemon = true }.start()

            val http = HttpClient.newHttpClient()
            repeat(100) {
                try {
                    val r = http.send(HttpRequest.newBuilder(URI("$url/api/health")).build(), HttpResponse.BodyHandlers.discarding())
                    if (r.statusCode() == 200) return
                } catch (_: java.io.IOException) {
                    // pas encore prêt
                }
                check(processus.isAlive) { "Le serveur s'est arrêté :\n${journal.joinToString("\n")}" }
                Thread.sleep(100)
            }
            error("Le serveur ne répond pas :\n${journal.joinToString("\n")}")
        }

        @AfterClass
        @JvmStatic
        fun arreter() {
            if (::processus.isInitialized) processus.destroy()
        }
    }

    // Numéro neuf à chaque test : pas d'interférence avec les limites d'envoi ni avec d'autres données.
    private fun nouveauNumero() = "+22901" + (1..8).map { Random.nextInt(10) }.joinToString("")
    private val appareil = Appareil("Tecno", "Spark 20", "14", 34, "app-" + Random.nextLong(1_000_000_000L, 9_999_999_999L))

    private fun dernierCode(telephone: String): String {
        repeat(40) {
            val ligne = synchronized(journal) { journal.indexOfLast { it.contains("[sms] à $telephone") } }
            if (ligne >= 0) {
                val code = synchronized(journal) { journal.drop(ligne).firstNotNullOfOrNull { Regex("code est (\\d{6})").find(it) } }
                if (code != null) return code.groupValues[1]
            }
            Thread.sleep(50)
        }
        error("Code SMS absent du journal pour $telephone")
    }

    @Test
    fun `l'API et la base répondent`() = runBlocking<Unit> {
        assertEquals(Resultat.Succes(Sante("ok", "ok")), ApiNakayo(url, StockageJetonMemoire()).sante())
    }

    @Test
    fun `nouveau numéro, code SMS puis jeton d'inscription`() = runBlocking<Unit> {
        val stockage = StockageJetonMemoire()
        val api = ApiNakayo(url, stockage)
        val telephone = nouveauNumero()

        val envoi = api.envoyerCode(telephone)
        assertEquals(Resultat.Succes(EnvoiCode(600, 60)), envoi)

        val resultat = api.verifierCode(telephone, dernierCode(telephone), appareil)
        val inscription = assertIs<ResultatVerification.Inscription>((resultat as Resultat.Succes).valeur)
        assertTrue(inscription.jetonInscription.isNotBlank())
        assertEquals(1800, inscription.expireDans)
        assertNull(stockage.lire())
    }

    @Test
    fun `mauvais code, tentatives restantes, puis second envoi refusé avec un délai`() = runBlocking<Unit> {
        val api = ApiNakayo(url, StockageJetonMemoire())
        val telephone = nouveauNumero()
        api.envoyerCode(telephone)
        val bon = dernierCode(telephone)
        val faux = if (bon == "000000") "111111" else "000000"

        val erreur = (api.verifierCode(telephone, faux, appareil) as Resultat.Echec).erreur as ErreurApi.Http
        assertEquals(400, erreur.statut)
        assertEquals("code_invalide", erreur.code)
        assertEquals(4, erreur.tentativesRestantes)

        val limite = (api.envoyerCode(telephone) as Resultat.Echec).erreur as ErreurApi.Http
        assertEquals("trop_de_requetes", limite.code)
        assertNotNull(limite.reessayerDans)
    }

    @Test
    fun `numéro mal formé, erreur de champ du contrat`() = runBlocking<Unit> {
        val erreur = (ApiNakayo(url, StockageJetonMemoire()).envoyerCode("+2250197000000") as Resultat.Echec).erreur as ErreurApi.Http
        assertEquals(422, erreur.statut)
        assertEquals(mapOf("telephone" to "format_invalide"), erreur.champs)
    }

    @Test
    fun `jeton inconnu, 401 et jeton local effacé`() = runBlocking<Unit> {
        val stockage = StockageJetonMemoire("jeton-qui-n-existe-pas")
        val erreur = (ApiNakayo(url, stockage).moi() as Resultat.Echec).erreur as ErreurApi.Http
        assertEquals("non_authentifie", erreur.code)
        assertNull(stockage.lire())
    }

    @Test
    fun `inscription complète avec photos, puis langues et demande de changement MoMo`() = runBlocking<Unit> {
        val stockage = StockageJetonMemoire()
        val api = ApiNakayo(url, stockage)
        val telephone = nouveauNumero()
        api.envoyerCode(telephone)
        val verification = (api.verifierCode(telephone, dernierCode(telephone), appareil) as Resultat.Succes).valeur
        val jetonInscription = assertIs<ResultatVerification.Inscription>(verification).jetonInscription

        // Le serveur vérifie la signature JPEG, pas le contenu de l'image.
        val jpeg = Photo(byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte(), 0xE0.toByte()) + ByteArray(200))
        val formulaire = FormulaireInscription(
            nom = "Afi Dossou",
            ville = "Cotonou",
            gmail = "afi.${Random.nextLong(1_000_000L, 9_999_999L)}@gmail.com",
            numeroMomo = telephone,
            operateurMomo = "mtn",
            appareil = appareil,
            consentementSuivi = true,
            accepteConditions = true,
        )
        val profil = (api.inscrire(jetonInscription, formulaire, jpeg, jpeg) as Resultat.Succes).valeur
        assertEquals("en_attente", profil.statut)
        assertEquals(telephone, profil.numeroMomo)
        assertNotNull(stockage.lire())

        // Le jeton d'inscription ne sert qu'une fois.
        val rejoue = (api.inscrire(jetonInscription, formulaire, jpeg, jpeg) as Resultat.Echec).erreur as ErreurApi.Http
        assertEquals(401, rejoue.statut)
        assertNotNull(stockage.lire())

        val modifie = (api.modifierProfil(langues = listOf("fr", "en")) as Resultat.Succes).valeur
        assertEquals(listOf("fr", "en"), modifie.langues)

        val demande = (api.demanderChangementMomo(nouveauNumero(), "moov", "Je change de puce Mobile Money") as Resultat.Succes).valeur
        assertEquals("en_attente", demande.statut)
        assertEquals(demande.id, (api.moi() as Resultat.Succes).valeur.demandeChangementMomo?.id)

        val doublon = (api.demanderChangementMomo(nouveauNumero(), "moov", "Une seconde demande") as Resultat.Echec).erreur as ErreurApi.Http
        assertEquals("statut_incompatible", doublon.code)

        // Sprint 3 : tant que le compte n'est pas validé, pas d'apps à tester ni de signal.
        for (refus in listOf(api.mesApps(), api.signaler(), api.envoyerUsages(listOf(UsageJour("bj.exemple", "2026-11-12", 60))))) {
            val erreur = (refus as Resultat.Echec).erreur as ErreurApi.Http
            assertEquals(403 to "compte_non_valide", erreur.statut to erreur.code)
        }
    }
}
