package bj.nakayo.testeur

import bj.nakayo.noyau.Appareil
import bj.nakayo.noyau.ErreurApi
import bj.nakayo.noyau.QuestionnaireTerrain
import bj.nakayo.noyau.Resultat
import bj.nakayo.noyau.RetourTerrain
import bj.nakayo.noyau.ServiceTesteurFactice
import bj.nakayo.noyau.ServiceTesteurFactice.Companion.affectation
import bj.nakayo.testeur.ui.Ecran
import bj.nakayo.testeur.ui.Navigation
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNull

// US-37 côté Android : questionnaire terrain de l'offre Lancement Afrique.
class QuestionnaireTerrainTest {
    private val service = ServiceTesteurFactice("jeton").apply {
        reponseMoi = { Resultat.Succes(ServiceTesteurFactice.profil(statut = "valide")) }
    }
    private val afrique = affectation().copy(questionnaireTerrain = QuestionnaireTerrain(envoye = false, ouvert = true))

    private fun TestScope.navigation() = Navigation(
        service,
        { Appareil("Itel", "A70", "13", 33) },
        porteeTest(),
        { byteArrayOf(1, 2, 3) },
        calcul = UnconfinedTestDispatcher(testScheduler),
        outils = OutilsFactices(),
    )

    @Test
    fun `le questionnaire ne s'ouvre pas avant le 7e jour ni hors Lancement Afrique`() = runTest {
        val nav = navigation()
        advanceUntilIdle()
        nav.allerApp(affectation(), null)
        assertIs<Ecran.App>(nav.ecran.value).modele.repondreTerrain()
        assertIs<Ecran.App>(nav.ecran.value)
        nav.allerApp(afrique.copy(questionnaireTerrain = QuestionnaireTerrain(envoye = false, ouvert = false)), null)
        assertIs<Ecran.App>(nav.ecran.value).modele.repondreTerrain()
        assertIs<Ecran.App>(nav.ecran.value)
    }

    @Test
    fun `réponses obligatoires, commentaire facultatif, puis retour à l'app avec un message`() = runTest {
        val nav = navigation()
        advanceUntilIdle()
        nav.allerApp(afrique, null)
        assertIs<Ecran.App>(nav.ecran.value).modele.repondreTerrain()
        val m = assertIs<Ecran.Terrain>(nav.ecran.value).modele

        m.envoyer()
        assertEquals(setOf("connexion", "reseau", "telephone", "langue", "comprehension"), m.etat.value.erreurs.keys)
        assertNull(service.dernierRetourTerrain)

        m.choisirConnexion("3g")
        m.choisirReseau("lent")
        m.choisirTelephone("fluide")
        m.choisirLangue("fr")
        m.choisirComprehension(4)
        m.saisirCommentaire("court")
        m.envoyer()
        assertEquals(mapOf("commentaire" to "trop_court"), m.etat.value.erreurs)

        m.saisirCommentaire("  ")
        m.envoyer()
        advanceUntilIdle()
        assertEquals(RetourTerrain("3g", "lent", "fluide", "fr", 4, null), service.dernierRetourTerrain)
        val app = assertIs<Ecran.App>(nav.ecran.value).modele.etat.value
        assertEquals(true, app.affectation.questionnaireTerrain?.envoye)
        assertEquals("Merci ! Vos réponses aident le développeur à adapter son app.", app.information)
    }

    @Test
    fun `un questionnaire déjà rempli ailleurs est signalé`() = runTest {
        service.reponseTerrain = { _, _ -> Resultat.Echec(ErreurApi.Http(409, "deja_envoye", "Déjà envoyé.")) }
        val nav = navigation()
        advanceUntilIdle()
        nav.allerApp(afrique, null)
        assertIs<Ecran.App>(nav.ecran.value).modele.repondreTerrain()
        val m = assertIs<Ecran.Terrain>(nav.ecran.value).modele
        m.choisirConnexion("4g")
        m.choisirReseau("fluide")
        m.choisirTelephone("fluide")
        m.choisirLangue("en")
        m.choisirComprehension(5)
        m.envoyer()
        advanceUntilIdle()
        assertEquals("Vous avez déjà répondu au questionnaire pour cette app.", m.etat.value.erreur)
    }
}
