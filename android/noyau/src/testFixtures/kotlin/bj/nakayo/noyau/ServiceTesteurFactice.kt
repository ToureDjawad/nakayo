package bj.nakayo.noyau

// Faux service pour les tests des écrans : chaque réponse se règle, chaque appel est noté.
class ServiceTesteurFactice(var jeton: String? = null) : ServiceTesteur {
    val appels = mutableListOf<String>()

    var reponseSante: suspend () -> Resultat<Sante> = { Resultat.Succes(Sante("ok", "ok")) }
    var reponseSupport: suspend () -> Resultat<Support> = { Resultat.Succes(Support()) }
    var reponseEnvoi: suspend (String) -> Resultat<EnvoiCode> = { Resultat.Succes(EnvoiCode(600, 60)) }
    var reponseVerification: suspend (String, String, Appareil) -> Resultat<ResultatVerification> = { telephone, _, _ ->
        Resultat.Succes(ResultatVerification.Connecte("jeton-test", profil(telephone)))
    }
    var reponseMoi: suspend () -> Resultat<ProfilTesteur> = { Resultat.Succes(profil()) }
    var reponseInscription: suspend (FormulaireInscription) -> Resultat<ProfilTesteur> = { f ->
        Resultat.Succes(profil(f.numeroMomo).copy(nom = f.nom, ville = f.ville, gmail = f.gmail, operateurMomo = f.operateurMomo))
    }
    // Par défaut : le profil de `reponseMoi`, avec les langues et l'appareil envoyés.
    var reponseModification: suspend (List<String>?, Appareil?) -> Resultat<ProfilTesteur> = { langues, appareil ->
        when (val r = reponseMoi()) {
            is Resultat.Succes -> Resultat.Succes(
                r.valeur.copy(langues = langues ?: r.valeur.langues, appareil = appareil?.copy(identifiant = null) ?: r.valeur.appareil),
            )
            is Resultat.Echec -> r
        }
    }
    var reponseDemande: suspend (String, String, String) -> Resultat<DemandeChangementMomo> = { numero, operateur, _ ->
        Resultat.Succes(DemandeChangementMomo("5", numero, operateur, "en_attente", "2026-11-11T10:00:00.000Z"))
    }

    var reponseTicket: suspend (String, String) -> Resultat<Ticket> = { sujet, message ->
        Resultat.Succes(Ticket("12", sujet, message, "ouvert", "2026-11-12T09:00:00.000Z"))
    }
    var reponseMesTickets: suspend () -> Resultat<List<Ticket>> = { Resultat.Succes(emptyList()) }

    // Sprint 3 : par défaut une app inscrite et installée, sans rapport du jour.
    var reponseApps: suspend () -> Resultat<List<AffectationTesteur>> = { Resultat.Succes(listOf(affectation())) }
    var reponseInscriptionTest: suspend (String, Photo) -> Resultat<AffectationTesteur> = { id, _ ->
        Resultat.Succes(affectation(id, inscription = true, installation = false))
    }
    var reponseInstallation: suspend (String, String) -> Resultat<AffectationTesteur> = { id, _ -> Resultat.Succes(affectation(id)) }
    var reponseRapport: suspend (String, RapportJour) -> Resultat<AffectationTesteur> = { id, _ ->
        Resultat.Succes(affectation(id).copy(rapportDuJour = true, retourDetailleAttendu = false))
    }
    var reponseSignal: suspend () -> Resultat<Unit> = { Resultat.Succes(Unit) }
    var reponseUsages: suspend (List<UsageJour>) -> Resultat<BilanUsages> = { Resultat.Succes(BilanUsages(it.size, 0)) }
    var dernierRapport: RapportJour? = null
    var dernieresUsages: List<UsageJour>? = null

    // Derniers envois, pour vérifier ce que l'écran a transmis.
    var dernierFormulaire: FormulaireInscription? = null
    var dernieresPhotos: Pair<Photo, Photo>? = null

    override suspend fun sante() = reponseSante().also { appels += "sante" }

    override suspend fun support() = reponseSupport().also { appels += "support" }

    override suspend fun envoyerCode(telephone: String) = reponseEnvoi(telephone).also { appels += "envoi:$telephone" }

    override suspend fun verifierCode(telephone: String, code: String, appareil: Appareil): Resultat<ResultatVerification> {
        appels += "verification:$telephone:$code"
        val r = reponseVerification(telephone, code, appareil)
        if (r is Resultat.Succes && r.valeur is ResultatVerification.Connecte) jeton = (r.valeur as ResultatVerification.Connecte).jeton
        return r
    }

    override suspend fun inscrire(
        jetonInscription: String,
        formulaire: FormulaireInscription,
        pieceIdentite: Photo,
        selfie: Photo,
    ): Resultat<ProfilTesteur> {
        appels += "inscription:$jetonInscription"
        dernierFormulaire = formulaire
        dernieresPhotos = pieceIdentite to selfie
        val r = reponseInscription(formulaire)
        if (r is Resultat.Succes) jeton = "jeton-inscrit"
        return r
    }

    override suspend fun modifierProfil(langues: List<String>?, appareil: Appareil?): Resultat<ProfilTesteur> {
        appels += "profil:" + listOfNotNull(langues?.let { "langues=" + it.joinToString(",") }, appareil?.let { "appareil" }).joinToString(";")
        return reponseModification(langues, appareil)
    }

    override suspend fun demanderChangementMomo(numeroMomo: String, operateurMomo: String, motif: String): Resultat<DemandeChangementMomo> {
        appels += "demande-momo:$numeroMomo:$operateurMomo"
        return reponseDemande(numeroMomo, operateurMomo, motif)
    }

    override suspend fun envoyerTicket(sujet: String, message: String): Resultat<Ticket> {
        appels += "ticket:$sujet"
        return reponseTicket(sujet, message)
    }

    override suspend fun mesTickets() = reponseMesTickets().also { appels += "tickets" }

    override suspend fun moi(): Resultat<ProfilTesteur> {
        appels += "moi"
        val r = reponseMoi()
        if (r is Resultat.Echec && (r.erreur as? ErreurApi.Http)?.code == "non_authentifie") jeton = null
        return r
    }

    override suspend fun deconnecter() {
        appels += "deconnexion"
        jeton = null
    }

    override suspend fun sessionOuverte() = jeton != null

    override suspend fun mesApps() = reponseApps().also { appels += "apps" }

    override suspend fun confirmerInscription(affectationId: String, capture: Photo) =
        reponseInscriptionTest(affectationId, capture).also { appels += "inscription-test:$affectationId" }

    override suspend fun confirmerInstallation(affectationId: String, sourceInstallation: String) =
        reponseInstallation(affectationId, sourceInstallation).also { appels += "installation:$affectationId:$sourceInstallation" }

    override suspend fun envoyerRapport(affectationId: String, rapport: RapportJour): Resultat<AffectationTesteur> {
        appels += "rapport:$affectationId"
        dernierRapport = rapport
        return reponseRapport(affectationId, rapport)
    }

    override suspend fun signaler() = reponseSignal().also { appels += "signal" }

    override suspend fun envoyerUsages(usages: List<UsageJour>): Resultat<BilanUsages> {
        appels += "usages:${usages.size}"
        dernieresUsages = usages
        return reponseUsages(usages)
    }

    companion object {
        fun affectation(
            id: String = "31",
            inscription: Boolean = true,
            installation: Boolean = true,
            jour: Int = 3,
            joursValides: Int = 2,
        ) = AffectationTesteur(
            id = id,
            campagneId = "4",
            app = AppTestee(
                id = "12",
                nom = "Marché Facile",
                paquet = "bj.studioawa.marche",
                instructions = "Cherchez un produit, ajoutez-le au panier puis suivez la livraison.",
                fonctionnalites = listOf("Recherche de produits", "Panier", "Suivi de livraison"),
                connexionRequise = true,
                identifiantsTest = "Compte : test@marche.bj / Mot de passe : Test2026",
            ),
            lienInscription = "https://play.google.com/apps/testing/bj.studioawa.marche",
            lienPlayStore = "https://play.google.com/store/apps/details?id=bj.studioawa.marche",
            jourCampagne = jour,
            joursCampagne = 16,
            joursExiges = 14,
            joursValides = joursValides,
            inscriptionConfirmee = inscription,
            installationConfirmee = installation,
            rapportDuJour = false,
            retourDetailleAttendu = jour in listOf(3, 7, 12),
            usageDuJourSecondes = 95,
            usageMinimumSecondes = 120,
        )

        fun profil(telephone: String = "+2290197000000", statut: String = "en_attente", motifRefus: String? = null) = ProfilTesteur(
            id = "77",
            role = "testeur",
            statut = statut,
            telephone = telephone,
            nom = "Koffi Agbo",
            ville = "Cotonou",
            gmail = "koffi.agbo@gmail.com",
            numeroMomo = "+2290196000000",
            operateurMomo = "mtn",
            langues = listOf("fr"),
            appareil = Appareil("Tecno", "Spark 20", "14", 34),
            motifRefus = motifRefus,
            creeLe = "2026-11-10T14:07:01.512Z",
        )
    }
}
