package bj.nakayo.noyau

// Ce dont les écrans de l'app ont besoin. ApiNakayo l'implémente ; les tests utilisent un faux.
interface ServiceTesteur {
    suspend fun sante(): Resultat<Sante>
    suspend fun support(): Resultat<Support>
    suspend fun envoyerCode(telephone: String): Resultat<EnvoiCode>
    suspend fun verifierCode(telephone: String, code: String, appareil: Appareil): Resultat<ResultatVerification>
    suspend fun inscrire(jetonInscription: String, formulaire: FormulaireInscription, pieceIdentite: Photo, selfie: Photo): Resultat<ProfilTesteur>
    suspend fun moi(): Resultat<ProfilTesteur>
    suspend fun modifierProfil(langues: List<String>? = null, appareil: Appareil? = null): Resultat<ProfilTesteur>
    suspend fun demanderChangementMomo(numeroMomo: String, operateurMomo: String, motif: String): Resultat<DemandeChangementMomo>
    suspend fun envoyerTicket(sujet: String, message: String): Resultat<Ticket>
    suspend fun mesTickets(): Resultat<List<Ticket>>
    suspend fun deconnecter()

    // Sprint 3 : apps à tester et test quotidien (docs/api-sprint3.md §2).
    suspend fun mesApps(): Resultat<List<AffectationTesteur>>
    suspend fun confirmerInscription(affectationId: String, capture: Photo): Resultat<AffectationTesteur>
    suspend fun confirmerInstallation(affectationId: String, sourceInstallation: String): Resultat<AffectationTesteur>
    suspend fun envoyerRapport(affectationId: String, rapport: RapportJour): Resultat<AffectationTesteur>
    suspend fun signaler(): Resultat<Unit>
    suspend fun envoyerUsages(usages: List<UsageJour>): Resultat<BilanUsages>

    // US-33 : rapports de bugs avec captures (docs/api-bugs.md §1).
    suspend fun envoyerBug(affectationId: String, bug: RapportBug, captures: List<Photo>): Resultat<BugSignale>
    suspend fun mesBugs(affectationId: String): Resultat<List<BugSignale>>

    // US-37 : questionnaire terrain de l'Offre Plus (docs/api-offres.md §4.5).
    suspend fun envoyerRetourTerrain(affectationId: String, retour: RetourTerrain): Resultat<AffectationTesteur>

    // US-39 : code de parrainage, prime et filleuls (docs/api-parrainage.md §2).
    suspend fun parrainage(): Resultat<Parrainage>

    // Sprint 4 : gains en attente et versements reçus (docs/api-sprint4.md §3).
    suspend fun portefeuille(): Resultat<Portefeuille>

    // Un jeton de session est-il gardé sur le téléphone ? (sans appel réseau)
    suspend fun sessionOuverte(): Boolean
}
