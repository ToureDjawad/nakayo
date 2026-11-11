package bj.nakayo.testeur.session

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import bj.nakayo.noyau.StockageJeton
import kotlinx.coroutines.flow.first
import java.security.GeneralSecurityException
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

// Jeton de session chiffré en AES-256-GCM avec une clé du Keystore Android : la clé ne quitte
// jamais le matériel sécurisé du téléphone, et le fichier seul ne permet pas de lire le jeton.
class StockageJetonChiffre(
    private val donnees: DataStore<Preferences>,
    private val alias: String = ALIAS_PAR_DEFAUT,
) : StockageJeton {

    override suspend fun lire(): String? {
        val chiffre = donnees.data.first()[CLE] ?: return null
        return try {
            val octets = Base64.decode(chiffre, Base64.NO_WRAP)
            val iv = octets.copyOfRange(0, TAILLE_IV)
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.DECRYPT_MODE, cle(), GCMParameterSpec(TAILLE_TAG_BITS, iv))
            String(cipher.doFinal(octets, TAILLE_IV, octets.size - TAILLE_IV), Charsets.UTF_8)
        } catch (_: GeneralSecurityException) {
            // Clé perdue (réinitialisation du verrouillage, restauration) ou donnée altérée :
            // on repart sans session, le testeur se reconnecte par SMS.
            effacer()
            null
        } catch (_: IllegalArgumentException) {
            effacer()
            null
        }
    }

    override suspend fun ecrire(jeton: String) {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, cle())
        val chiffre = cipher.iv + cipher.doFinal(jeton.toByteArray(Charsets.UTF_8))
        donnees.edit { it[CLE] = Base64.encodeToString(chiffre, Base64.NO_WRAP) }
    }

    override suspend fun effacer() {
        donnees.edit { it.remove(CLE) }
    }

    private fun cle(): SecretKey {
        val magasin = KeyStore.getInstance(KEYSTORE).apply { load(null) }
        (magasin.getEntry(alias, null) as? KeyStore.SecretKeyEntry)?.let { return it.secretKey }
        val generateur = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE)
        generateur.init(
            KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build(),
        )
        return generateur.generateKey()
    }

    companion object {
        const val ALIAS_PAR_DEFAUT = "nakayo_session"
        private const val KEYSTORE = "AndroidKeyStore"
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
        private const val TAILLE_IV = 12
        private const val TAILLE_TAG_BITS = 128
        private val CLE = stringPreferencesKey("jeton_session_chiffre")
    }
}
