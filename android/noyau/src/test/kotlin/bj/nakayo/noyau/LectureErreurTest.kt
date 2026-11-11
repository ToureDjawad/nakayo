package bj.nakayo.noyau

import kotlin.test.Test
import kotlin.test.assertEquals

class LectureErreurTest {
    @Test
    fun `lit le format d'erreur du contrat avec ses champs`() {
        val erreur = ApiNakayo.lireErreur(
            422,
            """{"erreur":{"code":"validation","message":"Certains champs sont invalides.","champs":{"telephone":"format_invalide"}}}""",
            null,
        )
        assertEquals(ErreurApi.Http(422, "validation", "Certains champs sont invalides.", mapOf("telephone" to "format_invalide")), erreur)
    }

    @Test
    fun `garde le délai Retry-After et les tentatives restantes`() {
        val limite = ApiNakayo.lireErreur(429, """{"erreur":{"code":"trop_de_requetes","message":"x"}}""", " 42 ") as ErreurApi.Http
        assertEquals(42, limite.reessayerDans)
        val code = ApiNakayo.lireErreur(400, """{"erreur":{"code":"code_invalide","message":"x","tentativesRestantes":3}}""", null) as ErreurApi.Http
        assertEquals(3, code.tentativesRestantes)
    }

    @Test
    fun `une réponse qui n'est pas au format du contrat devient une erreur inattendue`() {
        assertEquals(ErreurApi.Inattendue(502), ApiNakayo.lireErreur(502, "<html>Bad gateway</html>", null))
        assertEquals(ErreurApi.Inattendue(500), ApiNakayo.lireErreur(500, "", null))
        assertEquals(ErreurApi.Inattendue(404), ApiNakayo.lireErreur(404, """{"erreur":"Route introuvable"}""", null))
    }
}
