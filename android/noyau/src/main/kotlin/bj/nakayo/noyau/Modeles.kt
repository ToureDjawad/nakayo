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
    // US-35 : mémoire vive totale en Mo (entrée de gamme : 3 Go ou moins).
    val ramMo: Int? = null,
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
    // US-39 : code à donner aux personnes qu'on parraine.
    val codeParrainage: String? = null,
    // US-38 : niveau Bronze, Argent ou Or (docs/api-niveaux.md).
    val niveau: NiveauTesteur? = null,
)

// Niveau du testeur (US-38) : ses chiffres et ce qu'il manque pour le suivant (null au niveau Or).
@Serializable
data class NiveauTesteur(
    val code: String,
    val nom: String,
    val campagnesTerminees: Int = 0,
    val bugsAcceptes: Int = 0,
    val assiduite: Int = 0,
    val suivant: NiveauSuivant? = null,
)

@Serializable
data class NiveauSuivant(val code: String, val nom: String, val conditions: List<ConditionNiveau> = emptyList())

// code : « campagnes », « bugs » ou « assiduite » (en %).
@Serializable
data class ConditionNiveau(val code: String, val requis: Int, val actuel: Int, val rempli: Boolean)

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
    // US-39 : code du parrain, facultatif.
    val codeParrainage: String? = null,
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

// ---- Sprint 3 : test quotidien (docs/api-sprint3.md §2) ----

// App du développeur, telle que le testeur la voit.
@Serializable
data class AppTestee(
    val id: String,
    val nom: String,
    @SerialName("package") val paquet: String,
    val instructions: String? = null,
    val fonctionnalites: List<String> = emptyList(),
    val connexionRequise: Boolean = false,
    val identifiantsTest: String? = null,
)

// Dernière remise à zéro du compteur (US-20) : le jour et ce qui manquait (« connexion », « usage », « rapport »).
@Serializable
data class DerniereRemise(val jour: String, val manquait: List<String> = emptyList())

// Une app à tester par le testeur, avec où il en est aujourd'hui (§2.1 et §3.3).
@Serializable
data class AffectationTesteur(
    val id: String,
    val campagneId: String,
    val app: AppTestee,
    val lienInscription: String? = null,
    val lienPlayStore: String,
    val jourCampagne: Int,
    val joursCampagne: Int,
    val joursExiges: Int,
    val joursValides: Int,
    val joursAcquis: Boolean = false,
    val derniereRemise: DerniereRemise? = null,
    val inscriptionConfirmee: Boolean,
    val installationConfirmee: Boolean,
    val rapportDuJour: Boolean,
    val retourDetailleAttendu: Boolean,
    val usageDuJourSecondes: Int = 0,
    val usageMinimumSecondes: Int = 120,
    // US-33 : rapports de bugs avec captures (offres Pro et Plus).
    val rapportsDeBugs: Boolean = false,
    // US-37 : questionnaire terrain (Offre Plus), absent pour les autres offres.
    val questionnaireTerrain: QuestionnaireTerrain? = null,
)

// US-37 : le questionnaire s'ouvre au jour `ouvertLe` et ne se remplit qu'une fois.
@Serializable
data class QuestionnaireTerrain(val envoye: Boolean, val ouvert: Boolean, val ouvertLe: Int = 7)

// Réponses du questionnaire terrain (docs/api-offres.md §4.5).
// connexion : wifi, 4g, 3g ou 2g ; reseau et telephone : fluide, lent ou inutilisable ;
// langue : fr ou en ; comprehension : de 1 à 5.
@Serializable
data class RetourTerrain(
    val connexion: String,
    val reseau: String,
    val telephone: String,
    val langue: String,
    val comprehension: Int,
    val commentaire: String? = null,
)

// Position du téléphone : le serveur l'arrondit à 1 km environ.
@Serializable
data class Position(val latitude: Double, val longitude: Double)

// Rapport du jour (§2.4).
@Serializable
data class RapportJour(
    val actions: String,
    val note: Int,
    val bug: Boolean,
    val commentaireBug: String? = null,
    val fonctionnalites: List<String>,
    val versionApp: String,
    val position: Position,
    val retourDetaille: String? = null,
    // US-16 : vrai si le rapport part en Wi-Fi (le serveur garde alors une empreinte du réseau).
    val wifi: Boolean? = null,
)

// US-33 : rapport de bug (docs/api-bugs.md §1.1). Gravité : « mineure », « genante » ou « bloquante ».
data class RapportBug(
    val titre: String,
    val etapes: String,
    val resultatAttendu: String,
    val resultatObtenu: String,
    val gravite: String,
    val versionApp: String,
)

// Un bug signalé, avec la décision du développeur : « nouveau », « accepte » ou « refuse ».
@Serializable
data class BugSignale(
    val id: String,
    val titre: String,
    val gravite: String,
    val captures: Int = 0,
    val statut: String,
    val motifRefus: String? = null,
    val signaleLe: String,
)

@Serializable
internal data class ReponseBug(val bug: BugSignale)

@Serializable
internal data class ReponseBugs(val bugs: List<BugSignale>)

// Temps passé dans une app testée un jour donné (heure du Bénin, « AAAA-MM-JJ »).
@Serializable
data class UsageJour(@SerialName("package") val paquet: String, val jour: String, val secondes: Int)

@Serializable
data class BilanUsages(val enregistres: Int, val ignores: Int)

// US-23 : portefeuille du testeur (docs/api-sprint4.md §3).
@Serializable
data class CompteMomo(val operateur: String, val numeroMasque: String)

// Une app qui rapportera 500 FCFA : « en_test » (jours atteints) ou « en_paiement » (versement en route).
@Serializable
data class GainEnAttente(
    val affectationId: String,
    val appNom: String,
    val etat: String,
    val joursValides: Int,
    val joursExiges: Int,
    val montant: Int,
    val devise: String = "XOF",
    val montantLisible: String,
    val prevuLe: String? = null,
)

// Un versement arrivé, avec la référence de la transaction Mobile Money.
@Serializable
data class VersementTesteur(
    val reference: String,
    val referenceTransaction: String? = null,
    val appNom: String,
    val montant: Int,
    val devise: String = "XOF",
    val montantLisible: String,
    val operateur: String,
    val numeroMasque: String,
    val verseLe: String,
)

@Serializable
data class Portefeuille(
    val devise: String = "XOF",
    val totalEnAttente: Int,
    val totalEnAttenteLisible: String,
    val totalVerse: Int,
    val totalVerseLisible: String,
    val compte: CompteMomo? = null,
    val enAttente: List<GainEnAttente> = emptyList(),
    val historique: List<VersementTesteur> = emptyList(),
)

@Serializable
internal data class ReponsePortefeuille(val portefeuille: Portefeuille)

// Parrainage (US-39, docs/api-parrainage.md §2).
@Serializable
data class Parrainage(
    val code: String? = null,
    val prime: Montant,
    val totalVerse: Int = 0,
    val totalVerseLisible: String = "",
    val filleuls: List<Filleul> = emptyList(),
)

@Serializable
data class Montant(val montant: Int, val devise: String, val montantLisible: String)

// etat : compte_en_validation, en_attente_de_campagne, prime_en_paiement, prime_versee ou inactif.
@Serializable
data class Filleul(val nom: String, val inscritLe: String, val etat: String)

@Serializable
internal data class ReponseParrainage(val parrainage: Parrainage)

@Serializable
internal data class ReponseApps(val apps: List<AffectationTesteur>)

@Serializable
internal data class ReponseApp(val app: AffectationTesteur)

@Serializable
internal data class CorpsInstallation(val sourceInstallation: String)

@Serializable
internal data class CorpsUsages(val usages: List<UsageJour>)
