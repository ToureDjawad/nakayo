package bj.nakayo.testeur.campagne

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

// Passage d'une activité au premier plan (true) ou à l'arrière-plan (false), en millisecondes.
data class EvenementUsage(val paquet: String, val premierPlan: Boolean, val temps: Long)

// Temps passé au premier plan par app entre `debut` et `fin` (millisecondes), d'après les événements
// d'Android dans cet intervalle. Une app déjà ouverte avant `debut` compte à partir de `debut` ;
// une app encore ouverte à `fin` compte jusqu'à `fin`. Plusieurs activités d'une même app ne comptent qu'une fois.
fun cumulerPremierPlan(evenements: List<EvenementUsage>, debut: Long, fin: Long): Map<String, Long> {
    val ouvertes = mutableMapOf<String, Int>()
    val depuis = mutableMapOf<String, Long>()
    val total = mutableMapOf<String, Long>()
    fun ajouter(paquet: String, de: Long, a: Long) {
        val duree = minOf(a, fin) - maxOf(de, debut)
        if (duree > 0) total[paquet] = (total[paquet] ?: 0) + duree
    }
    for (e in evenements.sortedBy { it.temps }) {
        if (e.temps < debut || e.temps > fin) continue
        val n = ouvertes[e.paquet] ?: 0
        if (e.premierPlan) {
            if (n == 0) depuis[e.paquet] = e.temps
            ouvertes[e.paquet] = n + 1
        } else if (n > 0) {
            ouvertes[e.paquet] = n - 1
            if (n == 1) ajouter(e.paquet, depuis.remove(e.paquet)!!, e.temps)
        } else if (e.paquet !in depuis && e.paquet !in total) {
            // Fermée sans ouverture vue : elle était ouverte au début de l'intervalle.
            ajouter(e.paquet, debut, e.temps)
        }
    }
    depuis.forEach { (paquet, de) -> ajouter(paquet, de, fin) }
    return total
}

val ZONE_BENIN: ZoneId = ZoneId.of("Africa/Porto-Novo")

// Les deux jours que le serveur accepte (§2.6) : hier et aujourd'hui, à l'heure du Bénin, avec leurs bornes.
data class JourMesure(val jour: String, val debut: Long, val fin: Long)

fun joursAMesurer(maintenant: Instant): List<JourMesure> {
    val aujourdhui = maintenant.atZone(ZONE_BENIN).toLocalDate()
    fun debut(j: LocalDate) = j.atStartOfDay(ZONE_BENIN).toInstant().toEpochMilli()
    val hier = aujourdhui.minusDays(1)
    return listOf(
        JourMesure(hier.toString(), debut(hier), debut(aujourdhui)),
        JourMesure(aujourdhui.toString(), debut(aujourdhui), maintenant.toEpochMilli()),
    )
}
