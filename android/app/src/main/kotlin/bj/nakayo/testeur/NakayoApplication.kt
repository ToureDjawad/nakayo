package bj.nakayo.testeur

import android.app.Application
import android.content.Context
import androidx.datastore.preferences.preferencesDataStore
import bj.nakayo.noyau.ApiNakayo
import bj.nakayo.noyau.ServiceTesteur
import bj.nakayo.testeur.campagne.OutilsAndroid
import bj.nakayo.testeur.campagne.OutilsApps
import bj.nakayo.testeur.session.IdentiteAppareil
import bj.nakayo.testeur.session.StockageJetonChiffre

private val Context.donneesSession by preferencesDataStore(name = "session")
private val Context.donneesAppareil by preferencesDataStore(name = "appareil")

// Objets partagés par toute l'app, créés une seule fois.
class NakayoApplication : Application() {
    val stockageJeton by lazy { StockageJetonChiffre(donneesSession) }
    val identiteAppareil by lazy { IdentiteAppareil(donneesAppareil) }
    val api by lazy { ApiNakayo(BuildConfig.API_URL, stockageJeton) }

    // Apps installées et position ; les tests instrumentés peuvent les remplacer.
    var outils: OutilsApps = OutilsAndroid(this)

    // Point d'entrée des écrans ; les tests instrumentés peuvent le remplacer avant le lancement.
    var service: ServiceTesteur
        get() = serviceRemplace ?: api
        set(valeur) { serviceRemplace = valeur }
    private var serviceRemplace: ServiceTesteur? = null
}
