package bj.nakayo.testeur.ui.accueil

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import bj.nakayo.testeur.R
import bj.nakayo.testeur.ui.composants.Bandeau
import bj.nakayo.testeur.ui.composants.Bouton
import bj.nakayo.testeur.ui.composants.Chargement
import bj.nakayo.testeur.ui.composants.Ecran
import bj.nakayo.testeur.ui.composants.LigneIcone
import bj.nakayo.testeur.ui.composants.Logo
import bj.nakayo.testeur.ui.composants.StyleBouton
import bj.nakayo.testeur.ui.composants.TypeBandeau
import bj.nakayo.testeur.ui.theme.Couleurs
import bj.nakayo.testeur.ui.theme.InstrumentSerif
import bj.nakayo.testeur.ui.theme.NakayoTheme

// Écran T01 de la maquette : promesse, puis création de compte ou connexion.
@Composable
fun EcranAccueil(
    etat: EtatAccueil,
    surReessayer: () -> Unit,
    surCreerCompte: () -> Unit,
    surConnexion: () -> Unit,
    information: String? = null,
) {
    Ecran(
        fond = Couleurs.profond,
        pied = {
            LigneIcone(R.drawable.ic_bouclier, "Compte vérifié avec une pièce d'identité", Couleurs.surProfond, Couleurs.surProfond, MaterialTheme.typography.bodySmall)
            LigneIcone(R.drawable.ic_reseau, "Fonctionne aussi avec peu de réseau", Couleurs.surProfond, Couleurs.surProfond, MaterialTheme.typography.bodySmall)
            Spacer(Modifier.height(2.dp))
            when (etat) {
                EtatAccueil.Chargement -> Chargement("Connexion au service…", Couleurs.surProfond)
                EtatAccueil.Disponible -> {
                    Bouton("Créer mon compte", surCreerCompte, StyleBouton.Accent)
                    Bouton("J'ai déjà un compte", surConnexion, StyleBouton.SurProfond)
                }
                is EtatAccueil.Indisponible -> {
                    Bandeau(etat.message)
                    Bouton("Réessayer", surReessayer, StyleBouton.SurProfond)
                }
            }
        },
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Spacer(Modifier.height(24.dp))
            Logo(Couleurs.blanc)
            Text(
                buildAnnotatedString {
                    append("Testez des apps,\n")
                    withStyle(SpanStyle(fontFamily = InstrumentSerif, fontStyle = FontStyle.Italic, fontWeight = FontWeight.Normal, color = Couleurs.ocre)) {
                        append("soyez payé en MoMo.")
                    }
                },
                style = MaterialTheme.typography.displaySmall,
                color = Couleurs.blanc,
                modifier = Modifier.semantics { heading() },
            )
            Text(
                "Quelques minutes par jour avec votre téléphone. 500 FCFA par app, versés à la fin de chaque campagne de 14 jours.",
                style = MaterialTheme.typography.bodyLarge,
                color = Couleurs.surProfond,
            )
            information?.let { Bandeau(it, TypeBandeau.Information) }
        }
    }
}

@Preview(widthDp = 360, heightDp = 760)
@Composable
private fun ApercuAccueil() {
    NakayoTheme { EcranAccueil(EtatAccueil.Disponible, surReessayer = {}, surCreerCompte = {}, surConnexion = {}) }
}
