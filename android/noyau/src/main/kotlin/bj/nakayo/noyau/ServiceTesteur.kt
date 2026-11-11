package bj.nakayo.noyau

// Ce dont les écrans de l'app ont besoin. ApiNakayo l'implémente ; les tests utilisent un faux.
interface ServiceTesteur {
    suspend fun sante(): Resultat<Sante>
    suspend fun envoyerCode(telephone: String): Resultat<EnvoiCode>
    suspend fun verifierCode(telephone: String, code: String, appareil: Appareil): Resultat<ResultatVerification>
    suspend fun inscrire(jetonInscription: String, formulaire: FormulaireInscription, pieceIdentite: Photo, selfie: Photo): Resultat<ProfilTesteur>
    suspend fun moi(): Resultat<ProfilTesteur>
    suspend fun modifierProfil(langues: List<String>? = null, appareil: Appareil? = null): Resultat<ProfilTesteur>
    suspend fun demanderChangementMomo(numeroMomo: String, operateurMomo: String, motif: String): Resultat<DemandeChangementMomo>
    suspend fun deconnecter()

    // Un jeton de session est-il gardé sur le téléphone ? (sans appel réseau)
    suspend fun sessionOuverte(): Boolean
}
