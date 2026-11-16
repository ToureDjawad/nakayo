package bj.nakayo.testeur.ui.apps

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalInspectionMode
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.core.graphics.drawable.toBitmap
import bj.nakayo.noyau.AffectationTesteur
import bj.nakayo.noyau.AppTestee
import bj.nakayo.noyau.DerniereRemise
import bj.nakayo.testeur.R
import bj.nakayo.testeur.ui.composants.Bandeau
import bj.nakayo.testeur.ui.composants.Bouton
import bj.nakayo.testeur.ui.composants.Carte
import bj.nakayo.testeur.ui.composants.Ecran
import bj.nakayo.testeur.ui.composants.EnTete
import bj.nakayo.testeur.ui.composants.LigneIcone
import bj.nakayo.testeur.ui.composants.Note
import bj.nakayo.testeur.ui.composants.Paragraphe
import bj.nakayo.testeur.ui.composants.StyleBouton
import bj.nakayo.testeur.ui.composants.Surtitre
import bj.nakayo.testeur.ui.composants.Titre
import bj.nakayo.testeur.ui.composants.TypeBandeau
import bj.nakayo.testeur.ui.jourCourt
import bj.nakayo.testeur.ui.minutes
import bj.nakayo.testeur.ui.theme.Bricolage
import bj.nakayo.testeur.ui.theme.Couleurs
import bj.nakayo.testeur.ui.theme.NakayoTheme
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

class ActionsApp(
    val retour: () -> Unit,
    val captureChoisie: (File) -> Unit,
    val afficherErreur: (String) -> Unit,
    val confirmerInstallation: () -> Unit,
    val ecrireRapport: () -> Unit,
    val signalerBug: () -> Unit = {},
    val repondreTerrain: () -> Unit = {},
)

fun AppModele.actions() =
    ActionsApp(::retour, ::captureChoisie, ::afficherErreur, ::confirmerInstallation, ::ecrireRapport, ::signalerBug, ::repondreTerrain)

// Une app à tester (T08) : inscription au test, installation depuis le Play Store, test du jour.
@Composable
fun EcranApp(etat: EtatApp, actions: ActionsApp, mesureAutorisee: Boolean = true) {
    val a = etat.affectation
    val contexte = LocalContext.current
    val liens = LocalUriHandler.current
    val portee = rememberCoroutineScope()
    val selecteur = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) {
            portee.launch {
                val fichier = withContext(Dispatchers.IO) { runCatching { copier(contexte, uri) }.getOrNull() }
                if (fichier != null) actions.captureChoisie(fichier) else actions.afficherErreur("Image illisible. Choisissez une autre capture d'écran.")
            }
        }
    }
    fun ouvrir(lien: String) {
        runCatching { liens.openUri(lien) }.onFailure { actions.afficherErreur("Impossible d'ouvrir ce lien sur ce téléphone.") }
    }

    Ecran {
        EnTete(null, actions.retour)
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            IconeApp(a.app.paquet, a.app.nom, taille = 56.dp)
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Titre(a.app.nom)
                Note("Jour ${a.jourCampagne} sur ${a.joursCampagne} de la campagne")
            }
        }
        etat.information?.let { Bandeau(it, TypeBandeau.Succes) }
        etat.erreur?.let { Bandeau(it) }
        a.derniereRemise?.takeIf { remiseVisible(a) }?.let { BandeauRemise(it, a.usageMinimumSecondes) }
        if (a.joursAcquis) {
            Bandeau(
                "Restez inscrit au test et gardez l'app installée jusqu'à la fin de la campagne.",
                TypeBandeau.Succes,
                titre = "Vos ${a.joursExiges} jours sont validés",
            )
        }
        if (a.installationConfirmee && !a.joursAcquis && !mesureAutorisee) BandeauMesure()
        if (a.installationConfirmee) Progression(a)

        EtapeInscription(a, etat.envoiCapture, { a.lienInscription?.let(::ouvrir) }) {
            selecteur.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
        }
        if (a.inscriptionConfirmee) EtapeInstallation(a, etat.verificationInstallation, { ouvrir(a.lienPlayStore) }, actions.confirmerInstallation)
        if (a.installationConfirmee) {
            TestDuJour(a, actions.ecrireRapport, actions.signalerBug, actions.repondreTerrain) {
                val lancement = contexte.packageManager.getLaunchIntentForPackage(a.app.paquet)
                if (lancement == null) {
                    actions.afficherErreur("${a.app.nom} n'est plus installée sur ce téléphone. Réinstallez-la depuis le Play Store.")
                } else {
                    contexte.startActivity(lancement.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                }
            }
        }
    }
}

// US-20 : le compteur est revenu à zéro. Le testeur reste inscrit au test (le compteur de Google continue).
@Composable
private fun BandeauRemise(remise: DerniereRemise, usageMinimumSecondes: Int) {
    Bandeau(
        "Le ${jourCourt(remise.jour)}, il manquait ${texteManques(remise.manquait, usageMinimumSecondes)}. " +
            "Votre participation recommence au jour 1. Surtout, ne vous désinscrivez pas du test.",
        TypeBandeau.Attention,
        titre = "Votre compteur est revenu à 0",
        icone = R.drawable.ic_alerte,
    )
}

@Composable
private fun Progression(a: AffectationTesteur) {
    Carte {
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                "${a.joursValides}",
                style = MaterialTheme.typography.headlineMedium.copy(fontFamily = Bricolage, fontWeight = FontWeight(700)),
                color = Couleurs.foret,
            )
            Text("sur ${a.joursExiges} jours validés", style = MaterialTheme.typography.bodyMedium, color = Couleurs.encre2)
        }
        LinearProgressIndicator(
            progress = { (a.joursValides.toFloat() / a.joursExiges.coerceAtLeast(1)).coerceIn(0f, 1f) },
            color = Couleurs.foret,
            trackColor = Couleurs.doux,
            drawStopIndicator = {},
            modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)),
        )
        Note("Un jour compte quand vous ouvrez Nakayo, utilisez l'app ${(a.usageMinimumSecondes + 59) / 60} minutes au moins et envoyez votre rapport.")
    }
}

@Composable
private fun EtapeInscription(a: AffectationTesteur, envoiEnCours: Boolean, surLien: () -> Unit, surCapture: () -> Unit) {
    Carte {
        Surtitre("Étape 1 · S'inscrire au test")
        if (a.inscriptionConfirmee) {
            LigneIcone(R.drawable.ic_coche, "Inscription confirmée", Couleurs.vert)
            Note("Restez inscrit jusqu'à la fin de la campagne : Google ne compte que les testeurs inscrits sans interruption.")
            Bouton("Remplacer la capture", surCapture, StyleBouton.Fantome, enCours = envoiEnCours)
        } else {
            Paragraphe("1. Ouvrez le lien et touchez « Devenir testeur », avec le Gmail de ce téléphone.")
            Paragraphe("2. Faites une capture d'écran de la page « Vous êtes testeur ».")
            Paragraphe("3. Ajoutez cette capture ici.")
            if (a.lienInscription != null) Bouton("Ouvrir le lien d'inscription", surLien, StyleBouton.Secondaire)
            Bouton("Ajouter la capture d'écran", surCapture, enCours = envoiEnCours, icone = R.drawable.ic_appareil_photo)
        }
    }
}

@Composable
private fun EtapeInstallation(a: AffectationTesteur, enCours: Boolean, surPlayStore: () -> Unit, surConfirmer: () -> Unit) {
    Carte {
        Surtitre("Étape 2 · Installer l'app")
        if (a.installationConfirmee) {
            LigneIcone(R.drawable.ic_coche, "Installée depuis le Play Store", Couleurs.vert)
        } else {
            Paragraphe("Installez ${a.app.nom} depuis le Play Store. Une app installée autrement (fichier APK) ne compte pas pour le test.")
            Bouton("Installer depuis le Play Store", surPlayStore, StyleBouton.Secondaire)
            Bouton("J'ai installé l'app", surConfirmer, enCours = enCours)
        }
    }
}

@Composable
private fun TestDuJour(a: AffectationTesteur, surRapport: () -> Unit, surBug: () -> Unit, surTerrain: () -> Unit, surOuvrir: () -> Unit) {
    Carte {
        Surtitre("Test du jour")
        a.app.instructions?.takeIf { it.isNotBlank() }?.let { Paragraphe(it) }
        val identifiants = a.app.identifiantsTest
        if (a.app.connexionRequise && !identifiants.isNullOrBlank()) {
            Column(
                verticalArrangement = Arrangement.spacedBy(4.dp),
                modifier = Modifier.fillMaxWidth().background(Couleurs.doux, RoundedCornerShape(10.dp)).padding(10.dp),
            ) {
                Note("Identifiants de test")
                Text(identifiants, style = MaterialTheme.typography.bodyMedium, color = Couleurs.encre)
            }
        }
        val fait = a.usageDuJourSecondes >= a.usageMinimumSecondes
        if (!a.joursAcquis) LigneIcone(
            if (fait) R.drawable.ic_coche else R.drawable.ic_horloge,
            "Temps aujourd'hui : ${minutes(a.usageDuJourSecondes.coerceAtMost(a.usageMinimumSecondes))} sur ${minutes(a.usageMinimumSecondes)}",
            if (fait) Couleurs.vert else Couleurs.ocreEncre,
        )
        Bouton("Ouvrir ${a.app.nom}", surOuvrir, StyleBouton.Secondaire)
        if (a.rapportDuJour) {
            LigneIcone(R.drawable.ic_coche, "Rapport du jour envoyé", Couleurs.vert)
            Note("Revenez demain pour le jour suivant.")
        } else if (!a.joursAcquis) {
            if (a.retourDetailleAttendu) Note("Aujourd'hui, un avis détaillé sur l'app vous est aussi demandé.")
            Bouton("Écrire le rapport du jour", surRapport, icone = R.drawable.ic_message)
        }
        // US-33 : bugs avec captures, possibles à tout moment de la campagne.
        if (a.rapportsDeBugs) {
            Bouton("Signaler un bug", surBug, StyleBouton.Secondaire, icone = R.drawable.ic_alerte)
            Note("Chaque bug accepté par le développeur vous rapporte 200 FCFA de plus.")
        }
        // US-37 : questionnaire terrain, une fois, à partir du 7e jour.
        a.questionnaireTerrain?.let { q ->
            when {
                q.envoye -> LigneIcone(R.drawable.ic_coche, "Questionnaire terrain envoyé", Couleurs.vert)
                q.ouvert -> Bouton("Répondre au questionnaire terrain", surTerrain, StyleBouton.Secondaire, icone = R.drawable.ic_message)
                else -> Note("Un questionnaire sur le réseau, le téléphone et la langue s'ouvrira au jour ${q.ouvertLe}.")
            }
        }
    }
}

// US-18 : sans l'accès aux statistiques d'usage, le temps passé dans l'app n'est pas mesuré et le jour ne compte pas.
@Composable
fun BandeauMesure() {
    val contexte = LocalContext.current
    Bandeau(
        "Nakayo a besoin de l'accès aux statistiques d'usage d'Android pour mesurer le temps passé dans les apps que vous testez. " +
            "Seul ce temps est envoyé, pour ces apps uniquement : rien sur vos autres apps. Sans cet accès, vos jours ne comptent pas. " +
            "Touchez le bouton, choisissez Nakayo dans la liste, puis activez l'accès.",
        TypeBandeau.Attention,
        titre = "Autorisez Nakayo à mesurer le temps d'utilisation",
        icone = R.drawable.ic_horloge,
    )
    Bouton("Autoriser l'accès", {
        runCatching { contexte.startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
            .onFailure { runCatching { contexte.startActivity(Intent(Settings.ACTION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) } }
    }, StyleBouton.Secondaire)
}

// Icône de l'app installée sur le téléphone, sinon son initiale.
@Composable
fun IconeApp(paquet: String, nom: String, taille: Dp = 44.dp) {
    val contexte = LocalContext.current
    val apercu = LocalInspectionMode.current
    val image = remember(paquet) {
        if (apercu) null else runCatching { contexte.packageManager.getApplicationIcon(paquet).toBitmap(96, 96).asImageBitmap() }.getOrNull()
    }
    if (image != null) {
        Image(image, contentDescription = null, modifier = Modifier.size(taille).clip(RoundedCornerShape(taille / 4)))
    } else {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier.size(taille).background(Couleurs.menthe, RoundedCornerShape(taille / 4)),
        ) {
            Text(
                nom.trim().take(1).uppercase().ifEmpty { "?" },
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight(700)),
                color = Couleurs.foret,
            )
        }
    }
}

// Copie l'image choisie dans le cache de l'app, pour la réduire avant l'envoi.
internal fun copier(contexte: Context, uri: Uri): File {
    val dossier = File(contexte.cacheDir, "photos").apply { mkdirs() }
    val fichier = File.createTempFile("capture", ".img", dossier)
    contexte.contentResolver.openInputStream(uri).use { entree ->
        requireNotNull(entree) { "Image introuvable" }
        fichier.outputStream().use { entree.copyTo(it) }
    }
    return fichier
}

@Preview(widthDp = 360, heightDp = 1100)
@Composable
private fun ApercuApp() {
    val a = AffectationTesteur(
        id = "31", campagneId = "4",
        app = AppTestee("12", "Marché Facile", "bj.studioawa.marche", "Cherchez un produit et ajoutez-le au panier.", listOf("Panier"), true, "test@marche.bj / Test2026"),
        lienInscription = "https://play.google.com/apps/testing/bj.studioawa.marche",
        lienPlayStore = "https://play.google.com/store/apps/details?id=bj.studioawa.marche",
        jourCampagne = 5, joursCampagne = 16, joursExiges = 14, joursValides = 0,
        derniereRemise = DerniereRemise("2026-11-11", listOf("usage", "rapport")),
        inscriptionConfirmee = true, installationConfirmee = true, rapportDuJour = false, retourDetailleAttendu = false,
        usageDuJourSecondes = 95,
    )
    NakayoTheme { EcranApp(EtatApp(a), ActionsApp({}, {}, {}, {}, {})) }
}
