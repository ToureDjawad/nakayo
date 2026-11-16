package bj.nakayo.testeur

import bj.nakayo.noyau.ConditionNiveau
import bj.nakayo.noyau.NiveauTesteur
import bj.nakayo.testeur.ui.profil.avantageNiveau
import bj.nakayo.testeur.ui.profil.bilanNiveau
import bj.nakayo.testeur.ui.profil.texteCondition
import org.junit.Assert.assertEquals
import org.junit.Test

// US-38 côté Android : niveau et chemin vers le suivant sur « Mon profil ».
class NiveauTest {
    @Test
    fun `le bilan accorde les mots au nombre`() {
        assertEquals("0 campagne menée au bout · 0 bug accepté · assiduité 50 %", bilanNiveau(NiveauTesteur("bronze", "Bronze", 0, 0, 50)))
        assertEquals("3 campagnes menées au bout · 2 bugs acceptés · assiduité 80 %", bilanNiveau(NiveauTesteur("or", "Or", 3, 2, 80)))
    }

    @Test
    fun `chaque condition dit ce qu'il reste à faire`() {
        assertEquals("Encore 2 campagnes à mener au bout (14 jours)", texteCondition(ConditionNiveau("campagnes", 3, 1, false)))
        assertEquals("Encore 1 bug accepté par un développeur", texteCondition(ConditionNiveau("bugs", 2, 1, false)))
        assertEquals("1 campagne menée au bout : fait", texteCondition(ConditionNiveau("campagnes", 1, 1, true)))
        assertEquals(
            "Assiduité d'au moins 75 % (vous êtes à 66 %) : évitez d'être remplacé",
            texteCondition(ConditionNiveau("assiduite", 75, 66, false)),
        )
    }

    @Test
    fun `l'avantage dépend du niveau`() {
        assertEquals("Vous passez en premier dans les campagnes Pro et Plus, les mieux payées.", avantageNiveau("or"))
    }
}
