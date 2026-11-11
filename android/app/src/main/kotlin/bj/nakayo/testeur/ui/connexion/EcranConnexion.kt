package bj.nakayo.testeur.ui.connexion

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import bj.nakayo.testeur.ui.composants.Bandeau
import bj.nakayo.testeur.ui.composants.Bouton
import bj.nakayo.testeur.ui.composants.ChampCode
import bj.nakayo.testeur.ui.composants.ChampTexte
import bj.nakayo.testeur.ui.composants.EnTete
import bj.nakayo.testeur.ui.composants.Ecran
import bj.nakayo.testeur.ui.composants.Note
import bj.nakayo.testeur.ui.composants.Paragraphe
import bj.nakayo.testeur.ui.composants.Segment
import bj.nakayo.testeur.ui.composants.Titre
import bj.nakayo.testeur.ui.theme.Couleurs
import bj.nakayo.testeur.ui.theme.NakayoTheme
import bj.nakayo.testeur.ui.minutes

// Écran T02 de la maquette : le numéro (et l'opérateur à la création), puis le code reçu par SMS.
@Composable
fun EcranConnexion(
    etat: EtatConnexion,
    surRetour: () -> Unit,
    surOperateur: (String) -> Unit,
    surTelephone: (String) -> Unit,
    surEnvoyer: () -> Unit,
    surCode: (String) -> Unit,
    surVerifier: () -> Unit,
    surRenvoyer: () -> Unit,
    surModifierNumero: () -> Unit,
) {
    val focusTelephone = remember { FocusRequester() }
    val focusCode = remember { FocusRequester() }
    val creation = etat.mode == ModeConnexion.Creation
    val etapeCode = etat.etape == EtapeConnexion.Code

    Ecran(
        pied = {
            if (etapeCode) Bouton("Continuer", surVerifier, enCours = etat.enCours, actif = etat.code.length == 6)
            else Bouton("Recevoir le code", surEnvoyer, enCours = etat.enCours)
        },
    ) {
        EnTete(if (creation) "Étape 1 sur 4" else null, surRetour)
        if (creation) {
            Titre("Votre numéro Mobile Money")
            Paragraphe("C'est aussi sur ce numéro que vous serez payé.")
        } else {
            Titre("Votre numéro de téléphone")
            Paragraphe("Celui de votre compte Nakayo. Nous vous envoyons un code par SMS.")
        }
        etat.message?.let { Bandeau(it) }
        if (creation) {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Segment(OPERATEURS, etat.operateur, surOperateur, "Opérateur Mobile Money")
                etat.erreurOperateur?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = Couleurs.rouge) }
            }
        }
        ChampTexte(
            valeur = etat.telephone,
            surChangement = surTelephone,
            libelle = "Numéro de téléphone",
            exemple = "01 97 45 12 08",
            prefixe = "+229",
            erreur = etat.erreurTelephone,
            clavier = KeyboardType.Phone,
            actionClavier = ImeAction.Send,
            surAction = surEnvoyer,
            actif = !etapeCode && !etat.enCours,
            modifier = Modifier.focusRequester(focusTelephone),
        )
        if (etapeCode) {
            ChampCode(
                valeur = etat.code,
                surChangement = surCode,
                libelle = "Code reçu par SMS",
                erreur = etat.erreurCode,
                surComplet = surVerifier,
                modifier = Modifier.focusRequester(focusCode),
            )
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.heightIn(min = 48.dp)) {
                if (etat.renvoiDans > 0) {
                    Note("Renvoyer le code dans ${minutes(etat.renvoiDans)}", modifier = Modifier.weight(1f))
                } else {
                    TextButton(onClick = surRenvoyer, enabled = !etat.enCours, modifier = Modifier.weight(1f)) {
                        Text("Renvoyer le code", style = MaterialTheme.typography.labelMedium, color = Couleurs.foret)
                    }
                }
                TextButton(onClick = surModifierNumero, enabled = !etat.enCours) {
                    Text("Modifier le numéro", style = MaterialTheme.typography.labelMedium, color = Couleurs.foret)
                }
            }
        }
    }
    LaunchedEffect(etat.etape) {
        if (etapeCode) focusCode.requestFocus() else focusTelephone.requestFocus()
    }
}


@Preview(widthDp = 360, heightDp = 760)
@Composable
private fun ApercuCode() {
    NakayoTheme {
        EcranConnexion(
            EtatConnexion(
                mode = ModeConnexion.Creation,
                etape = EtapeConnexion.Code,
                operateur = "mtn",
                telephone = "01 97 45 12 08",
                telephoneNormalise = "+2290197451208",
                code = "481",
                renvoiDans = 42,
            ),
            {}, {}, {}, {}, {}, {}, {}, {},
        )
    }
}
