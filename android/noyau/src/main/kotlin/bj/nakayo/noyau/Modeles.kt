package bj.nakayo.noyau

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// Objets du contrat d'API (docs/api-sprint1.md). Les champs inconnus sont ignorés,
// pour que l'app ne casse pas quand le serveur ajoute un champ.

@Serializable
data class Sante(val api: String, val base: String)

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
