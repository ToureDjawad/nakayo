package bj.nakayo.testeur.ui

import android.Manifest
import android.app.Activity
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.platform.LocalContext
import bj.nakayo.testeur.campagne.NotificationsRappel
import androidx.activity.compose.BackHandler
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.lifecycle.compose.LifecycleResumeEffect
import bj.nakayo.testeur.ui.apps.EcranApp
import bj.nakayo.testeur.ui.apps.EcranBug
import bj.nakayo.testeur.ui.apps.EcranTerrain
import bj.nakayo.testeur.ui.apps.EcranRapport
import bj.nakayo.testeur.ui.apps.actions as actionsApp
import bj.nakayo.testeur.ui.apps.actions as actionsRapport
import bj.nakayo.testeur.ui.apps.actions as actionsBug
import bj.nakayo.testeur.ui.apps.actions as actionsTerrain
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import bj.nakayo.testeur.ui.accueil.EcranAccueil
import bj.nakayo.testeur.ui.composants.Chargement
import bj.nakayo.testeur.ui.composants.Ecran as Page
import bj.nakayo.testeur.ui.connexion.EcranConnexion
import bj.nakayo.testeur.ui.connexion.ModeConnexion
import bj.nakayo.testeur.ui.espace.EcranEspace
import bj.nakayo.testeur.ui.espace.EtatEspace
import bj.nakayo.testeur.ui.inscription.EcranInscription
import bj.nakayo.testeur.ui.profil.EcranProfil
import bj.nakayo.testeur.ui.profil.actions
import bj.nakayo.testeur.ui.portefeuille.EcranPortefeuille
import bj.nakayo.testeur.ui.portefeuille.actions as actionsPortefeuille
import bj.nakayo.testeur.ui.support.EcranSupport
import bj.nakayo.testeur.ui.support.actions as actionsSupport

// Racine de l'interface : affiche l'écran courant de la navigation.
@Composable
fun AppNakayo(navigation: Navigation) {
    val ecran by navigation.ecran.collectAsStateWithLifecycle()
    val mesureAutorisee by navigation.mesureAutorisee.collectAsStateWithLifecycle()
    BackHandler(
        enabled = ecran is Ecran.Connexion || ecran is Ecran.Inscription || ecran is Ecran.Profil || ecran is Ecran.Support ||
            ecran is Ecran.App || ecran is Ecran.Rapport || ecran is Ecran.Bug || ecran is Ecran.Terrain || ecran is Ecran.Portefeuille,
    ) { navigation.retour() }

    // Retour dans l'app (depuis le Play Store, l'app testée ou le lendemain) : l'écran est relu.
    var premiereReprise by remember { mutableStateOf(true) }
    LifecycleResumeEffect(navigation) {
        if (premiereReprise) premiereReprise = false else navigation.auPremierPlan()
        onPauseOrDispose { }
    }

    // Icônes de la barre d'état claires sur le fond vert de l'accueil, sombres ailleurs.
    val vue = LocalView.current
    if (!vue.isInEditMode) {
        SideEffect {
            (vue.context as? Activity)?.window?.let { fenetre ->
                WindowCompat.getInsetsController(fenetre, vue).isAppearanceLightStatusBars = ecran !is Ecran.Accueil
            }
        }
    }

    when (val actuel = ecran) {
        Ecran.Demarrage -> Page(centrer = true) { Chargement("Ouverture de Nakayo…") }
        is Ecran.Accueil -> {
            val etat by actuel.modele.etat.collectAsStateWithLifecycle()
            EcranAccueil(
                etat,
                surReessayer = actuel.modele::actualiser,
                surCreerCompte = { navigation.allerConnexion(ModeConnexion.Creation) },
                surConnexion = { navigation.allerConnexion(ModeConnexion.Connexion) },
                information = actuel.modele.information,
            )
        }
        is Ecran.Connexion -> {
            val m = actuel.modele
            val etat by m.etat.collectAsStateWithLifecycle()
            EcranConnexion(
                etat,
                surRetour = { navigation.retour() },
                surOperateur = m::choisirOperateur,
                surTelephone = m::saisirTelephone,
                surEnvoyer = m::envoyerCode,
                surCode = m::saisirCode,
                surVerifier = m::verifierCode,
                surRenvoyer = m::renvoyerCode,
                surModifierNumero = m::modifierNumero,
            )
        }
        is Ecran.Inscription -> {
            val etat by actuel.modele.etat.collectAsStateWithLifecycle()
            EcranInscription(etat, actuel.modele, actuel.modele.operateurDejaChoisi)
        }
        is Ecran.Espace -> {
            val m = actuel.modele
            val etat by m.etat.collectAsStateWithLifecycle()
            val whatsapp by m.whatsapp.collectAsStateWithLifecycle()
            val liens = LocalUriHandler.current
            // US-25 : les rappels du soir ont besoin des notifications, demandées dès qu'une app est à tester.
            val pret = etat as? EtatEspace.Pret
            if (pret?.profil?.statut == "valide" && !pret.apps.isNullOrEmpty()) DemandeNotifications()
            EcranEspace(
                etat,
                surReessayer = m::actualiser,
                surDeconnecter = m::deconnecter,
                surProfil = { (etat as? EtatEspace.Pret)?.let { navigation.allerProfil(it.profil) } },
                whatsapp = whatsapp,
                surEcrire = { navigation.allerSupport((etat as? EtatEspace.Pret)?.profil) },
                surPortefeuille = { navigation.allerPortefeuille((etat as? EtatEspace.Pret)?.profil) },
                surApp = { a -> navigation.allerApp(a, (etat as? EtatEspace.Pret)?.profil) },
                mesureAutorisee = mesureAutorisee,
                // Sans WhatsApp ni navigateur sur le téléphone, le bouton ne fait rien plutôt que de planter.
                surWhatsapp = { numero ->
                    runCatching { liens.openUri(lienWhatsapp(numero, messageSupport((etat as? EtatEspace.Pret)?.profil))) }
                },
            )
        }
        is Ecran.Profil -> {
            val etat by actuel.modele.etat.collectAsStateWithLifecycle()
            EcranProfil(etat, actuel.modele.actions())
        }
        is Ecran.Support -> {
            val etat by actuel.modele.etat.collectAsStateWithLifecycle()
            EcranSupport(etat, actuel.modele.actionsSupport())
        }
        is Ecran.App -> {
            val etat by actuel.modele.etat.collectAsStateWithLifecycle()
            EcranApp(etat, actuel.modele.actionsApp(), mesureAutorisee)
        }
        is Ecran.Rapport -> {
            val etat by actuel.modele.etat.collectAsStateWithLifecycle()
            EcranRapport(etat, actuel.modele.affectation, actuel.modele.actionsRapport())
        }
        is Ecran.Bug -> {
            val etat by actuel.modele.etat.collectAsStateWithLifecycle()
            EcranBug(etat, actuel.modele.affectation.app.nom, actuel.modele.actionsBug())
        }
        is Ecran.Terrain -> {
            val etat by actuel.modele.etat.collectAsStateWithLifecycle()
            EcranTerrain(etat, actuel.modele.affectation.app.nom, actuel.modele.actionsTerrain())
        }
        is Ecran.Portefeuille -> {
            val etat by actuel.modele.etat.collectAsStateWithLifecycle()
            EcranPortefeuille(etat, actuel.modele.actionsPortefeuille())
        }
    }
}

// Android 13 et plus : une seule demande par ouverture de l'app ; Android cesse lui-même après deux refus.
@Composable
private fun DemandeNotifications() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
    val contexte = LocalContext.current
    var demandee by remember { mutableStateOf(false) }
    val demande = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }
    LaunchedEffect(Unit) {
        if (!demandee && !NotificationsRappel.autorisees(contexte)) {
            demandee = true
            demande.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }
}
