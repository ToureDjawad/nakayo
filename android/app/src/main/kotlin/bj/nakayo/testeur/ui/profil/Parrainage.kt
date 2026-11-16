package bj.nakayo.testeur.ui.profil

import android.content.Intent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import bj.nakayo.noyau.Filleul
import bj.nakayo.noyau.Parrainage
import bj.nakayo.testeur.ui.composants.Bouton
import bj.nakayo.testeur.ui.composants.Carte
import bj.nakayo.testeur.ui.composants.LigneInfo
import bj.nakayo.testeur.ui.composants.Note
import bj.nakayo.testeur.ui.composants.Surtitre
import bj.nakayo.testeur.ui.theme.Bricolage
import bj.nakayo.testeur.ui.theme.Couleurs

// US-39 : parrainage sur l'écran « Mon profil » : code à partager, prime et filleuls.

// Message envoyé par le testeur à la personne qu'il invite.
fun messageInvitation(code: String): String =
    "Rejoignez Nakayo et gagnez de l'argent en testant des applications Android depuis votre téléphone. " +
        "Installez l'app Nakayo Testeur et saisissez mon code de parrainage à l'inscription : $code"

fun etatFilleul(etat: String): String = when (etat) {
    "compte_en_validation" -> "Compte en vérification"
    "en_attente_de_campagne" -> "Pas encore de campagne menée au bout"
    "prime_en_paiement" -> "Prime en cours de versement"
    "prime_versee" -> "Prime versée"
    else -> "Compte inactif"
}

// « Un code K7Q2MP » est lu lettre par lettre par TalkBack.
private fun epeler(code: String) = code.toList().joinToString(" ")

@Composable
fun CarteParrainage(parrainage: Parrainage) {
    val code = parrainage.code ?: return
    val contexte = LocalContext.current
    Carte {
        Surtitre("Parrainer un ami")
        Note("Votre code de parrainage")
        Text(
            code,
            style = TextStyle(fontFamily = Bricolage, fontWeight = FontWeight(700), fontSize = 26.sp, letterSpacing = 3.sp),
            color = Couleurs.foret,
            modifier = Modifier.semantics { contentDescription = "Code de parrainage : ${epeler(code)}" },
        )
        Note(
            "Vous recevez ${parrainage.prime.montantLisible} sur votre Mobile Money quand une personne inscrite avec votre code " +
                "mène sa première campagne au bout (14 jours).",
            Couleurs.encre,
        )
        Bouton("Partager mon code", {
            val envoi = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, messageInvitation(code))
            }
            contexte.startActivity(Intent.createChooser(envoi, "Partager mon code"))
        })
        if (parrainage.filleuls.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(0.dp)) {
                Surtitre("Mes filleuls (${parrainage.filleuls.size})")
                parrainage.filleuls.forEachIndexed { i, f: Filleul ->
                    LigneInfo(f.nom, etatFilleul(f.etat), separateur = i < parrainage.filleuls.lastIndex)
                }
            }
            if (parrainage.totalVerse > 0) Note("Primes reçues : ${parrainage.totalVerseLisible}")
        }
    }
}
