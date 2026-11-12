package bj.nakayo.testeur.ui

import android.app.Activity
import androidx.activity.compose.BackHandler
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
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

// Racine de l'interface : affiche l'écran courant de la navigation.
@Composable
fun AppNakayo(navigation: Navigation) {
    val ecran by navigation.ecran.collectAsStateWithLifecycle()
    BackHandler(enabled = ecran is Ecran.Connexion || ecran is Ecran.Inscription || ecran is Ecran.Profil) { navigation.retour() }

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
            EcranEspace(
                etat,
                surReessayer = m::actualiser,
                surDeconnecter = m::deconnecter,
                surProfil = { (etat as? EtatEspace.Pret)?.let { navigation.allerProfil(it.profil) } },
                whatsapp = whatsapp,
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
    }
}
