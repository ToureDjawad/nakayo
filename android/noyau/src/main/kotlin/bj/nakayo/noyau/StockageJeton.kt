package bj.nakayo.noyau

// Où l'app garde le jeton de session. Sur Android : chiffré avec une clé du Keystore.
interface StockageJeton {
    suspend fun lire(): String?
    suspend fun ecrire(jeton: String)
    suspend fun effacer()
}

class StockageJetonMemoire(private var jeton: String? = null) : StockageJeton {
    override suspend fun lire() = jeton
    override suspend fun ecrire(jeton: String) { this.jeton = jeton }
    override suspend fun effacer() { jeton = null }
}
