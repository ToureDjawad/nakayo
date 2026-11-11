package bj.nakayo.testeur

import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import bj.nakayo.testeur.session.StockageJetonChiffre
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.security.KeyStore
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull

// Sur un vrai Android : le Keystore n'existe pas sur la JVM.
@RunWith(AndroidJUnit4::class)
class StockageJetonChiffreTest {
    private val contexte = InstrumentationRegistry.getInstrumentation().targetContext
    private val portee = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val fichier = File(contexte.filesDir, "test-session-${UUID.randomUUID()}.preferences_pb")
    private val alias = "test_${UUID.randomUUID()}"
    private val donnees = PreferenceDataStoreFactory.create(scope = portee) { fichier }
    private val stockage = StockageJetonChiffre(donnees, alias)

    @After
    fun nettoyer() {
        portee.cancel()
        fichier.delete()
        KeyStore.getInstance("AndroidKeyStore").apply { load(null) }.deleteEntry(alias)
    }

    @Test
    fun ecritRelitEtEfface() = runBlocking {
        assertNull(stockage.lire())
        stockage.ecrire("jeton-de-session-secret")
        assertEquals("jeton-de-session-secret", stockage.lire())
        stockage.effacer()
        assertNull(stockage.lire())
    }

    @Test
    fun leJetonNApparaitPasEnClairDansLeFichier() = runBlocking {
        stockage.ecrire("jeton-de-session-secret")
        val brut = donnees.data.first().asMap().values.joinToString()
        assertFalse(brut.contains("jeton-de-session-secret"))
        assertFalse(fichier.readBytes().toString(Charsets.ISO_8859_1).contains("jeton-de-session-secret"))
    }

    @Test
    fun chaqueEcritureUtiliseUnNouveauVecteur() = runBlocking {
        stockage.ecrire("meme-jeton")
        val premier = donnees.data.first().asMap().values.single()
        stockage.ecrire("meme-jeton")
        val second = donnees.data.first().asMap().values.single()
        assertFalse(premier == second)
    }

    @Test
    fun uneDonneeAltereeEstEffaceeSansPlanter() = runBlocking {
        stockage.ecrire("jeton")
        donnees.edit { it[stringPreferencesKey("jeton_session_chiffre")] = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }
        assertNull(stockage.lire())
        assertEquals(emptyMap(), donnees.data.first().asMap())
    }
}
