package bj.nakayo.testeur.campagne

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import bj.nakayo.noyau.AffectationTesteur
import bj.nakayo.noyau.ErreurApi
import bj.nakayo.noyau.Resultat
import bj.nakayo.noyau.ServiceTesteur
import bj.nakayo.testeur.MainActivity
import bj.nakayo.testeur.NakayoApplication
import bj.nakayo.testeur.R
import java.time.Duration
import java.time.ZoneId
import java.time.ZonedDateTime
import java.util.concurrent.TimeUnit

// US-25 : rappel le soir (19 h puis 21 h, heure du Bénin) quand un rapport du jour manque.
// Le serveur envoie en plus un SMS de secours à 22 h (docs/api-sprint4.md §4).

val HEURES_RAPPEL = listOf(19, 21)
private val BENIN: ZoneId = ZoneId.of("Africa/Porto-Novo")

// Apps dont le rapport du jour manque : installées, 14 jours pas encore acquis, rapport pas envoyé.
fun appsSansRapport(apps: List<AffectationTesteur>): List<String> =
    apps.filter { it.installationConfirmee && !it.joursAcquis && !it.rapportDuJour }.map { it.app.nom }

data class Rappel(val titre: String, val texte: String)

// « Marché Facile », « Marché Facile et Zem Express », « A, B et C ».
fun enumerer(noms: List<String>): String = when (noms.size) {
    0 -> ""
    1 -> noms[0]
    else -> noms.dropLast(1).joinToString(", ") + " et " + noms.last()
}

fun rappel(noms: List<String>, heure: Int): Rappel? {
    if (noms.isEmpty()) return null
    val titre = if (heure >= 21) "Dernier rappel : rapport du jour à envoyer" else "Rapport du jour à envoyer"
    val apps = enumerer(noms)
    val texte = if (noms.size == 1) {
        "Il manque votre rapport pour $apps. Envoyez-le avant minuit pour garder votre compteur."
    } else {
        "Il manque vos rapports pour $apps. Envoyez-les avant minuit pour garder votre compteur."
    }
    return Rappel(titre, texte)
}

// Délai jusqu'à la prochaine `heure` pile au Bénin (le lendemain si elle est passée).
fun delaiJusqua(heure: Int, maintenant: ZonedDateTime = ZonedDateTime.now(BENIN)): Duration {
    val ici = maintenant.withZoneSameInstant(BENIN)
    var cible = ici.withHour(heure).withMinute(0).withSecond(0).withNano(0)
    if (!cible.isAfter(ici)) cible = cible.plusDays(1)
    return Duration.between(ici, cible)
}

// Ce que la tâche du soir doit faire, sans dépendance à Android (testé sur la JVM).
sealed interface IssueRappel {
    data object Rien : IssueRappel
    data object Reessayer : IssueRappel
    data class Notifier(val rappel: Rappel) : IssueRappel
}

suspend fun preparerRappel(service: ServiceTesteur, heure: Int): IssueRappel {
    if (!service.sessionOuverte()) return IssueRappel.Rien
    return when (val r = service.mesApps()) {
        is Resultat.Succes -> rappel(appsSansRapport(r.valeur), heure)?.let(IssueRappel::Notifier) ?: IssueRappel.Rien
        is Resultat.Echec -> {
            val e = r.erreur
            if (e is ErreurApi.Reseau || (e is ErreurApi.Http && e.statut >= 500)) IssueRappel.Reessayer else IssueRappel.Rien
        }
    }
}

class TacheRappel(contexte: Context, parametres: WorkerParameters) : CoroutineWorker(contexte, parametres) {
    override suspend fun doWork(): Result {
        val heure = inputData.getInt(CLE_HEURE, 19)
        // Un nouvel essai qui tombe après minuit ne rappelle plus un jour terminé.
        val maintenant = ZonedDateTime.now(BENIN)
        if (runAttemptCount > 0 && maintenant.hour < heure) return Result.success()
        return when (val issue = preparerRappel((applicationContext as NakayoApplication).service, heure)) {
            IssueRappel.Rien -> Result.success()
            IssueRappel.Reessayer -> Result.retry()
            is IssueRappel.Notifier -> {
                NotificationsRappel.afficher(applicationContext, issue.rappel)
                Result.success()
            }
        }
    }

    companion object {
        const val CLE_HEURE = "heure"
    }
}

object NotificationsRappel {
    private const val CANAL = "rappels-rapport"
    private const val IDENTIFIANT = 19

    fun creerCanal(contexte: Context) {
        val canal = NotificationChannel(CANAL, "Rappels du rapport du jour", NotificationManager.IMPORTANCE_DEFAULT).apply {
            description = "Le soir, quand le rapport d'une app à tester n'est pas encore envoyé."
        }
        contexte.getSystemService(NotificationManager::class.java).createNotificationChannel(canal)
    }

    fun autorisees(contexte: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(contexte, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    fun afficher(contexte: Context, rappel: Rappel) {
        if (!autorisees(contexte)) return
        creerCanal(contexte)
        val ouvrir = PendingIntent.getActivity(
            contexte,
            0,
            Intent(contexte, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val notification = NotificationCompat.Builder(contexte, CANAL)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(rappel.titre)
            .setContentText(rappel.texte)
            .setStyle(NotificationCompat.BigTextStyle().bigText(rappel.texte))
            .setContentIntent(ouvrir)
            .setAutoCancel(true)
            .build()
        try {
            // Le 21 h remplace le 19 h : une seule notification de rappel à la fois.
            NotificationManagerCompat.from(contexte).notify(IDENTIFIANT, notification)
        } catch (_: SecurityException) {
            // Permission retirée entre-temps : pas de rappel.
        }
    }
}

object PlanificationRappels {
    // Une tâche par heure de rappel, chaque jour. KEEP : l'heure prévue ne glisse pas à chaque ouverture.
    fun planifier(contexte: Context) {
        val wm = WorkManager.getInstance(contexte)
        val reseau = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
        HEURES_RAPPEL.forEach { heure ->
            wm.enqueueUniquePeriodicWork(
                "rappel-${heure}h",
                ExistingPeriodicWorkPolicy.KEEP,
                PeriodicWorkRequestBuilder<TacheRappel>(1, TimeUnit.DAYS)
                    .setInitialDelay(delaiJusqua(heure).toMillis(), TimeUnit.MILLISECONDS)
                    .setInputData(workDataOf(TacheRappel.CLE_HEURE to heure))
                    .setConstraints(reseau)
                    .setBackoffCriteria(BackoffPolicy.LINEAR, 10, TimeUnit.MINUTES)
                    .build(),
            )
        }
    }
}
