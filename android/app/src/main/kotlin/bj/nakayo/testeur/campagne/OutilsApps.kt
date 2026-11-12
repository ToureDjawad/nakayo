package bj.nakayo.testeur.campagne

import bj.nakayo.noyau.Position

// Une app testée telle qu'Android la voit sur ce téléphone.
data class InstallationApp(
    // Paquet qui l'a installée (« com.android.vending » pour le Play Store), null si Android ne le dit pas.
    val source: String?,
    val version: String?,
)

// Ce que l'app lit sur le téléphone pour le test quotidien. Remplacé par un faux dans les tests.
interface OutilsApps {
    // null quand l'app n'est pas installée.
    fun installation(paquet: String): InstallationApp?

    // null sans permission de localisation, ou quand le téléphone ne donne aucune position.
    suspend fun position(): Position?

    // US-18 : le testeur a-t-il donné l'accès aux statistiques d'usage ?
    fun mesureAutorisee(): Boolean = true

    // Lance l'envoi du temps d'utilisation (tout de suite, puis toutes les heures).
    fun planifierMesure() = Unit

    object Aucun : OutilsApps {
        override fun installation(paquet: String): InstallationApp? = null
        override suspend fun position(): Position? = null
    }
}

const val SOURCE_PLAY_STORE = "com.android.vending"
