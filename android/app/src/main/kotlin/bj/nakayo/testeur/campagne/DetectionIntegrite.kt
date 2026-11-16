package bj.nakayo.testeur.campagne

import android.os.Build
import bj.nakayo.noyau.Integrite
import java.io.File

// US-28 : signes d'un émulateur ou d'un téléphone rooté. Ce ne sont que des indices : le serveur
// crée une alerte que l'admin examine, rien n'est bloqué dans l'app.
object DetectionIntegrite {
    private val CHEMINS_SU = listOf(
        "/system/bin/su", "/system/xbin/su", "/sbin/su", "/system/sd/xbin/su", "/data/local/xbin/su",
        "/data/local/bin/su", "/data/local/su", "/su/bin/su", "/system/app/Superuser.apk", "/system/bin/magisk",
    )

    fun lire(): Integrite = Integrite(
        emulateur = estEmulateur(Build.FINGERPRINT, Build.MODEL, Build.HARDWARE, Build.PRODUCT, Build.MANUFACTURER),
        root = estRoote(Build.TAGS) { File(it).exists() },
    )

    fun estEmulateur(empreinte: String?, modele: String?, materiel: String?, produit: String?, fabricant: String?): Boolean {
        val e = empreinte.orEmpty().lowercase()
        val m = modele.orEmpty().lowercase()
        val p = produit.orEmpty().lowercase()
        return e.startsWith("generic") || "emulator" in e || "sdk_gphone" in e ||
            "emulator" in m || "android sdk built for" in m ||
            materiel.orEmpty().lowercase() in setOf("goldfish", "ranchu", "vbox86") ||
            p.startsWith("sdk") || "emulator" in p || "vbox" in p ||
            "genymotion" in fabricant.orEmpty().lowercase()
    }

    fun estRoote(etiquettes: String?, existe: (String) -> Boolean): Boolean =
        etiquettes.orEmpty().contains("test-keys") || CHEMINS_SU.any(existe)
}
