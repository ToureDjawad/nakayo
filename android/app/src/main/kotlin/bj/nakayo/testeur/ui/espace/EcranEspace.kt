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
import bj.nakayo.noyau.ProfilTesteur
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
// Les campagnes de test (T07) arriveront ici avec les sprints suivants.
@Composable
fun EcranEspace(
    etat: EtatEspace,
    surReessayer: () -> Unit,
    surDeconnecter: () -> Unit,
    surProfil: () -> Unit,
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
        }
        is EtatEspace.Pret -> Ecran(
            centrer = true,
            pied = {
                Bouton("Mon profil", surProfil, StyleBouton.Secondaire, icone = R.drawable.ic_utilisateur)
                Bouton("Me déconnecter", surDeconnecter, StyleBouton.Fantome, enCours = etat.deconnexionEnCours, icone = R.drawable.ic_sortie)
            },
        ) {
            Statut(etat.profil)
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
