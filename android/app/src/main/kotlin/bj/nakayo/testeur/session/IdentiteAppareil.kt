package bj.nakayo.testeur.session

import android.os.Build
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import bj.nakayo.noyau.Appareil
import kotlinx.coroutines.flow.first
import java.util.UUID

// Appareil envoyé à l'API (§4.2). L'identifiant est tiré au hasard à la première ouverture de l'app :
// ce n'est ni l'IMEI ni un identifiant publicitaire, il sert seulement au contrôle d'appareil partagé (US-07).
// `memoireTotale` : mémoire vive totale en octets (US-35), null si Android ne la donne pas.
class IdentiteAppareil(
    private val donnees: DataStore<Preferences>,
    private val memoireTotale: () -> Long? = { null },
) {

    suspend fun appareil(): Appareil = Appareil(
        fabricant = Build.MANUFACTURER?.takeIf { it.isNotBlank() }?.take(60),
        modele = (Build.MODEL?.takeIf { it.isNotBlank() } ?: "inconnu").take(80),
        versionAndroid = (Build.VERSION.RELEASE ?: Build.VERSION.SDK_INT.toString()).take(20),
        niveauApi = Build.VERSION.SDK_INT,
        identifiant = identifiant(),
        ramMo = ramMo(memoireTotale()),
    )

    suspend fun identifiant(): String {
        donnees.data.first()[CLE]?.let { return it }
        val nouveau = "app-" + UUID.randomUUID().toString()
        var retenu = nouveau
        donnees.edit { prefs -> retenu = prefs[CLE] ?: nouveau.also { prefs[CLE] = it } }
        return retenu
    }

    companion object {
        // Octets -> Mo, dans les bornes du contrat (256 Mo à 64 Go), sinon null.
        fun ramMo(octets: Long?): Int? = octets?.let { (it / (1024 * 1024)).toInt() }?.takeIf { it in 256..65536 }

        private val CLE = stringPreferencesKey("identifiant_appareil")
    }
}
