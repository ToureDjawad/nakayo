package bj.nakayo.noyau

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException
import java.util.concurrent.TimeUnit

// Client de l'API Nakayo pour l'app testeur (contrat docs/api-sprint1.md §4).
// Le jeton de session est lu dans `stockage` et envoyé en « Authorization: Bearer ».
class ApiNakayo(
    urlBase: String,
    private val stockage: StockageJeton,
    private val client: OkHttpClient = clientParDefaut(),
) : ServiceTesteur {
    private val base: HttpUrl = urlBase.trimEnd('/').plus("/").toHttpUrl()

    // GET /api/health : l'API et la base répondent-elles ?
    override suspend fun sante(): Resultat<Sante> = appeler(requete("api/health").get(), Sante.serializer(), authentifie = false)

    // §11.1 Contact du support, sans connexion.
    override suspend fun support(): Resultat<Support> =
        when (val r = appeler(requete("api/support").get(), ReponseSupport.serializer(), authentifie = false)) {
            is Resultat.Succes -> Resultat.Succes(r.valeur.support)
            is Resultat.Echec -> r
        }

    // §4.1 Envoi d'un code SMS à 6 chiffres.
    override suspend fun envoyerCode(telephone: String): Resultat<EnvoiCode> =
        appeler(
            requete("api/auth/sms/envoi").post(json(CorpsEnvoi.serializer(), CorpsEnvoi(telephone))),
            EnvoiCode.serializer(),
            authentifie = false,
        )

    // §4.2 Vérification du code. Un numéro connu ouvre la session (jeton enregistré).
    override suspend fun verifierCode(telephone: String, code: String, appareil: Appareil): Resultat<ResultatVerification> {
        val corps = CorpsVerification(telephone, code, appareil)
        val reponse = appeler(
            requete("api/auth/sms/verification").post(json(CorpsVerification.serializer(), corps)),
            ReponseVerification.serializer(),
            authentifie = false,
        )
        return when (reponse) {
            is Resultat.Echec -> reponse
            is Resultat.Succes -> {
                val r = reponse.valeur
                when {
                    r.resultat == "connecte" && r.jeton != null && r.utilisateur != null -> {
                        stockage.ecrire(r.jeton)
                        Resultat.Succes(ResultatVerification.Connecte(r.jeton, r.utilisateur))
                    }
                    r.resultat == "inscription" && r.jetonInscription != null ->
                        Resultat.Succes(ResultatVerification.Inscription(r.jetonInscription, r.expireDans ?: 0))
                    else -> Resultat.Echec(ErreurApi.Inattendue(200))
                }
            }
        }
    }

    // §4.3 Inscription avec le jeton remis après le code SMS. La session ouverte est gardée.
    override suspend fun inscrire(
        jetonInscription: String,
        formulaire: FormulaireInscription,
        pieceIdentite: Photo,
        selfie: Photo,
    ): Resultat<ProfilTesteur> {
        val corps = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart("nom", formulaire.nom)
            .addFormDataPart("ville", formulaire.ville)
            .addFormDataPart("gmail", formulaire.gmail)
            .addFormDataPart("numeroMomo", formulaire.numeroMomo)
            .addFormDataPart("operateurMomo", formulaire.operateurMomo)
            .addFormDataPart("consentementSuivi", formulaire.consentementSuivi.toString())
            .addFormDataPart("accepteConditions", formulaire.accepteConditions.toString())
            .addFormDataPart("appareil", JSON.encodeToString(Appareil.serializer(), formulaire.appareil))
            .apply { formulaire.codeParrainage?.takeIf { it.isNotBlank() }?.let { addFormDataPart("codeParrainage", it) } }
            .apply { formulaire.ancienneteGmail?.let { addFormDataPart("ancienneteGmail", it) } }
            .addFormDataPart("pieceIdentite", nomFichier("piece-identite", pieceIdentite), photo(pieceIdentite))
            .addFormDataPart("selfie", nomFichier("selfie", selfie), photo(selfie))
            .build()
        val requete = requete("api/testeurs/inscription").header("Authorization", "Bearer $jetonInscription").post(corps)
        return when (val r = appeler(requete, ReponseSession.serializer(), authentifie = false)) {
            is Resultat.Echec -> r
            is Resultat.Succes -> {
                stockage.ecrire(r.valeur.jeton)
                Resultat.Succes(r.valeur.utilisateur)
            }
        }
    }

    // §4.4 Profil du testeur connecté. Une session expirée efface le jeton gardé.
    override suspend fun moi(): Resultat<ProfilTesteur> =
        appeler(requete("api/testeurs/moi").get(), ReponseUtilisateur.serializer()).map { it.utilisateur }

    // §4.4 Langues parlées et téléphone utilisé. Le numéro MoMo et le Gmail ne changent pas ici.
    override suspend fun modifierProfil(langues: List<String>?, appareil: Appareil?): Resultat<ProfilTesteur> =
        appeler(
            requete("api/testeurs/moi").patch(json(CorpsProfil.serializer(), CorpsProfil(langues, appareil))),
            ReponseUtilisateur.serializer(),
        ).map { it.utilisateur }

    // §4.4 Demande de changement de numéro Mobile Money, validée ensuite par l'équipe.
    override suspend fun demanderChangementMomo(numeroMomo: String, operateurMomo: String, motif: String): Resultat<DemandeChangementMomo> =
        appeler(
            requete("api/testeurs/moi/demande-changement-momo")
                .post(json(CorpsDemandeMomo.serializer(), CorpsDemandeMomo(numeroMomo, operateurMomo, motif))),
            ReponseDemande.serializer(),
        ).map { it.demande }

    // §12.1 Message au support, et les 20 derniers envoyés.
    override suspend fun envoyerTicket(sujet: String, message: String): Resultat<Ticket> =
        appeler(requete("api/tickets").post(json(CorpsTicket.serializer(), CorpsTicket(sujet, message))), ReponseTicket.serializer())
            .map { it.ticket }

    override suspend fun mesTickets(): Resultat<List<Ticket>> =
        appeler(requete("api/tickets/moi").get(), ReponseTickets.serializer()).map { it.tickets }

    // Sprint 3 §2.1 : apps à tester, de la plus ancienne affectation à la plus récente.
    override suspend fun mesApps(): Resultat<List<AffectationTesteur>> =
        appeler(requete("api/testeurs/moi/apps").get(), ReponseApps.serializer()).map { it.apps }

    // Sprint 4 §3 : portefeuille du testeur.
    override suspend fun parrainage(): Resultat<Parrainage> =
        appeler(requete("api/testeurs/moi/parrainage").get(), ReponseParrainage.serializer()).map { it.parrainage }

    override suspend fun portefeuille(): Resultat<Portefeuille> =
        appeler(requete("api/testeurs/moi/portefeuille").get(), ReponsePortefeuille.serializer()).map { it.portefeuille }

    // §2.2 Capture de la page « Vous êtes testeur » de Google Play.
    override suspend fun confirmerInscription(affectationId: String, capture: Photo, gmailPrincipal: Boolean): Resultat<AffectationTesteur> {
        val corps = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .apply { if (gmailPrincipal) addFormDataPart("gmailPrincipal", "true") }
            .addFormDataPart("capture", nomFichier("capture", capture), photo(capture))
            .build()
        return appeler(requete(cheminApp(affectationId, "inscription")).post(corps), ReponseApp.serializer()).map { it.app }
    }

    // §2.3 Source d'installation donnée par Android (le Play Store : « com.android.vending »).
    override suspend fun confirmerInstallation(affectationId: String, sourceInstallation: String): Resultat<AffectationTesteur> =
        appeler(
            requete(cheminApp(affectationId, "installation"))
                .post(json(CorpsInstallation.serializer(), CorpsInstallation(sourceInstallation))),
            ReponseApp.serializer(),
        ).map { it.app }

    // §2.4 Rapport du jour.
    override suspend fun envoyerRapport(affectationId: String, rapport: RapportJour): Resultat<AffectationTesteur> =
        appeler(requete(cheminApp(affectationId, "rapports")).post(json(RapportJour.serializer(), rapport)), ReponseApp.serializer())
            .map { it.app }

    // docs/api-bugs.md §1.1 Rapport de bug : champs texte et jusqu'à 5 captures.
    override suspend fun envoyerBug(affectationId: String, bug: RapportBug, captures: List<Photo>): Resultat<BugSignale> {
        val corps = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart("titre", bug.titre)
            .addFormDataPart("etapes", bug.etapes)
            .addFormDataPart("resultatAttendu", bug.resultatAttendu)
            .addFormDataPart("resultatObtenu", bug.resultatObtenu)
            .addFormDataPart("gravite", bug.gravite)
            .addFormDataPart("versionApp", bug.versionApp)
        captures.forEachIndexed { i, capture -> corps.addFormDataPart("captures", nomFichier("capture-${i + 1}", capture), photo(capture)) }
        return appeler(requete(cheminApp(affectationId, "bugs")).post(corps.build()), ReponseBug.serializer()).map { it.bug }
    }

    // docs/api-bugs.md §1.2 Bugs déjà signalés sur cette app.
    override suspend fun mesBugs(affectationId: String): Resultat<List<BugSignale>> =
        appeler(requete(cheminApp(affectationId, "bugs")).get(), ReponseBugs.serializer()).map { it.bugs }

    // docs/api-offres.md §4.5 Questionnaire terrain (Offre Plus).
    override suspend fun envoyerRetourTerrain(affectationId: String, retour: RetourTerrain): Resultat<AffectationTesteur> =
        appeler(requete(cheminApp(affectationId, "terrain")).post(json(RetourTerrain.serializer(), retour)), ReponseApp.serializer())
            .map { it.app }

    // §2.5 Ouverture de l'app compagnon, horodatée par le serveur.
    override suspend fun signaler(integrite: Integrite?): Resultat<Unit> {
        val corps = integrite?.takeIf { it.suspecte }?.let { json(CorpsSignal.serializer(), CorpsSignal(it)) } ?: ByteArray(0).toRequestBody(null)
        return appeler(requete("api/testeurs/moi/signal").post(corps), null)
    }

    // §2.6 Cumuls du temps d'utilisation des apps testées.
    override suspend fun envoyerUsages(usages: List<UsageJour>): Resultat<BilanUsages> =
        appeler(requete("api/testeurs/moi/usages").post(json(CorpsUsages.serializer(), CorpsUsages(usages))), BilanUsages.serializer())

    private fun cheminApp(affectationId: String, action: String) =
        "api/testeurs/moi/apps/" + java.net.URLEncoder.encode(affectationId, "UTF-8") + "/" + action

    // §3.2 Déconnexion : le jeton local est effacé même si le serveur ne répond pas.
    override suspend fun deconnecter() {
        appeler<Unit>(requete("api/auth/deconnexion").post(ByteArray(0).toRequestBody(null)), null)
        stockage.effacer()
    }

    override suspend fun sessionOuverte(): Boolean = stockage.lire() != null

    private fun requete(chemin: String) = Request.Builder().url(base.resolve(chemin)!!).header("Accept", "application/json")

    private fun photo(photo: Photo): RequestBody = photo.octets.toRequestBody(photo.typeMime.toMediaType())

    private fun nomFichier(nom: String, photo: Photo) = if (photo.typeMime == "image/png") "$nom.png" else "$nom.jpg"

    private fun <T> json(serialiseur: KSerializer<T>, valeur: T): RequestBody =
        JSON.encodeToString(serialiseur, valeur).toRequestBody(TYPE_JSON)

    private suspend fun <T> appeler(
        constructeur: Request.Builder,
        serialiseur: KSerializer<T>?,
        authentifie: Boolean = true,
    ): Resultat<T> {
        if (authentifie) stockage.lire()?.let { constructeur.header("Authorization", "Bearer $it") }
        val resultat = withContext(Dispatchers.IO) {
            try {
                client.newCall(constructeur.build()).execute().use { lire(it, serialiseur) }
            } catch (_: IOException) {
                Resultat.Echec(ErreurApi.Reseau)
            }
        }
        val erreur = (resultat as? Resultat.Echec)?.erreur
        if (authentifie && erreur is ErreurApi.Http && erreur.code == "non_authentifie") stockage.effacer()
        return resultat
    }

    private fun <T> lire(reponse: Response, serialiseur: KSerializer<T>?): Resultat<T> {
        val texte = reponse.body?.string().orEmpty()
        if (reponse.isSuccessful) {
            @Suppress("UNCHECKED_CAST")
            if (serialiseur == null) return Resultat.Succes(Unit as T)
            return try {
                Resultat.Succes(JSON.decodeFromString(serialiseur, texte))
            } catch (_: SerializationException) {
                Resultat.Echec(ErreurApi.Inattendue(reponse.code))
            } catch (_: IllegalArgumentException) {
                Resultat.Echec(ErreurApi.Inattendue(reponse.code))
            }
        }
        return Resultat.Echec(lireErreur(reponse.code, texte, reponse.header("Retry-After")))
    }

    companion object {
        private val TYPE_JSON = "application/json; charset=utf-8".toMediaType()

        internal val JSON = Json {
            ignoreUnknownKeys = true
            explicitNulls = false
        }

        // Délais adaptés aux réseaux mobiles lents : l'app affiche une erreur réseau au-delà.
        fun clientParDefaut(): OkHttpClient = OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .build()

        internal fun lireErreur(statut: Int, texte: String, retryAfter: String?): ErreurApi {
            val detail = try {
                JSON.decodeFromString(EnveloppeErreur.serializer(), texte).erreur
            } catch (_: SerializationException) {
                null
            } catch (_: IllegalArgumentException) {
                null
            } ?: return ErreurApi.Inattendue(statut)
            return ErreurApi.Http(
                statut = statut,
                code = detail.code,
                message = detail.message,
                champs = detail.champs,
                reessayerDans = retryAfter?.trim()?.toIntOrNull(),
                tentativesRestantes = detail.tentativesRestantes,
            )
        }
    }
}
