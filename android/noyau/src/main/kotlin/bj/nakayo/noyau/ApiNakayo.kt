package bj.nakayo.noyau

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
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
) {
    private val base: HttpUrl = urlBase.trimEnd('/').plus("/").toHttpUrl()

    // GET /api/health : l'API et la base répondent-elles ?
    suspend fun sante(): Resultat<Sante> = appeler(requete("api/health").get(), Sante.serializer(), authentifie = false)

    // §4.1 Envoi d'un code SMS à 6 chiffres.
    suspend fun envoyerCode(telephone: String): Resultat<EnvoiCode> =
        appeler(
            requete("api/auth/sms/envoi").post(json(CorpsEnvoi.serializer(), CorpsEnvoi(telephone))),
            EnvoiCode.serializer(),
            authentifie = false,
        )

    // §4.2 Vérification du code. Un numéro connu ouvre la session (jeton enregistré).
    suspend fun verifierCode(telephone: String, code: String, appareil: Appareil): Resultat<ResultatVerification> {
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

    // §4.4 Profil du testeur connecté. Une session expirée efface le jeton gardé.
    suspend fun moi(): Resultat<ProfilTesteur> =
        appeler(requete("api/testeurs/moi").get(), ReponseUtilisateur.serializer()).map { it.utilisateur }

    // §3.2 Déconnexion : le jeton local est effacé même si le serveur ne répond pas.
    suspend fun deconnecter() {
        appeler<Unit>(requete("api/auth/deconnexion").post(ByteArray(0).toRequestBody(null)), null)
        stockage.effacer()
    }

    private fun requete(chemin: String) = Request.Builder().url(base.resolve(chemin)!!).header("Accept", "application/json")

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
