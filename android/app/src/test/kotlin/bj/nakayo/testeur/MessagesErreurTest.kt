package bj.nakayo.testeur

import bj.nakayo.noyau.ErreurApi
import bj.nakayo.testeur.ui.MessagesErreur
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class MessagesErreurTest {
    @Test
    fun `coupure réseau`() {
        assertTrue(MessagesErreur.pour(ErreurApi.Reseau).startsWith("Pas de connexion au serveur."))
    }

    @Test
    fun `trop de tentatives avec le délai du serveur`() {
        assertEquals("Trop de tentatives. Réessayez dans 45 secondes.", MessagesErreur.pour(ErreurApi.Http(429, "trop_de_requetes", reessayerDans = 45)))
        assertEquals("Trop de tentatives. Réessayez dans 2 minutes.", MessagesErreur.pour(ErreurApi.Http(429, "trop_de_requetes", reessayerDans = 61)))
        assertEquals("Trop de tentatives. Réessayez dans quelques minutes.", MessagesErreur.pour(ErreurApi.Http(429, "trop_de_requetes")))
    }

    @Test
    fun `code SMS faux avec les essais restants`() {
        val code = { n: Int? -> MessagesErreur.pour(ErreurApi.Http(400, "code_invalide", tentativesRestantes = n)) }
        assertEquals("Code incorrect. Il vous reste 3 essais.", code(3))
        assertEquals("Code incorrect. Il vous reste 1 essai.", code(1))
        assertEquals("Code incorrect. Demandez un nouveau code.", code(0))
    }

    @Test
    fun `durées au singulier et au pluriel`() {
        assertEquals("1 seconde", MessagesErreur.duree(1))
        assertEquals("59 secondes", MessagesErreur.duree(59))
        assertEquals("1 minute", MessagesErreur.duree(60))
        assertEquals("10 minutes", MessagesErreur.duree(600))
    }

    @Test
    fun `aucun message ne laisse passer le texte technique du serveur`() {
        val technique = "SQLSTATE 23505 duplicate key"
        for (code in listOf("erreur_interne", "inconnu", "validation", "service_indisponible")) {
            assertTrue(technique !in MessagesErreur.pour(ErreurApi.Http(500, code, message = technique)), code)
        }
    }
}
