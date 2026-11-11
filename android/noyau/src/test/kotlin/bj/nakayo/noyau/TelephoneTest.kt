package bj.nakayo.noyau

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class TelephoneTest {
    @Test
    fun `normalise les écritures courantes d'un numéro béninois`() {
        for (saisie in listOf("01 97 00 00 00", "0197000000", "229 0197000000", "00229 01 97 00 00 00", "+229 01-97-00-00-00", " (01) 97.00.00.00 ")) {
            assertEquals("+2290197000000", Telephone.normaliser(saisie), saisie)
        }
    }

    @Test
    fun `valide seulement le format E164 du Bénin`() {
        assertNull(Telephone.valider("+2290197000000"))
        assertEquals("requis", Telephone.valider(""))
        for (faux in listOf("+229 97000000", "+22997000000", "+2250197000000", "+22901970000001", "0197000000")) {
            assertEquals("format_invalide", Telephone.valider(faux), faux)
        }
    }

    @Test
    fun `code SMS de 6 chiffres`() {
        assertNull(CodeSms.valider("048291"))
        assertEquals("requis", CodeSms.valider(""))
        for (faux in listOf("12345", "1234567", "12a456", "12 456")) assertEquals("format_invalide", CodeSms.valider(faux), faux)
    }
}
