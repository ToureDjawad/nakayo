package bj.nakayo.testeur

import bj.nakayo.testeur.ui.profil.etatFilleul
import bj.nakayo.testeur.ui.profil.messageInvitation
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

// US-39 côté Android : textes du parrainage sur « Mon profil ».
class ParrainageTest {
    @Test
    fun `le message d'invitation contient le code`() {
        assertTrue(messageInvitation("K7Q2MP").endsWith("mon code de parrainage à l'inscription : K7Q2MP"))
    }

    @Test
    fun `chaque état du filleul a un libellé`() {
        assertEquals("Compte en vérification", etatFilleul("compte_en_validation"))
        assertEquals("Prime versée", etatFilleul("prime_versee"))
        assertEquals("Compte inactif", etatFilleul("refuse"))
    }
}
