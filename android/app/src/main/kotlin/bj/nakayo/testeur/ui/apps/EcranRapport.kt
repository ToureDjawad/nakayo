package bj.nakayo.testeur.ui.apps

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import bj.nakayo.noyau.AffectationTesteur
import bj.nakayo.testeur.ui.MessagesChamps
import bj.nakayo.testeur.ui.composants.Bandeau
import bj.nakayo.testeur.ui.composants.Bouton
import bj.nakayo.testeur.ui.composants.ChampTexte
import bj.nakayo.testeur.ui.composants.Ecran
import bj.nakayo.testeur.ui.composants.EnTete
import bj.nakayo.testeur.ui.composants.Note
import bj.nakayo.testeur.ui.composants.Paragraphe
import bj.nakayo.testeur.ui.composants.Puce
import bj.nakayo.testeur.ui.composants.Segment
import bj.nakayo.testeur.ui.composants.Surtitre
import bj.nakayo.testeur.ui.composants.Titre
import bj.nakayo.testeur.ui.theme.Couleurs

class ActionsRapport(
    val retour: () -> Unit,
    val saisirActions: (String) -> Unit,
    val choisirNote: (Int) -> Unit,
    val choisirBug: (Boolean) -> Unit,
    val saisirCommentaire: (String) -> Unit,
    val basculerFonctionnalite: (String) -> Unit,
    val saisirRetour: (String) -> Unit,
    val envoyer: () -> Unit,
)

fun RapportModele.actions() = ActionsRapport(
    ::retour, ::saisirActions, ::choisirNote, ::choisirBug, ::saisirCommentaire, ::basculerFonctionnalite, ::saisirRetour, ::envoyer,
)

private val NOTES = (1..5).map { "$it" to "$it" }
private val BUG = listOf("non" to "Non", "oui" to "Oui")

// Rapport du jour (T09, US-19). La position approximative est demandée au moment de l'envoi.
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun EcranRapport(etat: EtatRapport, affectation: AffectationTesteur, actions: ActionsRapport) {
    val contexte = LocalContext.current
    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { actions.envoyer() }
    fun envoyer() {
        val accordee = listOf(Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION)
            .any { ContextCompat.checkSelfPermission(contexte, it) == PackageManager.PERMISSION_GRANTED }
        if (accordee) actions.envoyer() else permission.launch(arrayOf(Manifest.permission.ACCESS_COARSE_LOCATION))
    }
    val champ = { cle: String -> etat.erreurs[cle]?.let { MessagesChamps.rapport(cle, it) } }

    Ecran(pied = { Bouton("Envoyer le rapport", ::envoyer, enCours = etat.envoiEnCours) }) {
        EnTete(null, actions.retour)
        Surtitre(affectation.app.nom)
        Titre("Rapport du jour ${affectation.jourCampagne}")
        Paragraphe("Répondez après avoir utilisé l'app aujourd'hui. Vos réponses aident le développeur à corriger son app.")
        // Avertissement visible avant la demande d'Android (règles Google Play sur la position).
        Note(
            "À l'envoi, Nakayo enregistre votre position approximative (à un kilomètre près), seulement à ce moment-là. " +
                "Elle prouve que le test a lieu sur un vrai téléphone. Rien n'est suivi en arrière-plan.",
        )
        etat.erreur?.let { Bandeau(it) }
        ChampTexte(
            valeur = etat.actions,
            surChangement = actions.saisirActions,
            libelle = "Qu'avez-vous fait dans l'app aujourd'hui ?",
            exemple = "Par exemple : j'ai cherché du riz et ajouté deux articles au panier.",
            erreur = champ("actions"),
            actionClavier = ImeAction.Default,
            lignes = 3,
        )
        Question("Votre note pour l'app aujourd'hui", champ("note")) {
            Segment(NOTES, etat.note?.toString(), { actions.choisirNote(it.toInt()) }, "Note de 1 à 5")
            Note("1 : très mauvais · 5 : excellent")
        }
        Question("Avez-vous rencontré un problème ?", champ("bug")) {
            Segment(BUG, etat.bug?.let { if (it) "oui" else "non" }, { actions.choisirBug(it == "oui") }, "Problème rencontré")
        }
        if (etat.bug == true) {
            ChampTexte(
                valeur = etat.commentaireBug,
                surChangement = actions.saisirCommentaire,
                libelle = "Décrivez le problème",
                exemple = "Ce que vous faisiez, ce qui s'est passé.",
                erreur = champ("commentaireBug"),
                actionClavier = ImeAction.Default,
                lignes = 3,
            )
        }
        Question("Fonctionnalités utilisées aujourd'hui", champ("fonctionnalites")) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                affectation.app.fonctionnalites.forEach { f ->
                    Puce(f, f in etat.fonctionnalites) { actions.basculerFonctionnalite(f) }
                }
            }
        }
        if (affectation.retourDetailleAttendu) {
            ChampTexte(
                valeur = etat.retourDetaille,
                surChangement = actions.saisirRetour,
                libelle = "Votre avis détaillé",
                aide = "Ce qui vous a plu, ce qui vous a gêné, ce que vous changeriez. Entre $RETOUR_MIN et $RETOUR_MAX caractères.",
                erreur = champ("retourDetaille"),
                actionClavier = ImeAction.Default,
                lignes = 6,
            )
        }
        Note("Nakayo joint au rapport la version de l'app et votre position approximative (la ville, à 1 km près).")
    }
}

@Composable
private fun Question(titre: String, erreur: String?, contenu: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(titre, style = MaterialTheme.typography.labelMedium, color = Couleurs.encre2)
        contenu()
        erreur?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = Couleurs.rouge) }
    }
}
