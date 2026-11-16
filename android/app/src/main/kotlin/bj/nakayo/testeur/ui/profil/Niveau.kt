package bj.nakayo.testeur.ui.profil

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import bj.nakayo.noyau.ConditionNiveau
import bj.nakayo.noyau.NiveauTesteur
import bj.nakayo.testeur.ui.composants.Carte
import bj.nakayo.testeur.ui.composants.Note
import bj.nakayo.testeur.ui.composants.Pastille
import bj.nakayo.testeur.ui.composants.Surtitre
import bj.nakayo.testeur.ui.theme.Couleurs

// US-38 : niveau du testeur et chemin vers le suivant, sur l'écran « Mon profil ».

private fun pluriel(n: Int, mot: String) = if (n > 1) "$n ${mot}s" else "$n $mot"

// Bilan du testeur, par exemple « 2 campagnes menées au bout · 1 bug accepté · assiduité 75 % ».
fun bilanNiveau(niveau: NiveauTesteur): String = listOf(
    "${pluriel(niveau.campagnesTerminees, "campagne")} menée${if (niveau.campagnesTerminees > 1) "s" else ""} au bout",
    "${pluriel(niveau.bugsAcceptes, "bug")} accepté${if (niveau.bugsAcceptes > 1) "s" else ""}",
    "assiduité ${niveau.assiduite} %",
).joinToString(" · ")

// Une ligne par condition du niveau suivant : ce qui est fait, ou ce qu'il reste à faire.
fun texteCondition(c: ConditionNiveau): String = when (c.code) {
    "campagnes" -> if (c.rempli) {
        "${pluriel(c.requis, "campagne")} menée${if (c.requis > 1) "s" else ""} au bout : fait"
    } else {
        val reste = c.requis - c.actuel
        "Encore ${pluriel(reste, "campagne")} à mener au bout (14 jours)"
    }
    "bugs" -> if (c.rempli) {
        "${pluriel(c.requis, "bug")} accepté${if (c.requis > 1) "s" else ""} : fait"
    } else {
        val reste = c.requis - c.actuel
        "Encore ${pluriel(reste, "bug")} accepté${if (reste > 1) "s" else ""} par un développeur"
    }
    "assiduite" -> if (c.rempli) {
        "Assiduité d'au moins ${c.requis} % : fait"
    } else {
        "Assiduité d'au moins ${c.requis} % (vous êtes à ${c.actuel} %) : évitez d'être remplacé"
    }
    else -> ""
}

// Avantage du niveau, affiché sous le nom.
fun avantageNiveau(code: String): String = when (code) {
    "or" -> "Vous passez en premier dans les campagnes Pro et Plus, les mieux payées."
    "argent" -> "Vous passez avant les testeurs Bronze dans les campagnes Pro et Plus, les mieux payées."
    else -> "Menez une campagne au bout pour accéder aux campagnes Pro et Plus, les mieux payées."
}

private fun couleursNiveau(code: String): Pair<Color, Color> = when (code) {
    "or" -> Couleurs.ocreDoux to Couleurs.ocreEncre
    "argent" -> Couleurs.indigoDoux to Couleurs.indigo
    else -> Couleurs.argileDoux to Couleurs.argile
}

@Composable
fun CarteNiveau(niveau: NiveauTesteur) {
    Carte {
        Surtitre("Mon niveau")
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            val (fond, encre) = couleursNiveau(niveau.code)
            Pastille(niveau.nom, fond, encre)
            Note(bilanNiveau(niveau))
        }
        Text(avantageNiveau(niveau.code), style = MaterialTheme.typography.bodyMedium, color = Couleurs.encre)
        val suivant = niveau.suivant
        if (suivant == null) {
            Note("Vous avez atteint le plus haut niveau. Gardez votre assiduité pour le conserver.")
        } else {
            Surtitre("Pour passer ${suivant.nom}")
            suivant.conditions.forEach { c ->
                Note("${if (c.rempli) "✓" else "•"} ${texteCondition(c)}", if (c.rempli) Couleurs.vert else Couleurs.encre)
            }
        }
    }
}
