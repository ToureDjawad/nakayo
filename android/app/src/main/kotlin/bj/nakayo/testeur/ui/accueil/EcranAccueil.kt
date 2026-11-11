package bj.nakayo.testeur.ui.accueil

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import bj.nakayo.testeur.ui.theme.Couleurs
import bj.nakayo.testeur.ui.theme.NakayoTheme

// Premier écran de l'app. Les écrans d'inscription et de connexion (US-06, US-09) partiront d'ici.
@Composable
fun EcranAccueil(etat: EtatAccueil, surReessayer: () -> Unit, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(Color.White)
            .safeDrawingPadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp, vertical = 32.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text("Nakayo", style = MaterialTheme.typography.headlineMedium, modifier = Modifier.semantics { heading() })
        Text(
            "Testez des applications Android pendant 14 jours et recevez votre paiement par Mobile Money.",
            style = MaterialTheme.typography.bodyLarge,
            color = Couleurs.texte,
        )
        Spacer(Modifier.height(8.dp))
        Statut(etat, surReessayer)
    }
}

@Composable
private fun Statut(etat: EtatAccueil, surReessayer: () -> Unit) {
    val forme = RoundedCornerShape(8.dp)
    when (etat) {
        EtatAccueil.Chargement -> Column(horizontalAlignment = Alignment.Start, verticalArrangement = Arrangement.spacedBy(12.dp)) {
            CircularProgressIndicator(color = Couleurs.accent, strokeWidth = 3.dp)
            Text("Connexion au service…", style = MaterialTheme.typography.bodyMedium, color = Couleurs.discret)
        }
        EtatAccueil.Disponible -> Text(
            "Le service est disponible.",
            style = MaterialTheme.typography.bodyMedium,
            color = Couleurs.succes,
            modifier = Modifier
                .fillMaxWidth()
                .background(Couleurs.succesClair, forme)
                .padding(16.dp)
                .semantics { liveRegion = LiveRegionMode.Polite },
        )
        is EtatAccueil.Indisponible -> Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(
                etat.message,
                style = MaterialTheme.typography.bodyMedium,
                color = Couleurs.erreur,
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Couleurs.erreurClair, forme)
                    .padding(16.dp)
                    .semantics { liveRegion = LiveRegionMode.Assertive },
            )
            Button(onClick = surReessayer, shape = forme, modifier = Modifier.heightIn(min = 48.dp)) {
                Text("Réessayer", style = MaterialTheme.typography.labelLarge)
            }
        }
    }
}

@Preview(showBackground = true, widthDp = 360)
@Composable
private fun ApercuAccueil() {
    NakayoTheme { EcranAccueil(EtatAccueil.Indisponible("Pas de connexion au serveur."), surReessayer = {}) }
}
