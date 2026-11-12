package bj.nakayo.noyau

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// Objets du contrat d'API (docs/api-sprint1.md). Les champs inconnus sont ignorés,
// pour que l'app ne casse pas quand le serveur ajoute un champ.

@Serializable
data class Sante(val api: String, val base: String)

// Message envoyé au support (§12) ; statut « ouvert » puis « traite ».
@Serializable
data class Ticket(
    val id: String,
    val sujet: String,
    val message: String,
    val statut: String,
    val creeLe: String,
    val traiteLe: String? = null,
)

// Contact du support publié par l'admin (§11.1) ; `whatsapp` vaut null tant que rien n'est publié.
@Serializable
data class Support(val whatsapp: String? = null)

@Serializable
data class Appareil(
    val fabricant: String? = null,
    val modele: String,
    val versionAndroid: String,
    val niveauApi: Int,
    // Identifiant propre à l'app (pas l'IMEI), absent dans les réponses du serveur.
    val identifiant: String? = null,
)

@Serializable
data class DemandeChangementMomo(
    val id: String,
    val numeroMomo: String,
    val operateurMomo: String,
    val statut: String,
    val creeLe: String,
)

@Serializable
data class ProfilTesteur(
    val id: String,
    val role: String,
    val statut: String,
    val telephone: String,
    val nom: String,
    val ville: String? = null,
    val gmail: String? = null,
    val numeroMomo: String? = null,
    val operateurMomo: String? = null,
    val langues: List<String> = emptyList(),
    val appareil: Appareil? = null,
    val demandeChangementMomo: DemandeChangementMomo? = null,
    val motifRefus: String? = null,
    val creeLe: String,
)

// Formulaire d'inscription d'un testeur (§4.3). Les deux consentements doivent être donnés.
data class FormulaireInscription(
    val nom: String,
    val ville: String,
    val gmail: String,
    val numeroMomo: String,
    val operateurMomo: String,
    val appareil: Appareil,
    val consentementSuivi: Boolean,
    val accepteConditions: Boolean,
)

// Photo prête à l'envoi (JPEG ou PNG, 5 Mo au plus côté serveur).
class Photo(val octets: ByteArray, val typeMime: String = "image/jpeg")

@Serializable
data class EnvoiCode(val expireDans: Int, val renvoiPossibleDans: Int)

sealed interface ResultatVerification {
    // Numéro connu : session ouverte.
    data class Connecte(val jeton: String, val utilisateur: ProfilTesteur) : ResultatVerification

    // Numéro inconnu : l'app enchaîne sur le formulaire d'inscription (US-06).
    data class Inscription(val jetonInscription: String, val expireDans: Int) : ResultatVerification
}

@Serializable
internal data class ReponseVerification(
    val resultat: String,
    val jeton: String? = null,
    val utilisateur: ProfilTesteur? = null,
    val jetonInscription: String? = null,
    val expireDans: Int? = null,
)

@Serializable
internal data class ReponseUtilisateur(val utilisateur: ProfilTesteur)

@Serializable
internal data class ReponseSession(val jeton: String, val utilisateur: ProfilTesteur)

@Serializable
internal data class ReponseDemande(val demande: DemandeChangementMomo)

@Serializable
internal data class CorpsProfil(val langues: List<String>? = null, val appareil: Appareil? = null)

@Serializable
internal data class CorpsDemandeMomo(val numeroMomo: String, val operateurMomo: String, val motif: String)

@Serializable
internal data class CorpsEnvoi(val telephone: String)

@Serializable
internal data class CorpsVerification(val telephone: String, val code: String, val appareil: Appareil)

@Serializable
internal data class EnveloppeErreur(val erreur: DetailErreur)

@Serializable
internal data class DetailErreur(
    val code: String,
    val message: String = "",
    val champs: Map<String, String> = emptyMap(),
    @SerialName("tentativesRestantes") val tentativesRestantes: Int? = null,
)

@Serializable
internal data class ReponseSupport(val support: Support)

@Serializable
internal data class CorpsTicket(val sujet: String, val message: String)

@Serializable
internal data class ReponseTicket(val ticket: Ticket)

@Serializable
internal data class ReponseTickets(val tickets: List<Ticket>)
