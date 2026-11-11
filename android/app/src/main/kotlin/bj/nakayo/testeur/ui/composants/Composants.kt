package bj.nakayo.testeur.ui.composants

import androidx.annotation.DrawableRes
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.error
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import bj.nakayo.testeur.R
import bj.nakayo.testeur.ui.theme.Bricolage
import bj.nakayo.testeur.ui.theme.Couleurs

// Rayons de la maquette : 10 pour les boutons et les champs, 12 pour les bandeaux, 14 pour les cartes.
val FORME = RoundedCornerShape(10.dp)
val FORME_BANDEAU = RoundedCornerShape(12.dp)
val FORME_CARTE = RoundedCornerShape(14.dp)

// Écran type de la maquette : contenu défilant, boutons d'action fixés en bas, centré sur les grands écrans.
@Composable
fun Ecran(
    modifier: Modifier = Modifier,
    fond: Color = Couleurs.papier,
    centrer: Boolean = false,
    pied: (@Composable ColumnScope.() -> Unit)? = null,
    contenu: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(fond)
            .safeDrawingPadding()
            .imePadding(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Column(
            modifier = Modifier
                .weight(1f)
                .widthIn(max = 560.dp)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 14.dp),
            verticalArrangement = if (centrer) Arrangement.spacedBy(12.dp, Alignment.CenterVertically) else Arrangement.spacedBy(12.dp),
            horizontalAlignment = if (centrer) Alignment.CenterHorizontally else Alignment.Start,
            content = contenu,
        )
        if (pied != null) {
            Column(
                modifier = Modifier
                    .widthIn(max = 560.dp)
                    .fillMaxWidth()
                    .padding(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                content = pied,
            )
        }
    }
}

// « < Étape 1 sur 4 » en haut des écrans du parcours.
@Composable
fun EnTete(texte: String?, surRetour: (() -> Unit)?) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.heightIn(min = 48.dp)) {
        if (surRetour != null) {
            IconButton(onClick = surRetour, modifier = Modifier.size(40.dp)) {
                Icon(painterResource(R.drawable.ic_chevron_gauche), contentDescription = "Retour", tint = Couleurs.encre)
            }
        }
        texte?.let { Note(it) }
    }
}

@Composable
fun Logo(couleur: Color = Couleurs.encre) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.semantics(mergeDescendants = true) { contentDescription = "Nakayo" },
    ) {
        Image(painterResource(R.drawable.logo_nakayo), contentDescription = null, modifier = Modifier.size(28.dp))
        Text("nakayo", color = couleur, style = TextStyle(fontFamily = Bricolage, fontWeight = FontWeight(700), fontSize = 22.sp, letterSpacing = (-0.66).sp))
    }
}

@Composable
fun Titre(texte: String, modifier: Modifier = Modifier, alignement: TextAlign = TextAlign.Start) {
    Text(
        texte,
        style = MaterialTheme.typography.headlineSmall,
        color = Couleurs.encre,
        textAlign = alignement,
        modifier = modifier.semantics { heading() },
    )
}

@Composable
fun Paragraphe(texte: String, couleur: Color = Couleurs.encre2, alignement: TextAlign = TextAlign.Start) {
    Text(texte, style = MaterialTheme.typography.bodyMedium, color = couleur, textAlign = alignement)
}

// Petit texte discret (classe « t-s » de la maquette).
@Composable
fun Note(texte: String, couleur: Color = Couleurs.discret, modifier: Modifier = Modifier) {
    Text(texte, style = MaterialTheme.typography.bodySmall, color = couleur, modifier = modifier)
}

// Libellé en capitales (classe « lbl »).
@Composable
fun Surtitre(texte: String) {
    Text(texte.uppercase(), style = MaterialTheme.typography.labelSmall, color = Couleurs.discret)
}

enum class TypeBandeau(val fond: Color, val encre: Color) {
    Erreur(Couleurs.rougeDoux, Color(0xFF7A1A12)),
    Information(Couleurs.indigoDoux, Color(0xFF1F3457)),
    Succes(Couleurs.vertDoux, Color(0xFF14522F)),
    Attention(Couleurs.ocreDoux, Color(0xFF5C3D0C)),
}

@Composable
fun Bandeau(texte: String, type: TypeBandeau = TypeBandeau.Erreur, titre: String? = null, @DrawableRes icone: Int? = null) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        modifier = Modifier
            .fillMaxWidth()
            .background(type.fond, FORME_BANDEAU)
            .padding(horizontal = 12.dp, vertical = 10.dp)
            .semantics(mergeDescendants = true) {
                liveRegion = if (type == TypeBandeau.Erreur) LiveRegionMode.Assertive else LiveRegionMode.Polite
            },
    ) {
        val icon = icone ?: if (type == TypeBandeau.Erreur) R.drawable.ic_alerte else null
        icon?.let { Icon(painterResource(it), contentDescription = null, tint = type.encre, modifier = Modifier.size(16.dp).padding(top = 1.dp)) }
        Text(
            buildAnnotatedString {
                titre?.let { withStyle(SpanStyle(fontWeight = FontWeight(600))) { append(it) }; append("\n") }
                append(texte)
            },
            style = MaterialTheme.typography.bodySmall,
            color = type.encre,
        )
    }
}

// Champ de saisie : libellé au-dessus, cadre blanc, bord vert à la saisie, rouge en erreur, aide dessous.
// Le libellé est porté par le champ pour les lecteurs d'écran (et les tests).
@Composable
fun ChampTexte(
    valeur: String,
    surChangement: (String) -> Unit,
    libelle: String,
    erreur: String?,
    modifier: Modifier = Modifier,
    aide: String? = null,
    exemple: String? = null,
    prefixe: String? = null,
    clavier: KeyboardType = KeyboardType.Text,
    actionClavier: ImeAction = ImeAction.Next,
    surAction: () -> Unit = {},
    actif: Boolean = true,
    lignes: Int = 1,
) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
        Text(libelle, style = MaterialTheme.typography.labelMedium, color = Couleurs.encre2, modifier = Modifier.clearAndSetSemantics { })
        OutlinedTextField(
            value = valeur,
            onValueChange = surChangement,
            isError = erreur != null,
            singleLine = lignes == 1,
            minLines = lignes,
            enabled = actif,
            shape = FORME,
            textStyle = MaterialTheme.typography.bodyMedium,
            placeholder = exemple?.let { texte -> @Composable { Text(texte, style = MaterialTheme.typography.bodyMedium, color = Couleurs.discret) } },
            prefix = prefixe?.let { texte ->
                @Composable { Text("$texte ", style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight(600)), color = Couleurs.encre) }
            },
            keyboardOptions = KeyboardOptions(keyboardType = clavier, imeAction = actionClavier),
            keyboardActions = KeyboardActions(onAny = { surAction() }),
            colors = couleursChamp(),
            modifier = modifier
                .fillMaxWidth()
                .heightIn(min = 44.dp)
                .semantics {
                    contentDescription = libelle
                    if (erreur != null) error(erreur)
                },
        )
        (erreur ?: aide)?.let {
            Text(it, style = MaterialTheme.typography.bodySmall, color = if (erreur != null) Couleurs.rouge else Couleurs.discret)
        }
    }
}

@Composable
fun couleursChamp() = OutlinedTextFieldDefaults.colors(
    focusedContainerColor = Couleurs.blanc,
    unfocusedContainerColor = Couleurs.blanc,
    disabledContainerColor = Couleurs.doux,
    errorContainerColor = Couleurs.blanc,
    focusedBorderColor = Couleurs.foret,
    unfocusedBorderColor = Couleurs.trait,
    disabledBorderColor = Couleurs.trait,
    errorBorderColor = Couleurs.rouge,
    focusedTextColor = Couleurs.encre,
    unfocusedTextColor = Couleurs.encre,
    disabledTextColor = Couleurs.encre2,
    cursorColor = Couleurs.foret,
)

// Code SMS en 6 cases (classe « otp »). Un seul champ invisible reçoit la saisie.
@Composable
fun ChampCode(valeur: String, surChangement: (String) -> Unit, libelle: String, erreur: String?, surComplet: () -> Unit, modifier: Modifier = Modifier) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
        Surtitre(libelle)
        BasicTextField(
            value = valeur,
            onValueChange = { surChangement(it.filter(Char::isDigit).take(6)) },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword, imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onAny = { surComplet() }),
            modifier = modifier
                .fillMaxWidth()
                .semantics {
                    contentDescription = libelle
                    if (erreur != null) error(erreur)
                },
            decorationBox = { _ ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    repeat(6) { i ->
                        val chiffre = valeur.getOrNull(i)
                        val actuelle = i == valeur.length
                        Box(
                            contentAlignment = Alignment.Center,
                            modifier = Modifier
                                .weight(1f)
                                .height(48.dp)
                                .background(Couleurs.blanc, FORME)
                                .border(
                                    when {
                                        erreur != null -> BorderStroke(1.dp, Couleurs.rouge)
                                        chiffre != null || actuelle -> BorderStroke(1.5.dp, Couleurs.foret)
                                        else -> BorderStroke(1.dp, Couleurs.trait)
                                    },
                                    FORME,
                                ),
                        ) {
                            Text(
                                chiffre?.toString() ?: "",
                                style = TextStyle(fontFamily = Bricolage, fontWeight = FontWeight(600), fontSize = 20.sp),
                                color = Couleurs.encre,
                            )
                        }
                    }
                }
            },
        )
        erreur?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = Couleurs.rouge) }
    }
}

// Choix exclusif en deux cases (classe « seg »), par exemple l'opérateur Mobile Money.
@Composable
fun Segment(options: List<Pair<String, String>>, choisi: String?, surChoix: (String) -> Unit, libelle: String) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        modifier = Modifier
            .fillMaxWidth()
            .selectableGroup()
            .semantics { contentDescription = libelle },
    ) {
        options.forEach { (code, texte) ->
            val actif = code == choisi
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .weight(1f)
                    .heightIn(min = 44.dp)
                    .background(if (actif) Couleurs.menthe else Couleurs.blanc, FORME)
                    .border(if (actif) BorderStroke(1.5.dp, Couleurs.foret) else BorderStroke(1.dp, Couleurs.trait), FORME)
                    .selectable(selected = actif, role = Role.RadioButton, onClick = { surChoix(code) })
                    .padding(10.dp),
            ) {
                Text(texte, style = MaterialTheme.typography.labelLarge.copy(fontSize = 14.sp), color = if (actif) Couleurs.foret else Couleurs.encre)
            }
        }
    }
}

// Puce à cocher (langues parlées) : verte quand choisie, neutre sinon.
@Composable
fun Puce(texte: String, choisie: Boolean, surClic: () -> Unit) {
    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .heightIn(min = 36.dp)
            .background(if (choisie) Couleurs.menthe else Couleurs.doux, RoundedCornerShape(6.dp))
            .toggleable(value = choisie, role = Role.Checkbox, onValueChange = { surClic() })
            .padding(horizontal = 12.dp, vertical = 8.dp),
    ) {
        Text(texte, style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight(600)), color = if (choisie) Couleurs.foret else Couleurs.encre2)
    }
}

// Pastille de statut (classe « bd »).
@Composable
fun Pastille(texte: String, fond: Color, encre: Color) {
    Text(
        texte,
        style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight(600), fontSize = 12.sp),
        color = encre,
        modifier = Modifier
            .background(fond, RoundedCornerShape(6.dp))
            .padding(horizontal = 8.dp, vertical = 3.dp),
    )
}

// Vraie case à cocher, jamais précochée par l'app.
@Composable
fun CaseACocher(coche: Boolean, surChangement: (Boolean) -> Unit, texte: String, erreur: Boolean = false) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 44.dp)
            .toggleable(value = coche, role = Role.Checkbox, onValueChange = surChangement)
            .padding(vertical = 4.dp),
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(20.dp)
                .background(if (coche) Couleurs.foret else Couleurs.blanc, RoundedCornerShape(5.dp))
                .border(1.5.dp, if (coche) Couleurs.foret else if (erreur) Couleurs.rouge else Couleurs.trait, RoundedCornerShape(5.dp)),
        ) {
            if (coche) Icon(painterResource(R.drawable.ic_coche), contentDescription = null, tint = Color.White, modifier = Modifier.size(14.dp))
        }
        Text(texte, style = MaterialTheme.typography.bodySmall, color = Couleurs.encre)
    }
}

// Carte d'ajout de photo (classe « upl ») : pointillés à faire, verte une fois la photo prise.
@Composable
fun CarteTeleversement(titre: String, detail: String, fait: Boolean, @DrawableRes icone: Int, surClic: () -> Unit, erreur: String? = null) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .background(if (fait) Couleurs.vertDoux else Couleurs.blanc, FORME_BANDEAU)
                .border(
                    1.5.dp,
                    when {
                        fait -> Color(0xFFBFD9C8)
                        erreur != null -> Couleurs.rouge
                        else -> Couleurs.trait
                    },
                    FORME_BANDEAU,
                )
                .selectable(selected = fait, role = Role.Button, onClick = surClic)
                .padding(14.dp),
        ) {
            BoiteIcone(icone, if (fait) Couleurs.blanc else Couleurs.doux, if (fait) Couleurs.vert else Couleurs.encre)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(titre, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight(600)), color = Couleurs.encre)
                Note(detail)
            }
            Icon(
                painterResource(if (fait) R.drawable.ic_coche else R.drawable.ic_chevron_droite),
                contentDescription = null,
                tint = if (fait) Couleurs.vert else Couleurs.discret,
                modifier = Modifier.size(20.dp),
            )
        }
        erreur?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = Couleurs.rouge) }
    }
}

@Composable
fun BoiteIcone(@DrawableRes icone: Int, fond: Color, teinte: Color, taille: Dp = 38.dp, rayon: Dp = 10.dp) {
    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .size(taille)
            .background(fond, RoundedCornerShape(rayon)),
    ) {
        Icon(painterResource(icone), contentDescription = null, tint = teinte, modifier = Modifier.size(if (taille >= 56.dp) 30.dp else 20.dp))
    }
}

@Composable
fun Carte(modifier: Modifier = Modifier, espacement: Dp = 10.dp, marge: PaddingValues = PaddingValues(14.dp), contenu: @Composable ColumnScope.() -> Unit) {
    Column(
        verticalArrangement = Arrangement.spacedBy(espacement),
        modifier = modifier
            .fillMaxWidth()
            .background(Couleurs.blanc, FORME_CARTE)
            .border(1.dp, Couleurs.trait, FORME_CARTE)
            .padding(marge),
        content = contenu,
    )
}

// Ligne icône + texte (cases cochées de l'écran d'attente, arguments de l'accueil).
@Composable
fun LigneIcone(@DrawableRes icone: Int, texte: String, teinte: Color, couleurTexte: Color = Couleurs.encre, style: TextStyle = MaterialTheme.typography.bodyMedium) {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(painterResource(icone), contentDescription = null, tint = teinte, modifier = Modifier.size(18.dp))
        Text(texte, style = style, color = couleurTexte)
    }
}

enum class StyleBouton { Principal, Accent, Secondaire, Fantome, SurProfond }

// Gros bouton de la maquette (« btn lg full ») : 48 dp de haut au moins, rayon 10.
@Composable
fun Bouton(
    texte: String,
    surClic: () -> Unit,
    style: StyleBouton = StyleBouton.Principal,
    enCours: Boolean = false,
    actif: Boolean = true,
    @DrawableRes icone: Int? = null,
    modifier: Modifier = Modifier,
) {
    val (fond, encre, bord) = when (style) {
        StyleBouton.Principal -> Triple(Couleurs.foret, Color.White, null)
        StyleBouton.Accent -> Triple(Couleurs.argile, Color.White, null)
        StyleBouton.Secondaire -> Triple(Couleurs.blanc, Couleurs.encre, Couleurs.trait)
        StyleBouton.Fantome -> Triple(Color.Transparent, Couleurs.encre2, null)
        StyleBouton.SurProfond -> Triple(Color.Transparent, Color.White, Couleurs.traitProfond)
    }
    Button(
        onClick = surClic,
        enabled = actif && !enCours,
        shape = FORME,
        border = bord?.let { BorderStroke(1.dp, it) },
        contentPadding = PaddingValues(horizontal = 18.dp, vertical = 13.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = fond,
            contentColor = encre,
            disabledContainerColor = fond.copy(alpha = if (fond == Color.Transparent) 0f else fond.alpha * 0.45f),
            disabledContentColor = encre.copy(alpha = 0.6f),
        ),
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 48.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (enCours) {
                CircularProgressIndicator(color = encre, strokeWidth = 2.dp, modifier = Modifier.size(18.dp))
            } else {
                icone?.let { Icon(painterResource(it), contentDescription = null, modifier = Modifier.size(18.dp)) }
            }
            Text(texte, style = MaterialTheme.typography.labelLarge)
        }
    }
}

@Composable
fun Chargement(texte: String, couleur: Color = Couleurs.discret) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp), horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
        CircularProgressIndicator(color = Couleurs.foret, strokeWidth = 3.dp)
        Text(texte, style = MaterialTheme.typography.bodyMedium, color = couleur)
    }
}

// Ligne « libellé … valeur » des cartes de profil, séparée par un trait.
@Composable
fun LigneInfo(libelle: String, valeur: String, separateur: Boolean = true, action: (@Composable RowScope.() -> Unit)? = null) {
    Column {
        Row(
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 10.dp)
                .semantics(mergeDescendants = true) { },
        ) {
            Text(libelle, style = MaterialTheme.typography.bodyMedium, color = Couleurs.encre, modifier = Modifier.weight(1f))
            Note(valeur, modifier = Modifier.weight(1.2f, fill = false))
            action?.invoke(this)
        }
        if (separateur) Box(Modifier.fillMaxWidth().height(1.dp).background(Couleurs.doux))
    }
}
