package bj.nakayo.testeur

import bj.nakayo.noyau.Appareil
import bj.nakayo.testeur.session.IdentiteAppareil
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

// US-35 : mémoire vive envoyée en Mo, pour repérer les téléphones d'entrée de gamme.
class RamAppareilTest {
    @Test
    fun `octets convertis en Mo, valeurs hors contrat écartées`() {
        assertEquals(2816, IdentiteAppareil.ramMo(2_952_790_016L))
        assertEquals(8192, IdentiteAppareil.ramMo(8L * 1024 * 1024 * 1024))
        assertNull(IdentiteAppareil.ramMo(null))
        assertNull(IdentiteAppareil.ramMo(100L * 1024 * 1024))
        assertNull(IdentiteAppareil.ramMo(128L * 1024 * 1024 * 1024))
    }

    @Test
    fun `sans mémoire connue, le champ reste absent`() {
        assertNull(Appareil(modele = "A70", versionAndroid = "13", niveauApi = 33).ramMo)
    }
}
