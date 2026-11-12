package bj.nakayo.testeur.ui.support

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import bj.nakayo.noyau.Ticket
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
import bj.nakayo.testeur.ui.composants.Surtitre
import bj.nakayo.testeur.ui.composants.Titre
import bj.nakayo.testeur.ui.composants.TypeBandeau
import bj.nakayo.testeur.ui.jour
import bj.nakayo.testeur.ui.theme.Couleurs
import bj.nakayo.testeur.ui.theme.NakayoTheme

class ActionsSupport(
    val retour: () -> Unit,
    val saisirSujet: (String) -> Unit,
    val saisirMessage: (String) -> Unit,
    val envoyer: () -> Unit,
)

fun SupportModele.actions() = ActionsSupport(::retour, ::saisirSujet, ::saisirMessage, ::envoyer)

// Écrire à l'équipe Nakayo (US-40) : sujet, message, puis les messages déjà envoyés.
@Composable
fun EcranSupport(etat: EtatSupport, actions: ActionsSupport) {
    Ecran(pied = { Bouton("Envoyer le message", actions.envoyer, enCours = etat.envoiEnCours) }) {
        EnTete(null, actions.retour)
        Titre("Écrire à l'équipe Nakayo")
        Paragraphe("Une question sur votre compte ou une campagne ? Écrivez-nous, nous vous répondons par SMS ou sur WhatsApp.")
        etat.information?.let { Bandeau(it, TypeBandeau.Succes) }
        etat.erreur?.let { Bandeau(it) }
        ChampTexte(
            valeur = etat.sujet,
            surChangement = actions.saisirSujet,
            libelle = "Sujet",
            exemple = "Par exemple : paiement Mobile Money",
            erreur = etat.erreurs["sujet"]?.let(MessagesChamps::sujet),
        )
        ChampTexte(
            valeur = etat.message,
            surChangement = actions.saisirMessage,
            libelle = "Votre message",
            aide = "Entre $MESSAGE_MIN et $MESSAGE_MAX caractères.",
            erreur = etat.erreurs["message"]?.let(MessagesChamps::message),
            actionClavier = ImeAction.Default,
            lignes = 5,
        )
        val tickets = etat.tickets
        if (!tickets.isNullOrEmpty()) {
            Carte {
                Surtitre("Vos messages")
                tickets.forEach { LigneTicket(it) }
            }
        }
    }
}

@Composable
private fun LigneTicket(ticket: Ticket) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(
            ticket.sujet,
            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight(600)),
            color = Couleurs.encre,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        if (ticket.statut == "traite") {
            Pastille("Traité", Couleurs.vertDoux, Couleurs.vert)
        } else {
            Pastille("Envoyé", Couleurs.ocreDoux, Couleurs.ocreEncre)
        }
    }
    jour(ticket.creeLe)?.let { Note("Envoyé le $it") }
}

@Preview(widthDp = 360, heightDp = 760)
@Composable
private fun ApercuSupport() {
    val tickets = listOf(Ticket("1", "Paiement Mobile Money", "…", "traite", "2026-11-10T09:00:00.000Z", "2026-11-10T11:00:00.000Z"))
    NakayoTheme { EcranSupport(EtatSupport(tickets = tickets), ActionsSupport({}, {}, {}, {})) }
}
