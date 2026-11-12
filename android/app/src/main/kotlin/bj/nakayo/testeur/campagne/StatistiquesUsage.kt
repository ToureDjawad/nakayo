package bj.nakayo.testeur.campagne

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.os.Build
import android.os.Process
import bj.nakayo.noyau.UsageJour
import java.time.Instant

// Temps passé dans les apps testées, lu dans les statistiques d'usage d'Android (accès donné par le testeur
// dans les réglages). Rien d'autre n'est lu ni envoyé : seulement les apps en cours de test.
class StatistiquesUsage(private val contexte: Context) {
    fun autorisee(): Boolean {
        val ops = contexte.getSystemService(AppOpsManager::class.java) ?: return false
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), contexte.packageName)
        } else {
            @Suppress("DEPRECATION")
            ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), contexte.packageName)
        }
        return mode == AppOpsManager.MODE_ALLOWED
    }

    // Cumul d'hier et d'aujourd'hui (heure du Bénin) pour chaque app testée, en secondes.
    fun cumuls(paquets: Set<String>, maintenant: Instant = Instant.now()): List<UsageJour> {
        if (paquets.isEmpty() || !autorisee()) return emptyList()
        val usm = contexte.getSystemService(UsageStatsManager::class.java) ?: return emptyList()
        return joursAMesurer(maintenant).flatMap { jour ->
            val cumul = cumulerPremierPlan(evenements(usm, jour.debut, jour.fin, paquets), jour.debut, jour.fin)
            paquets.map { UsageJour(it, jour.jour, ((cumul[it] ?: 0L) / 1000).toInt().coerceIn(0, 86_400)) }
        }
    }

    private fun evenements(usm: UsageStatsManager, debut: Long, fin: Long, paquets: Set<String>): List<EvenementUsage> {
        val resultat = mutableListOf<EvenementUsage>()
        val flux = usm.queryEvents(debut, fin) ?: return resultat
        val e = UsageEvents.Event()
        while (flux.hasNextEvent()) {
            flux.getNextEvent(e)
            if (e.packageName !in paquets) continue
            @Suppress("DEPRECATION")
            when (e.eventType) {
                UsageEvents.Event.MOVE_TO_FOREGROUND -> resultat += EvenementUsage(e.packageName, true, e.timeStamp)
                UsageEvents.Event.MOVE_TO_BACKGROUND -> resultat += EvenementUsage(e.packageName, false, e.timeStamp)
            }
        }
        return resultat
    }
}
