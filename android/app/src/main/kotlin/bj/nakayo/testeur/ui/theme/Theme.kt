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
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import bj.nakayo.testeur.R

// Couleurs de la maquette (Figma « Nakayo · Maquette complète » et prototype).
object Couleurs {
    val sable = Color(0xFFF6F0E6)
    val papier = Color(0xFFFFFDF8)
    val blanc = Color(0xFFFFFFFF)
    val encre = Color(0xFF1C1B18)
    val encre2 = Color(0xFF4A453D)
    val discret = Color(0xFF7A7366)
    val trait = Color(0xFFE8DFD0)
    val doux = Color(0xFFF0E9DD)
    val foret = Color(0xFF15543F)
    val profond = Color(0xFF0E3B2C)
    val menthe = Color(0xFFDDEDE3)
    val argile = Color(0xFFC65A3A)
    val argileDoux = Color(0xFFF7E0D6)
    val ocre = Color(0xFFE3A33A)
    val ocreDoux = Color(0xFFFBEDCF)
    val ocreEncre = Color(0xFF8A5A12)
    val indigo = Color(0xFF2D4A7A)
    val indigoDoux = Color(0xFFE1E8F3)
    val rouge = Color(0xFFB42318)
    val rougeDoux = Color(0xFFFBE4E1)
    val vert = Color(0xFF1E7A4C)
    val vertDoux = Color(0xFFDFF1E6)

    // Texte secondaire sur le fond vert profond de l'accueil.
    val surProfond = Color(0xFFC9DBD2)
    val traitProfond = Color(0xFF2E5A4B)
}

// Réglage de graisse des polices variables (API stable depuis Android 8, marquée expérimentale dans Compose).
@OptIn(ExperimentalTextApi::class)
private fun variable(id: Int, poids: Int) =
    Font(id, FontWeight(poids), variationSettings = FontVariation.Settings(FontVariation.weight(poids)))

// Polices de la maquette, licence OFL (assets/licences) :
// Bricolage Grotesque pour les titres, DM Sans pour le texte, Instrument Serif italique pour l'accent.
val Bricolage = FontFamily(variable(R.font.bricolage_grotesque, 500), variable(R.font.bricolage_grotesque, 600), variable(R.font.bricolage_grotesque, 700))
val DmSans = FontFamily(variable(R.font.dm_sans, 400), variable(R.font.dm_sans, 500), variable(R.font.dm_sans, 600), variable(R.font.dm_sans, 700))
val InstrumentSerif = FontFamily(Font(R.font.instrument_serif_italique, FontWeight.Normal, FontStyle.Italic))

private val titre = TextStyle(fontFamily = Bricolage, fontWeight = FontWeight(600), letterSpacing = (-0.02).em)

// Tailles de l'écran de référence de la maquette (360 × 760).
private val typographie = Typography(
    displaySmall = titre.copy(fontSize = 30.sp, lineHeight = 34.sp),
    headlineSmall = titre.copy(fontSize = 22.sp, lineHeight = 26.sp),
    titleMedium = titre.copy(fontSize = 17.sp, lineHeight = 22.sp),
    bodyLarge = TextStyle(fontFamily = DmSans, fontWeight = FontWeight(400), fontSize = 15.sp, lineHeight = 22.sp),
    bodyMedium = TextStyle(fontFamily = DmSans, fontWeight = FontWeight(400), fontSize = 14.sp, lineHeight = 21.sp),
    bodySmall = TextStyle(fontFamily = DmSans, fontWeight = FontWeight(400), fontSize = 12.5.sp, lineHeight = 18.sp),
    labelLarge = TextStyle(fontFamily = DmSans, fontWeight = FontWeight(600), fontSize = 15.sp, lineHeight = 18.sp),
    labelMedium = TextStyle(fontFamily = DmSans, fontWeight = FontWeight(500), fontSize = 12.5.sp, lineHeight = 16.sp),
    labelSmall = TextStyle(fontFamily = DmSans, fontWeight = FontWeight(600), fontSize = 11.sp, lineHeight = 14.sp, letterSpacing = 0.07.em),
)

private val schema = lightColorScheme(
    primary = Couleurs.foret,
    onPrimary = Color.White,
    primaryContainer = Couleurs.menthe,
    onPrimaryContainer = Couleurs.foret,
    secondary = Couleurs.argile,
    onSecondary = Color.White,
    tertiary = Couleurs.ocre,
    background = Couleurs.papier,
    onBackground = Couleurs.encre,
    surface = Couleurs.blanc,
    onSurface = Couleurs.encre,
    surfaceVariant = Couleurs.doux,
    onSurfaceVariant = Couleurs.encre2,
    outline = Couleurs.trait,
    outlineVariant = Couleurs.doux,
    error = Couleurs.rouge,
    onError = Color.White,
    errorContainer = Couleurs.rougeDoux,
    onErrorContainer = Couleurs.rouge,
)

@Composable
fun NakayoTheme(contenu: @Composable () -> Unit) {
    MaterialTheme(colorScheme = schema, typography = typographie, content = contenu)
}
