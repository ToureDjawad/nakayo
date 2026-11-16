package bj.nakayo.testeur.ui.inscription

import android.content.ActivityNotFoundException
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.selectable
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.error
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import bj.nakayo.noyau.Appareil
import bj.nakayo.noyau.Photo
import bj.nakayo.testeur.R
import bj.nakayo.testeur.ui.MessagesChamps
import bj.nakayo.testeur.ui.composants.Bandeau
import bj.nakayo.testeur.ui.composants.Bouton
import bj.nakayo.testeur.ui.composants.CarteTeleversement
import bj.nakayo.testeur.ui.composants.CaseACocher
import bj.nakayo.testeur.ui.composants.ChampTexte
import bj.nakayo.testeur.ui.composants.EnTete
import bj.nakayo.testeur.ui.composants.Ecran
import bj.nakayo.testeur.ui.composants.FORME
import bj.nakayo.testeur.ui.composants.Note
import bj.nakayo.testeur.ui.composants.Paragraphe
import bj.nakayo.testeur.ui.composants.Puce
import bj.nakayo.testeur.ui.composants.Segment
import bj.nakayo.testeur.ui.composants.Titre
import bj.nakayo.testeur.ui.composants.TypeBandeau
import bj.nakayo.testeur.ui.connexion.OPERATEURS
import bj.nakayo.testeur.ui.theme.Couleurs
import bj.nakayo.testeur.ui.theme.NakayoTheme
import java.io.File
import bj.nakayo.testeur.ui.descriptionAppareil


// Écrans T03 (profil) et T04 (pièce d'identité, selfie et consentements) de la maquette.
@Composable
fun EcranInscription(etat: EtatInscription, actions: ActionsInscription, operateurDejaChoisi: Boolean) {
    when (etat.etape) {
        EtapeInscription.Profil -> EtapeProfil(etat, actions, operateurDejaChoisi)
        EtapeInscription.Pieces -> EtapePieces(etat, actions)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun EtapeProfil(etat: EtatInscription, actions: ActionsInscription, operateurDejaChoisi: Boolean) {
    Ecran(pied = { Bouton("Continuer", actions::continuer) }) {
        EnTete("Étape 2 sur 4", actions::retour)
        Titre("Faisons connaissance")
        etat.message?.let { Bandeau(it) }
        ChampTexte(
            valeur = etat.nom,
            surChangement = actions::saisirNom,
            libelle = "Nom et prénom",
            exemple = "Afi Dossou",
            erreur = etat.erreurs["nom"]?.let(MessagesChamps::nom),
        )
        ChoixVille(etat, actions)
        ChampTexte(
            valeur = etat.gmail,
            surChangement = actions::saisirGmail,
            libelle = "Adresse Gmail du Play Store",
            exemple = "prenom.nom@gmail.com",
            aide = "Celle ouverte dans le Play Store de ce téléphone : c'est avec elle que vous rejoindrez les tests.",
            erreur = etat.erreurs["gmail"]?.let(MessagesChamps::gmail),
            clavier = KeyboardType.Email,
            actionClavier = ImeAction.Next,
        )
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Libelle("Depuis quand utilisez-vous ce Gmail sur le Play Store ?")
            Segment(ANCIENNETES_GMAIL, etat.ancienneteGmail, actions::choisirAncienneteGmail, "Ancienneté du Gmail")
            etat.erreurs["ancienneteGmail"]?.let { Erreur(MessagesChamps.ancienneteGmail(it)) }
        }
        // US-39 : code de la personne qui a invité le testeur.
        ChampTexte(
            valeur = etat.codeParrainage,
            surChangement = actions::saisirCodeParrainage,
            libelle = "Code de parrainage (si on vous a invité)",
            exemple = "K7Q2MP",
            aide = "Le code à 6 caractères du testeur Nakayo qui vous a invité. Vous pouvez laisser ce champ vide.",
            erreur = etat.erreurs["codeParrainage"]?.let(MessagesChamps::codeParrainage),
            actionClavier = ImeAction.Done,
        )
        // Opérateur demandé ici seulement si le testeur est passé par « J'ai déjà un compte ».
        if (!operateurDejaChoisi) {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Libelle("Opérateur Mobile Money de votre numéro")
                Segment(OPERATEURS, etat.operateur, actions::choisirOperateur, "Opérateur Mobile Money")
                etat.erreurs["operateurMomo"]?.let { Erreur(MessagesChamps.operateur(it)) }
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Libelle("Langues parlées")
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                LANGUES.forEach { (code, nom) -> Puce(nom, code in etat.langues) { actions.basculerLangue(code) } }
            }
            etat.erreurs["langues"]?.let { Erreur(MessagesChamps.langues(it)) }
        }
        etat.appareil?.let { Bandeau("${descriptionAppareil(it)} détecté automatiquement.", TypeBandeau.Information, icone = R.drawable.ic_telephone) }
    }
}

// Liste déroulante des villes, avec « Autre ville » en saisie libre.
@Composable
private fun ChoixVille(etat: EtatInscription, actions: ActionsInscription) {
    var ouvert by remember { mutableStateOf(false) }
    val erreur = etat.erreurs["ville"]?.let(MessagesChamps::ville)
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Libelle("Ville")
        Box {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp)
                    .background(Couleurs.blanc, FORME)
                    .border(1.dp, if (erreur != null && etat.ville != AUTRE_VILLE) Couleurs.rouge else Couleurs.trait, FORME)
                    .selectable(selected = ouvert, role = Role.DropdownList, onClick = { ouvert = true })
                    .semantics {
                        contentDescription = "Ville"
                        stateDescription = etat.ville.ifEmpty { "Aucune ville choisie" }
                        if (erreur != null && etat.ville != AUTRE_VILLE) error(erreur)
                    }
                    .padding(horizontal = 13.dp, vertical = 11.dp),
            ) {
                Text(
                    etat.ville.ifEmpty { "Choisissez votre ville" },
                    style = MaterialTheme.typography.bodyMedium,
                    color = if (etat.ville.isEmpty()) Couleurs.discret else Couleurs.encre,
                    modifier = Modifier.weight(1f),
                )
                Icon(painterResource(R.drawable.ic_chevron_bas), contentDescription = null, tint = Couleurs.encre2, modifier = Modifier.size(18.dp))
            }
            DropdownMenu(expanded = ouvert, onDismissRequest = { ouvert = false }, modifier = Modifier.background(Couleurs.blanc)) {
                (VILLES + AUTRE_VILLE).forEach { ville ->
                    DropdownMenuItem(
                        text = { Text(ville, style = MaterialTheme.typography.bodyMedium, color = Couleurs.encre) },
                        onClick = {
                            actions.choisirVille(ville)
                            ouvert = false
                        },
                    )
                }
            }
        }
        if (erreur != null && etat.ville != AUTRE_VILLE) Erreur(erreur)
    }
    if (etat.ville == AUTRE_VILLE) {
        ChampTexte(
            valeur = etat.villeLibre,
            surChangement = actions::saisirVilleLibre,
            libelle = "Nom de votre ville",
            erreur = erreur,
        )
    }
}

@Composable
private fun EtapePieces(etat: EtatInscription, actions: ActionsInscription) {
    val contexte = LocalContext.current
    // Champ et fichier en cours de prise de vue, gardés si Android recrée l'écran pendant que l'appareil photo est ouvert.
    var champEnCours by rememberSaveable { mutableStateOf<String?>(null) }
    var cheminEnCours by rememberSaveable { mutableStateOf<String?>(null) }
    val appareilPhoto = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { reussie ->
        val champ = ChampPhoto.entries.firstOrNull { it.name == champEnCours }
        val fichier = cheminEnCours?.let(::File)
        if (reussie && champ != null && fichier != null && fichier.length() > 0) actions.photoPrise(champ, fichier) else fichier?.delete()
        champEnCours = null
        cheminEnCours = null
    }
    fun photographier(champ: ChampPhoto) {
        val dossier = File(contexte.cacheDir, "photos").apply { mkdirs() }
        val fichier = File.createTempFile(champ.cle, ".jpg", dossier)
        champEnCours = champ.name
        cheminEnCours = fichier.path
        try {
            appareilPhoto.launch(FileProvider.getUriForFile(contexte, "${contexte.packageName}.photos", fichier))
        } catch (_: ActivityNotFoundException) {
            fichier.delete()
            actions.photoImpossible("Aucune application d'appareil photo n'est disponible sur ce téléphone.")
        }
    }

    Ecran(pied = { Bouton("Envoyer pour validation", actions::envoyer, enCours = etat.enCours, actif = etat.photoEnPreparation == null) }) {
        EnTete("Étape 3 sur 4", actions::retour)
        Titre("Une personne, un compte")
        Paragraphe("Nous vérifions que vous êtes une vraie personne. Les photos sont supprimées 30 jours après la validation.")
        etat.message?.let { Bandeau(it) }
        CarteTeleversement(
            titre = "Carte d'identité ou CIP",
            detail = when {
                etat.photoEnPreparation == ChampPhoto.PieceIdentite -> "Préparation de la photo…"
                etat.pieceIdentite != null -> "Recto ajouté. Touchez pour reprendre la photo."
                else -> "Photo du recto, bien lisible"
            },
            fait = etat.pieceIdentite != null,
            icone = R.drawable.ic_carte,
            surClic = { if (!etat.enCours) photographier(ChampPhoto.PieceIdentite) },
            erreur = etat.erreurs[ChampPhoto.PieceIdentite.cle]?.let(MessagesChamps::photo),
        )
        CarteTeleversement(
            titre = "Selfie avec la pièce",
            detail = when {
                etat.photoEnPreparation == ChampPhoto.Selfie -> "Préparation de la photo…"
                etat.selfie != null -> "Selfie ajouté. Touchez pour le reprendre."
                else -> "Visage et pièce bien visibles"
            },
            fait = etat.selfie != null,
            icone = R.drawable.ic_appareil_photo,
            surClic = { if (!etat.enCours) photographier(ChampPhoto.Selfie) },
            erreur = etat.erreurs[ChampPhoto.Selfie.cle]?.let(MessagesChamps::photo),
        )
        CaseACocher(
            coche = etat.accepteConditions,
            surChangement = actions::accepterConditions,
            texte = "J'accepte les CGU testeur, dont l'interdiction de laisser un avis public sur les apps testées.",
            erreur = "accepteConditions" in etat.erreurs,
        )
        CaseACocher(
            coche = etat.consentementSuivi,
            surChangement = actions::consentirSuivi,
            texte = "J'accepte que Nakayo mesure mon temps d'utilisation des apps que je teste, et seulement celles-là.",
            erreur = "consentementSuivi" in etat.erreurs,
        )
        if ("accepteConditions" in etat.erreurs || "consentementSuivi" in etat.erreurs) {
            Erreur("Cochez les deux cases pour envoyer votre inscription.")
        }
        Note("Les photos sont réduites à 300 Ko environ avant l'envoi, pour économiser vos données.")
    }
}

@Composable
private fun Libelle(texte: String) {
    Text(texte, style = MaterialTheme.typography.labelMedium, color = Couleurs.encre2, modifier = Modifier.clearAndSetSemantics { })
}

@Composable
private fun Erreur(texte: String) {
    Text(texte, style = MaterialTheme.typography.bodySmall, color = Couleurs.rouge)
}


private object ActionsVides : ActionsInscription {
    override fun retour() = Unit
    override fun saisirNom(valeur: String) = Unit
    override fun choisirVille(valeur: String) = Unit
    override fun saisirVilleLibre(valeur: String) = Unit
    override fun saisirGmail(valeur: String) = Unit
    override fun saisirCodeParrainage(valeur: String) = Unit
    override fun choisirOperateur(code: String) = Unit
    override fun choisirAncienneteGmail(code: String) = Unit
    override fun basculerLangue(code: String) = Unit
    override fun continuer() = Unit
    override fun photoPrise(champ: ChampPhoto, fichier: File) = Unit
    override fun photoImpossible(message: String) = Unit
    override fun accepterConditions(valeur: Boolean) = Unit
    override fun consentirSuivi(valeur: Boolean) = Unit
    override fun envoyer() = Unit
}

@Preview(widthDp = 360, heightDp = 760)
@Composable
private fun ApercuProfil() {
    NakayoTheme {
        EcranInscription(
            EtatInscription(
                nom = "Afi Dossou",
                ville = "Cotonou",
                gmail = "afi.dossou@gmail",
                langues = setOf("fr", "en"),
                operateur = "mtn",
                appareil = Appareil("Tecno", "Spark 10", "13", 33),
                erreurs = mapOf("gmail" to "format_invalide"),
            ),
            ActionsVides,
            operateurDejaChoisi = true,
        )
    }
}

@Preview(widthDp = 360, heightDp = 760)
@Composable
private fun ApercuPieces() {
    NakayoTheme {
        EcranInscription(
            EtatInscription(etape = EtapeInscription.Pieces, pieceIdentite = Photo(ByteArray(1)), accepteConditions = true),
            ActionsVides,
            operateurDejaChoisi = true,
        )
    }
}
