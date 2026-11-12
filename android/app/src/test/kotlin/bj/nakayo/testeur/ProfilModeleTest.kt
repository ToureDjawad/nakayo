package bj.nakayo.testeur

import bj.nakayo.noyau.ErreurApi
import bj.nakayo.noyau.ProfilTesteur
import bj.nakayo.noyau.Resultat
import bj.nakayo.noyau.ServiceTesteurFactice
import bj.nakayo.testeur.ui.espace.EspaceModele
import bj.nakayo.testeur.ui.espace.EtatEspace
import bj.nakayo.testeur.ui.profil.ProfilModele
import bj.nakayo.testeur.ui.profil.VueProfil
import bj.nakayo.testeur.ui.depuis
import bj.nakayo.testeur.ui.initiales
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ProfilModeleTest {
    private val service = ServiceTesteurFactice(jeton = "jeton")
    private var quitte: ProfilTesteur? = null
    private var expiree: String? = null

    private fun TestScope.modele() = ProfilModele(service, porteeTest(), ServiceTesteurFactice.profil(), { quitte = it }, { expiree = it })

    @Test
    fun `langues, rien à enregistrer tant qu'elles ne changent pas, puis PATCH`() = runTest {
        val m = modele()
        assertFalse(m.etat.value.languesModifiees)
        m.enregistrerLangues()
        assertTrue(service.appels.isEmpty())

        m.basculerLangue("en")
        assertTrue(m.etat.value.languesModifiees)
        m.enregistrerLangues()
        advanceUntilIdle()
        assertTrue("profil:langues=fr,en" in service.appels)
        assertFalse(m.etat.value.languesModifiees)
        assertNotNull(m.etat.value.information)
    }

    @Test
    fun `au moins une langue`() = runTest {
        val m = modele()
        m.basculerLangue("fr")
        m.enregistrerLangues()
        assertNotNull(m.etat.value.erreur)
        assertTrue(service.appels.isEmpty())
    }

    @Test
    fun `demande de changement MoMo, vérifications, envoi, retour au résumé`() = runTest {
        val m = modele()
        m.ouvrirChangementMomo()
        assertEquals(VueProfil.ChangementMomo, m.etat.value.vue)
        m.saisirMotif("court")
        m.envoyerDemande()
        assertEquals(setOf("numeroMomo", "operateurMomo", "motif"), m.etat.value.erreurs.keys)

        // Même numéro et même opérateur que l'actuel.
        m.saisirNumeroMomo("01 96 00 00 00")
        m.choisirOperateurMomo("mtn")
        m.saisirMotif("Je change de puce Mobile Money")
        m.envoyerDemande()
        assertEquals("identique", m.etat.value.erreurs["numeroMomo"])

        m.choisirOperateurMomo("moov")
        m.envoyerDemande()
        advanceUntilIdle()
        assertTrue("demande-momo:+2290196000000:moov" in service.appels)
        assertEquals(VueProfil.Resume, m.etat.value.vue)
        assertEquals("en_attente", m.etat.value.profil.demandeChangementMomo!!.statut)

        m.retour()
        assertEquals("en_attente", quitte!!.demandeChangementMomo!!.statut)
    }

    @Test
    fun `demande déjà en cours, message clair`() = runTest {
        service.reponseDemande = { _, _, _ -> Resultat.Echec(ErreurApi.Http(409, "statut_incompatible")) }
        val m = modele()
        m.ouvrirChangementMomo()
        m.saisirNumeroMomo("0195000000")
        m.choisirOperateurMomo("moov")
        m.saisirMotif("Je change de puce Mobile Money")
        m.envoyerDemande()
        advanceUntilIdle()
        assertTrue(m.etat.value.messageDemande!!.contains("déjà en cours"))
        assertEquals(VueProfil.ChangementMomo, m.etat.value.vue)
    }

    @Test
    fun `session expirée pendant l'enregistrement`() = runTest {
        service.reponseModification = { _, _ -> Resultat.Echec(ErreurApi.Http(401, "non_authentifie")) }
        val m = modele()
        m.basculerLangue("en")
        m.enregistrerLangues()
        advanceUntilIdle()
        assertNotNull(expiree)
    }

    @Test
    fun `l'espace renvoie le téléphone utilisé une fois par ouverture`() = runTest {
        val appareil = bj.nakayo.noyau.Appareil("Samsung", "Galaxy A15", "14", 34, "app-test-identifiant")
        val espace = EspaceModele(service, porteeTest(), null, { appareil }) { }
        advanceUntilIdle()
        assertTrue(espace.etat.value is EtatEspace.Pret)
        assertEquals(listOf("moi", "profil:appareil"), service.appels - "support")
        espace.actualiser()
        advanceUntilIdle()
        assertEquals(listOf("moi", "profil:appareil", "moi"), service.appels - "support")
    }

    @Test
    fun `l'espace montre le WhatsApp du support seulement s'il est publié`() = runTest {
        val sansNumero = EspaceModele(service, porteeTest(), null, null) { }
        advanceUntilIdle()
        assertNull(sansNumero.whatsapp.value)

        service.reponseSupport = { Resultat.Succes(bj.nakayo.noyau.Support("+2290197000000")) }
        val avecNumero = EspaceModele(service, porteeTest(), null, null) { }
        advanceUntilIdle()
        assertEquals("+2290197000000", avecNumero.whatsapp.value)

        // Sans réseau, aucun contact affiché, et l'espace fonctionne quand même.
        service.reponseSupport = { Resultat.Echec(bj.nakayo.noyau.ErreurApi.Reseau) }
        val horsLigne = EspaceModele(service, porteeTest(), null, null) { }
        advanceUntilIdle()
        assertNull(horsLigne.whatsapp.value)
        assertTrue(horsLigne.etat.value is EtatEspace.Pret)
    }

    @Test
    fun `lien WhatsApp`() {
        assertEquals("https://wa.me/2290197000000", bj.nakayo.testeur.ui.lienWhatsapp("+229 01 97 00 00 00"))
    }

    @Test
    fun `initiales et date d'inscription`() {
        assertEquals("AD", initiales("Afi Dossou"))
        assertEquals("K", initiales(" koffi "))
        assertEquals("nov. 2026", depuis("2026-11-10T14:07:01.512Z"))
        assertNull(depuis("pas une date"))
    }
}
