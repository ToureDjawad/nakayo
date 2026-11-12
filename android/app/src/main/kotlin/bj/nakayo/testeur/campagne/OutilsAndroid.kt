package bj.nakayo.testeur.campagne

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.os.Build
import android.os.CancellationSignal
import androidx.core.content.ContextCompat
import bj.nakayo.noyau.Position
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.resume

// Lecture des apps installées et de la position approximative, sans services Google.
class OutilsAndroid(private val contexte: Context) : OutilsApps {
    private val statistiques = StatistiquesUsage(contexte)

    override fun mesureAutorisee() = statistiques.autorisee()

    override fun planifierMesure() = PlanificationUsages.planifier(contexte)

    override fun planifierRappels() = PlanificationRappels.planifier(contexte)

    override fun installation(paquet: String): InstallationApp? {
        val pm = contexte.packageManager
        val version = try {
            pm.getPackageInfo(paquet, 0).versionName
        } catch (_: PackageManager.NameNotFoundException) {
            return null
        }
        val source = try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                pm.getInstallSourceInfo(paquet).installingPackageName
            } else {
                @Suppress("DEPRECATION")
                pm.getInstallerPackageName(paquet)
            }
        } catch (_: PackageManager.NameNotFoundException) {
            null
        } catch (_: IllegalArgumentException) {
            null
        }
        return InstallationApp(source, version)
    }

    // Position récente (moins de 6 h) si le téléphone en a une, sinon une nouvelle mesure de 20 s au plus.
    @SuppressLint("MissingPermission")
    override suspend fun position(): Position? {
        val permis = ContextCompat.checkSelfPermission(contexte, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(contexte, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        if (!permis) return null
        val lm = contexte.getSystemService(LocationManager::class.java) ?: return null
        val fournisseurs = lm.getProviders(true)
        val recente = fournisseurs
            .mapNotNull { runCatching { lm.getLastKnownLocation(it) }.getOrNull() }
            .maxByOrNull { it.time }
            ?.takeIf { System.currentTimeMillis() - it.time < SIX_HEURES }
        val lieu = recente ?: mesurer(lm, fournisseurs) ?: fournisseurs
            .mapNotNull { runCatching { lm.getLastKnownLocation(it) }.getOrNull() }
            .maxByOrNull { it.time }
        return lieu?.let { Position(it.latitude, it.longitude) }
    }

    @SuppressLint("MissingPermission")
    private suspend fun mesurer(lm: LocationManager, fournisseurs: List<String>): Location? {
        val fournisseur = listOf(LocationManager.NETWORK_PROVIDER, LocationManager.GPS_PROVIDER).firstOrNull { it in fournisseurs } ?: return null
        return withTimeoutOrNull(20_000) {
            suspendCancellableCoroutine { suite ->
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    val annulation = CancellationSignal()
                    suite.invokeOnCancellation { annulation.cancel() }
                    lm.getCurrentLocation(fournisseur, annulation, ContextCompat.getMainExecutor(contexte)) { suite.resume(it) }
                } else {
                    val ecoute = object : android.location.LocationListener {
                        override fun onLocationChanged(location: Location) {
                            lm.removeUpdates(this)
                            if (suite.isActive) suite.resume(location)
                        }
                        @Deprecated("Requis avant Android 10")
                        override fun onStatusChanged(provider: String?, status: Int, extras: android.os.Bundle?) = Unit
                        override fun onProviderEnabled(provider: String) = Unit
                        override fun onProviderDisabled(provider: String) = Unit
                    }
                    suite.invokeOnCancellation { lm.removeUpdates(ecoute) }
                    @Suppress("DEPRECATION")
                    lm.requestSingleUpdate(fournisseur, ecoute, contexte.mainLooper)
                }
            }
        }
    }

    private companion object {
        const val SIX_HEURES = 6 * 60 * 60 * 1000L
    }
}
