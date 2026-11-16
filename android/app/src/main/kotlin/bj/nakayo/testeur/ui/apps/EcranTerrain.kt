package bj.nakayo.testeur.ui.apps

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import bj.nakayo.testeur.ui.MessagesChamps
import bj.nakayo.testeur.ui.composants.Bandeau
import bj.nakayo.testeur.ui.composants.Bouton
import bj.nakayo.testeur.ui.composants.ChampTexte
import bj.nakayo.testeur.ui.composants.Ecran
import bj.nakayo.testeur.ui.composants.EnTete
import bj.nakayo.testeur.ui.composants.Note
import bj.nakayo.testeur.ui.composants.Paragraphe
import bj.nakayo.testeur.ui.composants.Segment
import bj.nakayo.testeur.ui.composants.Surtitre
import bj.nakayo.testeur.ui.composants.Titre
import bj.nakayo.testeur.ui.theme.Couleurs

class ActionsTerrain(
    val retour: () -> Unit,
    val choisirConnexion: (String) -> Unit,
    val choisirReseau: (String) -> Unit,
    val choisirTelephone: (String) -> Unit,
    val choisirLangue: (String) -> Unit,
    val choisirComprehension: (Int) -> Unit,
    val saisirCommentaire: (String) -> Unit,
    val envoyer: () -> Unit,
)

fun TerrainModele.actions() = ActionsTerrain(
    ::retour, ::choisirConnexion, ::choisirReseau, ::choisirTelephone, ::choisirLangue, ::choisirComprehension, ::saisirCommentaire, ::envoyer,
)

@Composable
private fun Question(titre: String, erreur: String?, aide: String? = null, contenu: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(titre, style = MaterialTheme.typography.labelMedium, color = Couleurs.encre2)
        contenu()
        aide?.let { Note(it) }
        erreur?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = Couleurs.rouge) }
    }
}

// US-37 : questionnaire terrain (Lancement Afrique) : réseau, téléphone et langue.
@Composable
fun EcranTerrain(etat: EtatTerrain, nomApp: String, actions: ActionsTerrain) {
    val champ = { cle: String -> etat.erreurs[cle]?.let { MessagesChamps.terrain(cle, it) } }
    Ecran(pied = { Bouton("Envoyer mes réponses", actions.envoyer, enCours = etat.envoiEnCours) }) {
        EnTete(null, actions.retour)
        Surtitre(nomApp)
        Titre("Questionnaire terrain")
        Paragraphe("Après une semaine d'utilisation, dites-nous comment l'app se comporte chez vous. Vos réponses sont anonymes pour le développeur.")
        etat.erreur?.let { Bandeau(it) }
        Question("Votre connexion la plupart du temps", champ("connexion")) {
            Segment(CONNEXIONS, etat.connexion, actions.choisirConnexion, "Connexion utilisée")
        }
        Question("L'app sur votre connexion", champ("reseau"), "Bloqué : l'app ne charge pas ou affiche des erreurs de réseau.") {
            Segment(TENUES, etat.reseau, actions.choisirReseau, "Tenue de l'app sur le réseau")
        }
        Question("L'app sur votre téléphone", champ("telephone"), "Lent : l'app met du temps à s'ouvrir ou à réagir.") {
            Segment(TENUES, etat.telephone, actions.choisirTelephone, "Tenue de l'app sur le téléphone")
        }
        Question("Langue dans laquelle vous avez utilisé l'app", champ("langue")) {
            Segment(LANGUES_TERRAIN, etat.langue, actions.choisirLangue, "Langue utilisée")
        }
        Question("Avez-vous bien compris les textes de l'app ?", champ("comprehension"), "1 : presque rien · 5 : tout") {
            Segment(NOTES_COMPREHENSION, etat.comprehension?.toString(), { actions.choisirComprehension(it.toInt()) }, "Compréhension de 1 à 5")
        }
        ChampTexte(
            valeur = etat.commentaire,
            surChangement = actions.saisirCommentaire,
            libelle = "Un mot sur ce qui gêne (facultatif)",
            exemple = "Par exemple : les images ne chargent pas en 3G, un mot n'est pas clair.",
            erreur = champ("commentaire"),
            actionClavier = ImeAction.Default,
            lignes = 3,
        )
    }
}
