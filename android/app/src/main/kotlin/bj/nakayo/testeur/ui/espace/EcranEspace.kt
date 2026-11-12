package bj.nakayo.testeur.ui.espace

import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.ui.Alignment
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextOverflow
import bj.nakayo.noyau.AffectationTesteur
import bj.nakayo.noyau.ProfilTesteur
import bj.nakayo.testeur.ui.apps.Etape
import bj.nakayo.testeur.ui.apps.IconeApp
import bj.nakayo.testeur.ui.apps.etape
import bj.nakayo.testeur.ui.apps.libelleEtape
import bj.nakayo.testeur.ui.apps.remiseVisible
import bj.nakayo.testeur.ui.composants.FORME_CARTE
import bj.nakayo.testeur.ui.composants.Note
import bj.nakayo.testeur.ui.composants.Pastille
import bj.nakayo.testeur.R
import bj.nakayo.testeur.ui.composants.Bandeau
import bj.nakayo.testeur.ui.composants.BoiteIcone
import bj.nakayo.testeur.ui.composants.Bouton
import bj.nakayo.testeur.ui.composants.Carte
import bj.nakayo.testeur.ui.composants.Chargement
import bj.nakayo.testeur.ui.composants.Ecran
import bj.nakayo.testeur.ui.composants.LigneIcone
import bj.nakayo.testeur.ui.composants.Paragraphe
import bj.nakayo.testeur.ui.composants.StyleBouton
import bj.nakayo.testeur.ui.composants.Surtitre
import bj.nakayo.testeur.ui.composants.Titre
import bj.nakayo.testeur.ui.theme.Couleurs
import bj.nakayo.testeur.ui.theme.NakayoTheme
import bj.nakayo.testeur.ui.prenom

// Espace du testeur connecté : écran T05 (vérification en cours), T05 bis (refus), puis compte validé.
// Compte validé : la liste des apps à tester (T07, US-17).
@Composable
fun EcranEspace(
    etat: EtatEspace,
    surReessayer: () -> Unit,
    surDeconnecter: () -> Unit,
    surProfil: () -> Unit,
    // Numéro WhatsApp du support publié par l'admin, ou null.
    whatsapp: String? = null,
    surWhatsapp: (String) -> Unit = {},
    // Formulaire « Écrire à l'équipe » (US-40).
    surEcrire: () -> Unit = {},
    // Une app à tester touchée dans la liste (US-17).
    surApp: (AffectationTesteur) -> Unit = {},
) {
    when (etat) {
        EtatEspace.Chargement -> Ecran(centrer = true) { Chargement("Chargement de votre compte…") }
        is EtatEspace.Erreur -> Ecran(
            centrer = true,
            pied = {
                Bouton("Réessayer", surReessayer)
                Bouton("Me déconnecter", surDeconnecter, StyleBouton.Fantome)
            },
        ) {
            Titre("Votre compte", alignement = TextAlign.Center)
            Bandeau(etat.message)
            whatsapp?.let { ContactSupport(it, surWhatsapp) }
        }
        is EtatEspace.Pret -> Ecran(
            centrer = etat.profil.statut != "valide" || etat.apps.isNullOrEmpty(),
            pied = {
                Bouton("Mon profil", surProfil, StyleBouton.Secondaire, icone = R.drawable.ic_utilisateur)
                Bouton("Me déconnecter", surDeconnecter, StyleBouton.Fantome, enCours = etat.deconnexionEnCours, icone = R.drawable.ic_sortie)
            },
        ) {
            if (etat.profil.statut == "valide") EspaceValide(etat, surReessayer, surApp) else Statut(etat.profil)
            Bouton("Écrire à l'équipe", surEcrire, StyleBouton.Secondaire, icone = R.drawable.ic_message)
            whatsapp?.let { ContactSupport(it, surWhatsapp) }
        }
    }
}

@Composable
private fun Statut(profil: ProfilTesteur) {
    val prenom = prenom(profil.nom)
    when (profil.statut) {
        "valide" -> {
            Icone(R.drawable.ic_coche, Couleurs.vertDoux, Couleurs.vert)
            Titre("Votre compte est validé, $prenom", alignement = TextAlign.Center)
            Paragraphe("Les campagnes de test auxquelles vous pouvez participer apparaîtront ici. Nous vous préviendrons par SMS.", alignement = TextAlign.Center)
        }
        "refuse" -> {
            Icone(R.drawable.ic_croix, Couleurs.rougeDoux, Couleurs.rouge)
            Titre("Votre compte n'a pas été validé", alignement = TextAlign.Center)
            Carte {
                Surtitre("Motif")
                Text(profil.motifRefus ?: "Aucun motif précisé.", style = MaterialTheme.typography.bodyMedium, color = Couleurs.encre)
            }
            Paragraphe("Si vous pensez qu'il s'agit d'une erreur, contactez l'équipe Nakayo en indiquant votre numéro de téléphone.", alignement = TextAlign.Center)
        }
        "suspendu" -> {
            Icone(R.drawable.ic_alerte, Couleurs.ocreDoux, Couleurs.ocreEncre)
            Titre("Votre compte est suspendu", alignement = TextAlign.Center)
            Paragraphe("Contactez l'équipe Nakayo pour en savoir plus.", alignement = TextAlign.Center)
        }
        else -> {
            Icone(R.drawable.ic_horloge, Couleurs.ocreDoux, Couleurs.ocreEncre)
            Titre("Merci $prenom, on vérifie votre compte", alignement = TextAlign.Center)
            Paragraphe("Vous recevrez un SMS sous 48 h. Pas besoin de garder l'app ouverte.", alignement = TextAlign.Center)
            Carte {
                LigneIcone(R.drawable.ic_coche, "Numéro vérifié", Couleurs.vert)
                LigneIcone(R.drawable.ic_coche, "Photos reçues", Couleurs.vert)
                LigneIcone(R.drawable.ic_horloge, "Vérification par l'équipe", Couleurs.ocreEncre)
            }
        }
    }
}

// Compte validé : les apps à tester (T07), ou l'attente d'une campagne.
@Composable
private fun EspaceValide(etat: EtatEspace.Pret, surReessayer: () -> Unit, surApp: (AffectationTesteur) -> Unit) {
    val apps = etat.apps
    when {
        apps == null && etat.erreurApps != null -> {
            Titre("Vos apps à tester", alignement = TextAlign.Center)
            Bandeau(etat.erreurApps)
            Bouton("Réessayer", surReessayer, StyleBouton.Secondaire)
        }
        apps == null -> Chargement("Chargement de vos apps…")
        apps.isEmpty() -> Statut(etat.profil)
        else -> {
            Surtitre("Bonjour ${prenom(etat.profil.nom)}")
            Titre(if (apps.size == 1) "Votre app à tester" else "Vos ${apps.size} apps à tester")
            Paragraphe("Chaque jour : ouvrez Nakayo, utilisez l'app 2 minutes au moins et envoyez votre rapport.")
            apps.forEach { CarteApp(it) { surApp(it) } }
        }
    }
}

@Composable
private fun CarteApp(a: AffectationTesteur, surClic: () -> Unit) {
    val e = etape(a)
    Row(
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .background(Couleurs.blanc, FORME_CARTE)
            .border(1.dp, if (remiseVisible(a)) Couleurs.argile else Couleurs.trait, FORME_CARTE)
            .clickable(role = Role.Button, onClick = surClic)
            .padding(14.dp),
    ) {
        IconeApp(a.app.paquet, a.app.nom)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(a.app.nom, style = MaterialTheme.typography.titleMedium, color = Couleurs.encre, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Note("Jour ${a.jourCampagne} sur ${a.joursCampagne} · ${a.joursValides} sur ${a.joursExiges} jours validés")
            val (fond, encre) = when (e) {
                Etape.JourFait, Etape.Acquis -> Couleurs.vertDoux to Couleurs.vert
                Etape.Rapport -> Couleurs.ocreDoux to Couleurs.ocreEncre
                else -> Couleurs.argileDoux to Couleurs.argile
            }
            Pastille(libelleEtape(e), fond, encre)
        }
        Icon(painterResource(R.drawable.ic_chevron_droite), contentDescription = null, tint = Couleurs.discret, modifier = Modifier.size(20.dp))
    }
}

// Lien vers WhatsApp, affiché seulement quand l'admin a publié un numéro (§11).
@Composable
private fun ContactSupport(numero: String, surWhatsapp: (String) -> Unit) {
    Bouton("Écrire au support sur WhatsApp", { surWhatsapp(numero) }, StyleBouton.Secondaire, icone = R.drawable.ic_message)
}

@Composable
private fun Icone(@DrawableRes icone: Int, fond: Color, teinte: Color) {
    BoiteIcone(icone, fond, teinte, taille = 64.dp, rayon = 18.dp)
    Spacer(Modifier.height(2.dp))
}


@Preview(widthDp = 360, heightDp = 760)
@Composable
private fun ApercuEspace() {
    val profil = ProfilTesteur(
        id = "1", role = "testeur", statut = "en_attente", telephone = "+2290197000000", nom = "Afi Dossou",
        numeroMomo = "+2290197000000", operateurMomo = "mtn", creeLe = "2026-11-10T14:07:01.512Z",
    )
    NakayoTheme { EcranEspace(EtatEspace.Pret(profil), {}, {}, {}) }
}
