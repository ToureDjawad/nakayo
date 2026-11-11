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
class IdentiteAppareil(private val donnees: DataStore<Preferences>) {

    suspend fun appareil(): Appareil = Appareil(
        fabricant = Build.MANUFACTURER?.takeIf { it.isNotBlank() }?.take(60),
        modele = (Build.MODEL?.takeIf { it.isNotBlank() } ?: "inconnu").take(80),
        versionAndroid = (Build.VERSION.RELEASE ?: Build.VERSION.SDK_INT.toString()).take(20),
        niveauApi = Build.VERSION.SDK_INT,
        identifiant = identifiant(),
    )

    suspend fun identifiant(): String {
        donnees.data.first()[CLE]?.let { return it }
        val nouveau = "app-" + UUID.randomUUID().toString()
        var retenu = nouveau
        donnees.edit { prefs -> retenu = prefs[CLE] ?: nouveau.also { prefs[CLE] = it } }
        return retenu
    }

    private companion object {
        val CLE = stringPreferencesKey("identifiant_appareil")
    }
}
