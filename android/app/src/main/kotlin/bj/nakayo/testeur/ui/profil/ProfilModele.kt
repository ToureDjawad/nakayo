package bj.nakayo.testeur.ui.profil

import bj.nakayo.noyau.ErreurApi
import bj.nakayo.noyau.ProfilTesteur
import bj.nakayo.noyau.Resultat
import bj.nakayo.noyau.ServiceTesteur
import bj.nakayo.noyau.Telephone
import bj.nakayo.testeur.ui.MessagesChamps
import bj.nakayo.testeur.ui.MessagesErreur
import bj.nakayo.testeur.ui.inscription.LANGUES
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class VueProfil { Resume, ChangementMomo }

data class EtatProfil(
    val profil: ProfilTesteur,
    val vue: VueProfil = VueProfil.Resume,
    val langues: Set<String> = profil.langues.toSet(),
    val enregistrementLangues: Boolean = false,
    // Message en haut du résumé (langues enregistrées, demande envoyée, erreur).
    val information: String? = null,
    val erreur: String? = null,
    // Formulaire de changement de numéro Mobile Money.
    val numeroMomo: String = "",
    val operateurMomo: String? = null,
    val motif: String = "",
    val erreurs: Map<String, String> = emptyMap(),
    val messageDemande: String? = null,
    val envoiDemande: Boolean = false,
) {
    val languesModifiees: Boolean get() = langues != profil.langues.toSet()
}

// Profil du testeur (contrat §4.4) : langues parlées et demande de changement de numéro Mobile Money.
// Le Gmail, le numéro et l'opérateur ne se modifient pas directement.
class ProfilModele(
    private val service: ServiceTesteur,
    private val portee: CoroutineScope,
    profil: ProfilTesteur,
    // Retour à l'espace, avec le profil à jour.
    private val surQuitter: (ProfilTesteur) -> Unit,
    private val surSessionExpiree: (message: String) -> Unit,
) {
    private val etatInterne = MutableStateFlow(EtatProfil(profil))
    val etat: StateFlow<EtatProfil> = etatInterne.asStateFlow()

    fun basculerLangue(code: String) = etatInterne.update {
        it.copy(langues = if (code in it.langues) it.langues - code else it.langues + code, information = null, erreur = null)
    }

    fun enregistrerLangues() {
        val actuel = etatInterne.value
        if (actuel.enregistrementLangues || !actuel.languesModifiees) return
        if (actuel.langues.isEmpty()) {
            etatInterne.update { it.copy(erreur = MessagesChamps.langues("requis")) }
            return
        }
        etatInterne.update { it.copy(enregistrementLangues = true, information = null, erreur = null) }
        portee.launch {
            val langues = LANGUES.map { it.first }.filter { it in actuel.langues }
            when (val r = service.modifierProfil(langues = langues)) {
                is Resultat.Succes -> etatInterne.update {
                    it.copy(profil = r.valeur, langues = r.valeur.langues.toSet(), enregistrementLangues = false, information = "Vos langues sont enregistrées.")
                }
                is Resultat.Echec -> {
                    if (expiree(r.erreur)) return@launch
                    etatInterne.update { it.copy(enregistrementLangues = false, erreur = MessagesErreur.pour(r.erreur)) }
                }
            }
        }
    }

    fun ouvrirChangementMomo() = etatInterne.update {
        it.copy(vue = VueProfil.ChangementMomo, numeroMomo = "", operateurMomo = null, motif = "", erreurs = emptyMap(), messageDemande = null, information = null, erreur = null)
    }

    fun saisirNumeroMomo(valeur: String) = etatInterne.update {
        it.copy(numeroMomo = valeur.filter { c -> c.isDigit() || c == '+' || c == ' ' }.take(20), erreurs = it.erreurs - "numeroMomo", messageDemande = null)
    }

    fun choisirOperateurMomo(code: String) = etatInterne.update { it.copy(operateurMomo = code, erreurs = it.erreurs - "operateurMomo") }

    fun saisirMotif(valeur: String) = etatInterne.update { it.copy(motif = valeur.take(300), erreurs = it.erreurs - "motif") }

    fun envoyerDemande() {
        val actuel = etatInterne.value
        if (actuel.envoiDemande) return
        val numero = Telephone.normaliser(actuel.numeroMomo)
        val motif = actuel.motif.trim()
        val erreurs = buildMap {
            Telephone.valider(numero)?.let { put("numeroMomo", it) }
            if (actuel.operateurMomo == null) put("operateurMomo", "requis")
            when {
                motif.isEmpty() -> put("motif", "requis")
                motif.length < 10 -> put("motif", "trop_court")
            }
            if (isEmpty() && numero == actuel.profil.numeroMomo && actuel.operateurMomo == actuel.profil.operateurMomo) put("numeroMomo", "identique")
        }
        if (erreurs.isNotEmpty()) {
            etatInterne.update { it.copy(erreurs = erreurs) }
            return
        }
        etatInterne.update { it.copy(envoiDemande = true, messageDemande = null) }
        portee.launch {
            when (val r = service.demanderChangementMomo(numero, actuel.operateurMomo!!, motif)) {
                is Resultat.Succes -> etatInterne.update {
                    it.copy(
                        profil = it.profil.copy(demandeChangementMomo = r.valeur),
                        vue = VueProfil.Resume,
                        envoiDemande = false,
                        information = "Demande envoyée. L'équipe Nakayo la vérifie, puis vous prévient par SMS.",
                    )
                }
                is Resultat.Echec -> {
                    if (expiree(r.erreur)) return@launch
                    val http = r.erreur as? ErreurApi.Http
                    etatInterne.update {
                        it.copy(
                            envoiDemande = false,
                            erreurs = http?.champs.orEmpty(),
                            messageDemande = when {
                                http?.code == "statut_incompatible" -> "Une demande de changement est déjà en cours de vérification."
                                http?.champs.isNullOrEmpty() -> MessagesErreur.pour(r.erreur)
                                else -> null
                            },
                        )
                    }
                }
            }
        }
    }

    private fun expiree(erreur: ErreurApi): Boolean {
        if ((erreur as? ErreurApi.Http)?.code != "non_authentifie") return false
        surSessionExpiree(MessagesErreur.pour(erreur))
        return true
    }

    // Retour : du formulaire vers le résumé, du résumé vers l'espace.
    fun retour() {
        val actuel = etatInterne.value
        when {
            actuel.envoiDemande -> Unit
            actuel.vue == VueProfil.ChangementMomo -> etatInterne.update { it.copy(vue = VueProfil.Resume, messageDemande = null) }
            else -> surQuitter(actuel.profil)
        }
    }
}
