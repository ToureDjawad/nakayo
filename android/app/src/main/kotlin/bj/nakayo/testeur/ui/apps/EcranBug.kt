package bj.nakayo.testeur.ui.apps

import android.graphics.BitmapFactory
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import bj.nakayo.noyau.BugSignale
import bj.nakayo.noyau.Photo
import bj.nakayo.testeur.R
import bj.nakayo.testeur.ui.MessagesChamps
import bj.nakayo.testeur.ui.composants.Bandeau
import bj.nakayo.testeur.ui.composants.Bouton
import bj.nakayo.testeur.ui.composants.Carte
import bj.nakayo.testeur.ui.composants.ChampTexte
import bj.nakayo.testeur.ui.composants.Ecran
import bj.nakayo.testeur.ui.composants.EnTete
import bj.nakayo.testeur.ui.composants.Note
import bj.nakayo.testeur.ui.composants.Paragraphe
import bj.nakayo.testeur.ui.composants.Pastille
import bj.nakayo.testeur.ui.composants.Segment
import bj.nakayo.testeur.ui.composants.StyleBouton
import bj.nakayo.testeur.ui.composants.Surtitre
import bj.nakayo.testeur.ui.composants.Titre
import bj.nakayo.testeur.ui.composants.TypeBandeau
import bj.nakayo.testeur.ui.theme.Couleurs
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

class ActionsBug(
    val retour: () -> Unit,
    val saisirTitre: (String) -> Unit,
    val saisirEtapes: (String) -> Unit,
    val saisirAttendu: (String) -> Unit,
    val saisirObtenu: (String) -> Unit,
    val choisirGravite: (String) -> Unit,
    val captureChoisie: (File) -> Unit,
    val retirerCapture: (Int) -> Unit,
    val afficherErreur: (String) -> Unit,
    val envoyer: () -> Unit,
)

fun BugModele.actions() = ActionsBug(
    ::retour, ::saisirTitre, ::saisirEtapes, ::saisirAttendu, ::saisirObtenu, ::choisirGravite,
    ::captureChoisie, ::retirerCapture, ::afficherErreur, ::envoyer,
)

// Rapport de bug (US-33) : étapes, résultat attendu et obtenu, gravité, jusqu'à 5 captures.
@Composable
fun EcranBug(etat: EtatBug, nomApp: String, actions: ActionsBug) {
    val contexte = LocalContext.current
    val portee = rememberCoroutineScope()
    val selecteur = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) {
            portee.launch {
                val fichier = withContext(Dispatchers.IO) { runCatching { copier(contexte, uri) }.getOrNull() }
                if (fichier != null) actions.captureChoisie(fichier) else actions.afficherErreur("Image illisible. Choisissez une autre capture d'écran.")
            }
        }
    }
    val champ = { cle: String -> etat.erreurs[cle]?.let { MessagesChamps.bug(cle, it) } }

    Ecran(pied = { Bouton("Envoyer le bug", actions.envoyer, enCours = etat.envoiEnCours, actif = !etat.ajoutCapture) }) {
        EnTete(null, actions.retour)
        Surtitre(nomApp)
        Titre("Signaler un bug")
        Paragraphe("Décrivez un problème précis, pour que le développeur puisse le reproduire. Chaque bug qu'il accepte vous rapporte 200 FCFA de plus.")
        etat.information?.let { Bandeau(it, TypeBandeau.Succes) }
        etat.erreur?.let { Bandeau(it) }
        ChampTexte(
            valeur = etat.titre,
            surChangement = actions.saisirTitre,
            libelle = "Titre du bug",
            exemple = "Par exemple : le panier se vide après fermeture",
            erreur = champ("titre"),
        )
        ChampTexte(
            valeur = etat.etapes,
            surChangement = actions.saisirEtapes,
            libelle = "Étapes pour le reproduire",
            exemple = "1. Ajouter un article au panier. 2. Quitter l'app. 3. La rouvrir.",
            erreur = champ("etapes"),
            actionClavier = ImeAction.Default,
            lignes = 4,
        )
        ChampTexte(
            valeur = etat.resultatAttendu,
            surChangement = actions.saisirAttendu,
            libelle = "Résultat attendu",
            exemple = "Ce qui aurait dû se passer.",
            erreur = champ("resultatAttendu"),
            actionClavier = ImeAction.Default,
            lignes = 2,
        )
        ChampTexte(
            valeur = etat.resultatObtenu,
            surChangement = actions.saisirObtenu,
            libelle = "Résultat obtenu",
            exemple = "Ce qui s'est passé à la place.",
            erreur = champ("resultatObtenu"),
            actionClavier = ImeAction.Default,
            lignes = 2,
        )
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Gravité", style = MaterialTheme.typography.labelMedium, color = Couleurs.encre2)
            Segment(GRAVITES, etat.gravite, actions.choisirGravite, "Gravité du bug")
            Note("Bloquante : l'app plante ou une fonction est impossible à utiliser.")
            champ("gravite")?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = Couleurs.rouge) }
        }
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Captures d'écran (${etat.captures.size} sur $CAPTURES_MAX)", style = MaterialTheme.typography.labelMedium, color = Couleurs.encre2)
            etat.captures.forEachIndexed { i, capture -> LigneCapture(i, capture, actions.retirerCapture) }
            if (etat.captures.size < CAPTURES_MAX) {
                Bouton(
                    "Ajouter une capture",
                    { selecteur.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
                    StyleBouton.Secondaire,
                    enCours = etat.ajoutCapture,
                    icone = R.drawable.ic_appareil_photo,
                )
            }
            champ("captures")?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = Couleurs.rouge) }
        }
        Note("Nakayo joint au bug la version de l'app installée sur ce téléphone.")
        etat.signales?.takeIf { it.isNotEmpty() }?.let { BugsSignales(it) }
    }
}

@Composable
private fun LigneCapture(index: Int, capture: Photo, surRetirer: (Int) -> Unit) {
    val image = remember(capture) { runCatching { BitmapFactory.decodeByteArray(capture.octets, 0, capture.octets.size)?.asImageBitmap() }.getOrNull() }
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
        if (image != null) {
            Image(image, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.size(48.dp).clip(RoundedCornerShape(8.dp)))
        } else {
            Box(Modifier.size(48.dp).background(Couleurs.doux, RoundedCornerShape(8.dp)))
        }
        Text("Capture ${index + 1}", style = MaterialTheme.typography.bodyMedium, color = Couleurs.encre, modifier = Modifier.weight(1f))
        Bouton("Retirer", { surRetirer(index) }, StyleBouton.Fantome)
    }
}

// Bugs déjà envoyés pour cette app, avec la décision du développeur.
@Composable
private fun BugsSignales(bugs: List<BugSignale>) {
    Carte {
        Surtitre("Vos bugs signalés")
        bugs.forEach { b ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(b.titre, style = MaterialTheme.typography.bodyMedium, color = Couleurs.encre, modifier = Modifier.weight(1f))
                when (b.statut) {
                    "accepte" -> Pastille("Accepté, +200 FCFA", Couleurs.vertDoux, Couleurs.vert)
                    "refuse" -> Pastille("Refusé", Couleurs.rougeDoux, Couleurs.rouge)
                    else -> Pastille("En attente", Couleurs.ocreDoux, Couleurs.ocreEncre)
                }
            }
            if (b.statut == "refuse") b.motifRefus?.let { Note("Motif : $it") }
        }
    }
}
