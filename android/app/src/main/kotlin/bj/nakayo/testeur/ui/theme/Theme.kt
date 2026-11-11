package bj.nakayo.testeur.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.ExperimentalTextApi
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import bj.nakayo.testeur.R

// Mêmes couleurs que le site (client/src/index.css), fond blanc.
object Couleurs {
    val encre = Color(0xFF1C1917)
    val texte = Color(0xFF44403C)
    val discret = Color(0xFF6B645E)
    val trait = Color(0xFFD6D3D1)
    val fondDoux = Color(0xFFF5F5F4)
    val accent = Color(0xFF0F5C4A)
    val accentFonce = Color(0xFF0A4637)
    val accentClair = Color(0xFFE6F0ED)
    val erreur = Color(0xFFB42318)
    val erreurClair = Color(0xFFFEF3F2)
    val succes = Color(0xFF067647)
    val succesClair = Color(0xFFECFDF3)
}

// Réglage de graisse des polices variables (API stable depuis Android 8, marquée expérimentale dans Compose).
@OptIn(ExperimentalTextApi::class)
private fun variable(id: Int, poids: Int) =
    Font(id, FontWeight(poids), variationSettings = FontVariation.Settings(FontVariation.weight(poids)))

// Polices variables Archivo (titres) et IBM Plex Sans (texte), licence OFL (assets/licences).
val Archivo = FontFamily(variable(R.font.archivo, 500), variable(R.font.archivo, 600), variable(R.font.archivo, 700))
val IbmPlexSans = FontFamily(variable(R.font.ibm_plex_sans, 400), variable(R.font.ibm_plex_sans, 500), variable(R.font.ibm_plex_sans, 600))

private val typographie = Typography(
    headlineMedium = TextStyle(fontFamily = Archivo, fontWeight = FontWeight(700), fontSize = 28.sp, lineHeight = 34.sp, letterSpacing = (-0.2).sp),
    titleLarge = TextStyle(fontFamily = Archivo, fontWeight = FontWeight(600), fontSize = 22.sp, lineHeight = 28.sp),
    titleMedium = TextStyle(fontFamily = Archivo, fontWeight = FontWeight(600), fontSize = 18.sp, lineHeight = 24.sp),
    bodyLarge = TextStyle(fontFamily = IbmPlexSans, fontWeight = FontWeight(400), fontSize = 17.sp, lineHeight = 26.sp),
    bodyMedium = TextStyle(fontFamily = IbmPlexSans, fontWeight = FontWeight(400), fontSize = 15.sp, lineHeight = 22.sp),
    labelLarge = TextStyle(fontFamily = IbmPlexSans, fontWeight = FontWeight(600), fontSize = 16.sp, lineHeight = 20.sp),
)

private val schema = lightColorScheme(
    primary = Couleurs.accent,
    onPrimary = Color.White,
    primaryContainer = Couleurs.accentClair,
    onPrimaryContainer = Couleurs.accentFonce,
    background = Color.White,
    onBackground = Couleurs.encre,
    surface = Color.White,
    onSurface = Couleurs.encre,
    onSurfaceVariant = Couleurs.texte,
    outline = Couleurs.trait,
    error = Couleurs.erreur,
    onError = Color.White,
    errorContainer = Couleurs.erreurClair,
)

@Composable
fun NakayoTheme(contenu: @Composable () -> Unit) {
    MaterialTheme(colorScheme = schema, typography = typographie, content = contenu)
}
