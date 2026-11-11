package bj.nakayo.testeur

import android.os.Build
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import bj.nakayo.testeur.session.IdentiteAppareil
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue

@RunWith(AndroidJUnit4::class)
class IdentiteAppareilTest {
    private val contexte = InstrumentationRegistry.getInstrumentation().targetContext
    private val portee = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val fichier = File(contexte.filesDir, "test-appareil-${UUID.randomUUID()}.preferences_pb")
    private val identite = IdentiteAppareil(PreferenceDataStoreFactory.create(scope = portee) { fichier })

    @After
    fun nettoyer() {
        portee.cancel()
        fichier.delete()
    }

    @Test
    fun identifiantStableEtConformeAuContrat() = runBlocking {
        val premier = identite.identifiant()
        assertEquals(premier, identite.identifiant())
        assertTrue(premier.length in 8..128)
        assertTrue(premier.startsWith("app-"))
    }

    @Test
    fun decritLeTelephoneSansIdentifiantMateriel() = runBlocking {
        val appareil = identite.appareil()
        assertEquals(Build.VERSION.SDK_INT, appareil.niveauApi)
        assertTrue(appareil.modele.isNotBlank() && appareil.modele.length <= 80)
        assertTrue(appareil.versionAndroid.isNotBlank() && appareil.versionAndroid.length <= 20)
        assertTrue(appareil.identifiant!!.startsWith("app-"))
    }
}
