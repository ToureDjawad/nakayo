package bj.nakayo.testeur.ui.profil

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import bj.nakayo.noyau.Appareil
import bj.nakayo.noyau.ConditionNiveau
import bj.nakayo.noyau.DemandeChangementMomo
import bj.nakayo.noyau.NiveauSuivant
import bj.nakayo.noyau.NiveauTesteur
import bj.nakayo.noyau.ProfilTesteur
import bj.nakayo.testeur.ui.MessagesChamps
import bj.nakayo.testeur.ui.composants.Bandeau
import bj.nakayo.testeur.ui.composants.Bouton
import bj.nakayo.testeur.ui.composants.Carte
import bj.nakayo.testeur.ui.composants.ChampTexte
import bj.nakayo.testeur.ui.composants.EnTete
import bj.nakayo.testeur.ui.composants.Ecran
import bj.nakayo.testeur.ui.composants.LigneInfo
import bj.nakayo.testeur.ui.composants.Note
import bj.nakayo.testeur.ui.composants.Paragraphe
import bj.nakayo.testeur.ui.composants.Pastille
import bj.nakayo.testeur.ui.composants.Puce
import bj.nakayo.testeur.ui.composants.Segment
import bj.nakayo.testeur.ui.composants.Surtitre
import bj.nakayo.testeur.ui.composants.Titre
import bj.nakayo.testeur.ui.composants.TypeBandeau
import bj.nakayo.testeur.ui.connexion.OPERATEURS
import bj.nakayo.testeur.ui.afficher
import bj.nakayo.testeur.ui.operateur
import bj.nakayo.testeur.ui.inscription.LANGUES
import bj.nakayo.testeur.ui.descriptionAppareil
import bj.nakayo.testeur.ui.theme.Bricolage
import bj.nakayo.testeur.ui.theme.Couleurs
import bj.nakayo.testeur.ui.theme.NakayoTheme
import bj.nakayo.testeur.ui.depuis
import bj.nakayo.testeur.ui.initiales

class ActionsProfil(
    val retour: () -> Unit,
    val basculerLangue: (String) -> Unit,
    val enregistrerLangues: () -> Unit,
    val ouvrirChangementMomo: () -> Unit,
    val saisirNumeroMomo: (String) -> Unit,
    val choisirOperateurMomo: (String) -> Unit,
    val saisirMotif: (String) -> Unit,
    val envoyerDemande: () -> Unit,
)

fun ProfilModele.actions() = ActionsProfil(
    ::retour, ::basculerLangue, ::enregistrerLangues, ::ouvrirChangementMomo, ::saisirNumeroMomo, ::choisirOperateurMomo, ::saisirMotif, ::envoyerDemande,
)

// Écran T14 de la maquette (profil), réduit à ce qui existe au Sprint 1.
@Composable
fun EcranProfil(etat: EtatProfil, actions: ActionsProfil) {
    when (etat.vue) {
        VueProfil.Resume -> Resume(etat, actions)
        VueProfil.ChangementMomo -> ChangementMomo(etat, actions)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Resume(etat: EtatProfil, actions: ActionsProfil) {
    val profil = etat.profil
    val pied: (@Composable ColumnScope.() -> Unit)? = if (etat.languesModifiees) {
        { Bouton("Enregistrer mes langues", actions.enregistrerLangues, enCours = etat.enregistrementLangues) }
    } else {
        null
    }
    Ecran(pied = pied) {
        EnTete("Mon profil", actions.retour)
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(52.dp)
                    .background(Couleurs.argile, CircleShape)
                    .clearAndSetSemantics { },
            ) {
                Text(initiales(profil.nom), color = Couleurs.blanc, style = TextStyle(fontFamily = Bricolage, fontWeight = FontWeight(600), fontSize = 18.sp))
            }
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Titre(profil.nom)
                Note(listOfNotNull(profil.ville, depuis(profil.creeLe)?.let { "membre depuis $it" }).joinToString(" · "))
            }
        }
        etat.information?.let { Bandeau(it, TypeBandeau.Succes) }
        etat.erreur?.let { Bandeau(it) }
        profil.niveau?.let { CarteNiveau(it) }
        Carte(espacement = 0.dp, marge = PaddingValues(horizontal = 14.dp, vertical = 4.dp)) {
            LigneInfo("Mon téléphone", profil.appareil?.let(::descriptionAppareil) ?: "Non renseigné")
            LigneInfo("Numéro de connexion", afficher(profil.telephone))
            LigneInfo("Gmail du Play Store", profil.gmail ?: "Non renseigné")
            LigneInfo(
                "Numéro MoMo",
                profil.numeroMomo?.let { "${afficher(it)} · ${operateur(profil.operateurMomo)}" } ?: "Non renseigné",
                separateur = false,
            )
            val demande = profil.demandeChangementMomo
            if (demande != null && demande.statut == "en_attente") {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Pastille("Changement en vérification", Couleurs.ocreDoux, Couleurs.ocreEncre)
                    Note("vers ${afficher(demande.numeroMomo)}")
                }
                Box(Modifier.size(1.dp, 10.dp))
            } else {
                TextButton(onClick = actions.ouvrirChangementMomo, contentPadding = PaddingValues(0.dp)) {
                    Text("Demander une modification", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight(600)), color = Couleurs.foret)
                }
            }
        }
        Carte {
            Surtitre("Langues parlées")
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                LANGUES.forEach { (code, nom) -> Puce(nom, code in etat.langues) { actions.basculerLangue(code) } }
            }
            Note("Elles servent à vous proposer des apps dans les langues que vous comprenez.")
        }
        Note("Le Gmail et le numéro de connexion ne se modifient pas. Pour toute correction, contactez l'équipe Nakayo.")
    }
}

@Composable
private fun ChangementMomo(etat: EtatProfil, actions: ActionsProfil) {
    Ecran(pied = { Bouton("Envoyer la demande", actions.envoyerDemande, enCours = etat.envoiDemande) }) {
        EnTete(null, actions.retour)
        Titre("Changer de numéro Mobile Money")
        Paragraphe("L'équipe Nakayo vérifie chaque demande. En attendant, vos paiements restent versés sur votre numéro actuel.")
        etat.messageDemande?.let { Bandeau(it) }
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Segment(OPERATEURS, etat.operateurMomo, actions.choisirOperateurMomo, "Opérateur du nouveau numéro")
            etat.erreurs["operateurMomo"]?.let { Text(MessagesChamps.operateur(it), style = MaterialTheme.typography.bodySmall, color = Couleurs.rouge) }
        }
        ChampTexte(
            valeur = etat.numeroMomo,
            surChangement = actions.saisirNumeroMomo,
            libelle = "Nouveau numéro Mobile Money",
            exemple = "01 97 45 12 08",
            prefixe = "+229",
            erreur = etat.erreurs["numeroMomo"]?.let(MessagesChamps::numeroMomo),
            clavier = KeyboardType.Phone,
        )
        ChampTexte(
            valeur = etat.motif,
            surChangement = actions.saisirMotif,
            libelle = "Pourquoi changer de numéro ?",
            exemple = "Par exemple : j'ai perdu ma puce.",
            aide = "Entre 10 et 300 caractères.",
            erreur = etat.erreurs["motif"]?.let(MessagesChamps::motif),
            actionClavier = ImeAction.Default,
            lignes = 3,
        )
    }
}


@Preview(widthDp = 360, heightDp = 760)
@Composable
private fun ApercuProfil() {
    val profil = ProfilTesteur(
        id = "1", role = "testeur", statut = "en_attente", telephone = "+2290197000000", nom = "Afi Dossou", ville = "Cotonou",
        gmail = "afi.dossou@gmail.com", numeroMomo = "+2290197000000", operateurMomo = "mtn", langues = listOf("fr", "en"),
        appareil = Appareil("Tecno", "Spark 10", "13", 33),
        demandeChangementMomo = DemandeChangementMomo("3", "+2290196000000", "moov", "en_attente", "2026-11-11T10:00:00.000Z"),
        creeLe = "2026-11-10T14:07:01.512Z",
        niveau = NiveauTesteur(
            "argent", "Argent", campagnesTerminees = 1, bugsAcceptes = 1, assiduite = 66,
            suivant = NiveauSuivant(
                "or", "Or",
                listOf(ConditionNiveau("campagnes", 3, 1, false), ConditionNiveau("bugs", 2, 1, false), ConditionNiveau("assiduite", 75, 66, false)),
            ),
        ),
    )
    NakayoTheme { EcranProfil(EtatProfil(profil), ActionsProfil({}, {}, {}, {}, {}, {}, {}, {})) }
}
