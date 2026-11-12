package bj.nakayo.testeur.campagne

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import bj.nakayo.noyau.ErreurApi
import bj.nakayo.noyau.Resultat
import bj.nakayo.noyau.ServiceTesteur
import bj.nakayo.noyau.UsageJour
import bj.nakayo.testeur.NakayoApplication
import java.util.concurrent.TimeUnit

// Résultat d'un envoi, sans dépendance à WorkManager (testé sur la JVM).
enum class IssueEnvoi { Fait, Reessayer, Arrete }

// US-18 : envoie les cumuls du jour et de la veille pour les apps en cours de test.
// Les cumuls sont relus à chaque fois dans Android : rien n'est perdu quand le réseau manque.
suspend fun envoyerUsages(service: ServiceTesteur, mesurer: (Set<String>) -> List<UsageJour>): IssueEnvoi {
    if (!service.sessionOuverte()) return IssueEnvoi.Arrete
    val apps = when (val r = service.mesApps()) {
        is Resultat.Succes -> r.valeur
        is Resultat.Echec -> return issue(r.erreur)
    }
    val paquets = apps.filter { it.installationConfirmee && !it.joursAcquis }.map { it.app.paquet }.toSet()
    val usages = mesurer(paquets)
    if (usages.isEmpty()) return IssueEnvoi.Fait
    return when (val r = service.envoyerUsages(usages)) {
        is Resultat.Succes -> IssueEnvoi.Fait
        is Resultat.Echec -> issue(r.erreur)
    }
}

private fun issue(erreur: ErreurApi): IssueEnvoi = when {
    erreur is ErreurApi.Reseau -> IssueEnvoi.Reessayer
    erreur is ErreurApi.Http && (erreur.statut == 401 || erreur.statut == 403) -> IssueEnvoi.Arrete
    erreur is ErreurApi.Http && erreur.statut >= 500 -> IssueEnvoi.Reessayer
    else -> IssueEnvoi.Fait
}

class TacheEnvoiUsages(contexte: Context, parametres: WorkerParameters) : CoroutineWorker(contexte, parametres) {
    override suspend fun doWork(): Result {
        val application = applicationContext as NakayoApplication
        val statistiques = StatistiquesUsage(applicationContext)
        return when (envoyerUsages(application.service) { statistiques.cumuls(it) }) {
            IssueEnvoi.Fait, IssueEnvoi.Arrete -> Result.success()
            IssueEnvoi.Reessayer -> Result.retry()
        }
    }
}

object PlanificationUsages {
    private const val PERIODIQUE = "usages-periodique"
    private const val IMMEDIAT = "usages-immediat"

    // Envoi toutes les heures (dès que le réseau revient), plus un envoi tout de suite.
    fun planifier(contexte: Context) {
        val reseau = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
        val wm = WorkManager.getInstance(contexte)
        wm.enqueueUniquePeriodicWork(
            PERIODIQUE,
            ExistingPeriodicWorkPolicy.KEEP,
            PeriodicWorkRequestBuilder<TacheEnvoiUsages>(1, TimeUnit.HOURS)
                .setConstraints(reseau)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.MINUTES)
                .build(),
        )
        wm.enqueueUniqueWork(
            IMMEDIAT,
            ExistingWorkPolicy.REPLACE,
            OneTimeWorkRequestBuilder<TacheEnvoiUsages>()
                .setConstraints(reseau)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES)
                .build(),
        )
    }

}
