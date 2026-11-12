package bj.nakayo.testeur.ui.apps

import bj.nakayo.noyau.AffectationTesteur

// Ce que le testeur doit faire maintenant pour une app (sans dépendance à Android).
enum class Etape { Inscription, Installation, Rapport, JourFait, Acquis }

fun etape(a: AffectationTesteur): Etape = when {
    !a.inscriptionConfirmee -> Etape.Inscription
    !a.installationConfirmee -> Etape.Installation
    a.joursAcquis -> Etape.Acquis
    !a.rapportDuJour -> Etape.Rapport
    else -> Etape.JourFait
}

fun libelleEtape(e: Etape): String = when (e) {
    Etape.Inscription -> "Inscription au test à faire"
    Etape.Installation -> "Installation à faire"
    Etape.Rapport -> "Rapport du jour à envoyer"
    Etape.JourFait -> "Rapport du jour envoyé"
    Etape.Acquis -> "14 jours validés"
}

// « connexion », « usage », « rapport » -> phrase lisible.
fun texteManques(manquait: List<String>, usageMinimumSecondes: Int = 120): String {
    val minutes = (usageMinimumSecondes + 59) / 60
    val parties = manquait.mapNotNull {
        when (it) {
            "connexion" -> "l'ouverture de Nakayo"
            "usage" -> "$minutes minutes dans l'app"
            "rapport" -> "le rapport du jour"
            else -> null
        }
    }
    return when (parties.size) {
        0 -> "une condition du jour"
        1 -> parties[0]
        else -> parties.dropLast(1).joinToString(", ") + " et " + parties.last()
    }
}

// La remise à zéro est affichée tant que le compteur n'a pas été rattrapé (14 jours non atteints).
fun remiseVisible(a: AffectationTesteur): Boolean = a.derniereRemise != null && !a.joursAcquis
