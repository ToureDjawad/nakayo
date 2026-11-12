package bj.nakayo.testeur.ui.portefeuille

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import bj.nakayo.noyau.CompteMomo
import bj.nakayo.noyau.GainEnAttente
import bj.nakayo.noyau.Portefeuille
import bj.nakayo.noyau.VersementTesteur
import bj.nakayo.testeur.ui.composants.Bandeau
import bj.nakayo.testeur.ui.composants.Bouton
import bj.nakayo.testeur.ui.composants.Carte
import bj.nakayo.testeur.ui.composants.Chargement
import bj.nakayo.testeur.ui.composants.Ecran
import bj.nakayo.testeur.ui.composants.EnTete
import bj.nakayo.testeur.ui.composants.Note
import bj.nakayo.testeur.ui.composants.Paragraphe
import bj.nakayo.testeur.ui.composants.Pastille
import bj.nakayo.testeur.ui.composants.Surtitre
import bj.nakayo.testeur.ui.composants.Titre
import bj.nakayo.testeur.ui.jour
import bj.nakayo.testeur.ui.operateur
import bj.nakayo.testeur.ui.theme.Bricolage
import bj.nakayo.testeur.ui.theme.Couleurs
import bj.nakayo.testeur.ui.theme.NakayoTheme

class ActionsPortefeuille(val retour: () -> Unit, val reessayer: () -> Unit)

fun PortefeuilleModele.actions() = ActionsPortefeuille(::retour, ::actualiser)

// US-23 : ce que le testeur a gagné et va gagner, app par app.
@Composable
fun EcranPortefeuille(etat: EtatPortefeuille, actions: ActionsPortefeuille) {
    when (etat) {
        EtatPortefeuille.Chargement -> Ecran(centrer = true) { Chargement("Chargement de votre portefeuille…") }
        is EtatPortefeuille.Erreur -> Ecran(centrer = true, pied = { Bouton("Réessayer", actions.reessayer) }) {
            EnTete(null, actions.retour)
            Titre("Mon portefeuille", alignement = TextAlign.Center)
            Bandeau(etat.message)
        }
        is EtatPortefeuille.Pret -> Ecran {
            EnTete(null, actions.retour)
            Titre("Mon portefeuille")
            Contenu(etat.portefeuille)
        }
    }
}

@Composable
private fun Contenu(p: Portefeuille) {
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Total("En attente", p.totalEnAttenteLisible, Couleurs.ocreEncre, Modifier.weight(1f))
        Total("Déjà versé", p.totalVerseLisible, Couleurs.foret, Modifier.weight(1f))
    }
    p.compte?.let { Note("Versements sur votre compte ${operateur(it.operateur)} ${it.numeroMasque}.") }

    Surtitre("Gains en attente")
    if (p.enAttente.isEmpty()) {
        Paragraphe("Aucun gain en attente. Nous vous prévenons par SMS dès qu'une nouvelle app est à tester.")
    } else {
        p.enAttente.forEach { CarteGain(it) }
    }
    Note("500 FCFA par app, versés à la fin de la campagne si vous avez vos 14 jours validés et restez inscrit au test.")

    Surtitre("Historique des versements")
    if (p.historique.isEmpty()) {
        Paragraphe("Aucun versement pour l'instant.")
    } else {
        Carte { p.historique.forEachIndexed { i, v -> LigneVersement(v, separateur = i < p.historique.lastIndex) } }
    }
}

@Composable
private fun Total(libelle: String, montant: String, couleur: Color, modifier: Modifier) {
    Carte(modifier.semantics(mergeDescendants = true) { }, espacement = 4.dp) {
        Note(libelle)
        Text(
            montant,
            style = MaterialTheme.typography.headlineSmall.copy(fontFamily = Bricolage, fontWeight = FontWeight(700)),
            color = couleur,
        )
    }
}

@Composable
private fun CarteGain(g: GainEnAttente) {
    Carte(Modifier.semantics(mergeDescendants = true) { }) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                g.appNom,
                style = MaterialTheme.typography.titleMedium,
                color = Couleurs.encre,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            Text(g.montantLisible, style = MaterialTheme.typography.titleMedium, color = Couleurs.encre)
        }
        if (g.etat == "en_paiement") {
            Pastille("Versement en cours", Couleurs.vertDoux, Couleurs.vert)
            Note("Vos 14 jours sont validés. Vous recevrez un SMS dès que l'argent arrive.")
        } else {
            Text("Jour atteint : ${g.joursValides} sur ${g.joursExiges} jours validés", style = MaterialTheme.typography.bodyMedium, color = Couleurs.encre2)
            LinearProgressIndicator(
                progress = { (g.joursValides.toFloat() / g.joursExiges.coerceAtLeast(1)).coerceIn(0f, 1f) },
                color = Couleurs.foret,
                trackColor = Couleurs.doux,
                drawStopIndicator = {},
                modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)),
            )
            g.prevuLe?.let(::jour)?.let { Note("Versement prévu à la fin de la campagne, vers le $it.") }
        }
    }
}

@Composable
private fun LigneVersement(v: VersementTesteur, separateur: Boolean) {
    Column(Modifier.semantics(mergeDescendants = true) { }, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                v.appNom,
                style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight(600)),
                color = Couleurs.encre,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            Text(v.montantLisible, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight(600)), color = Couleurs.vert)
        }
        Note("Versé le ${jour(v.verseLe) ?: v.verseLe} sur ${operateur(v.operateur)} ${v.numeroMasque}")
        Note("Référence de transaction : ${v.referenceTransaction ?: v.reference}")
    }
    if (separateur) Box(Modifier.fillMaxWidth().height(1.dp).background(Couleurs.doux))
}

@Preview(widthDp = 360, heightDp = 760)
@Composable
private fun ApercuPortefeuille() {
    val p = Portefeuille(
        totalEnAttente = 1000,
        totalEnAttenteLisible = "1 000 FCFA",
        totalVerse = 500,
        totalVerseLisible = "500 FCFA",
        compte = CompteMomo("mtn", "•••• 42"),
        enAttente = listOf(
            GainEnAttente("31", "Marché Facile", "en_test", 6, 14, 500, montantLisible = "500 FCFA", prevuLe = "2026-11-28T09:00:00.000Z"),
            GainEnAttente("32", "Tontine Facile", "en_paiement", 14, 14, 500, montantLisible = "500 FCFA"),
        ),
        historique = listOf(
            VersementTesteur("VER-0A1B2C3D4E5F6071", "MP2611120001", "Zem Express", 500, montantLisible = "500 FCFA", operateur = "mtn", numeroMasque = "•••• 42", verseLe = "2026-11-12T10:15:00.000Z"),
        ),
    )
    NakayoTheme { EcranPortefeuille(EtatPortefeuille.Pret(p), ActionsPortefeuille({}, {})) }
}
