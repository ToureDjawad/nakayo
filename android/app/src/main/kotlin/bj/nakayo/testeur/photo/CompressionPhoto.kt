package bj.nakayo.testeur.photo

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import java.io.ByteArrayOutputStream
import java.io.File
import kotlin.math.max
import kotlin.math.roundToInt

// Prépare une photo pour l'envoi sur données mobiles : 300 Ko environ, 1600 px au plus,
// remise à l'endroit. Le JPEG est réencodé : aucune métadonnée (position GPS, modèle...) ne part.
object CompressionPhoto {
    const val COTE_MAX = 1600
    const val CIBLE_OCTETS = 300 * 1024

    fun preparer(fichier: File): ByteArray {
        val bornes = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(fichier.path, bornes)
        require(bornes.outWidth > 0 && bornes.outHeight > 0) { "Image illisible" }

        var echantillon = 1
        while (max(bornes.outWidth, bornes.outHeight) / (echantillon * 2) >= COTE_MAX) echantillon *= 2
        val brute = BitmapFactory.decodeFile(fichier.path, BitmapFactory.Options().apply { inSampleSize = echantillon })
            ?: throw IllegalArgumentException("Image illisible")

        var image = redresser(brute, rotation(fichier))
        var cote = COTE_MAX
        while (true) {
            image = reduire(image, cote)
            for (qualite in intArrayOf(85, 75, 65, 55, 45)) {
                val octets = encoder(image, qualite)
                if (octets.size <= CIBLE_OCTETS) return octets.also { image.recycle() }
            }
            if (cote <= 640) return encoder(image, 45).also { image.recycle() }
            cote = (cote * 0.75).roundToInt()
        }
    }

    private fun rotation(fichier: File): Int = try {
        when (ExifInterface(fichier.path).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
            ExifInterface.ORIENTATION_ROTATE_90 -> 90
            ExifInterface.ORIENTATION_ROTATE_180 -> 180
            ExifInterface.ORIENTATION_ROTATE_270 -> 270
            else -> 0
        }
    } catch (_: java.io.IOException) {
        0
    }

    private fun redresser(image: Bitmap, degres: Int): Bitmap {
        if (degres == 0) return image
        val tournee = Bitmap.createBitmap(image, 0, 0, image.width, image.height, Matrix().apply { postRotate(degres.toFloat()) }, true)
        if (tournee !== image) image.recycle()
        return tournee
    }

    private fun reduire(image: Bitmap, cote: Int): Bitmap {
        val plusGrand = max(image.width, image.height)
        if (plusGrand <= cote) return image
        val facteur = cote.toFloat() / plusGrand
        val reduite = Bitmap.createScaledBitmap(image, (image.width * facteur).roundToInt(), (image.height * facteur).roundToInt(), true)
        if (reduite !== image) image.recycle()
        return reduite
    }

    private fun encoder(image: Bitmap, qualite: Int): ByteArray =
        ByteArrayOutputStream().use { sortie ->
            image.compress(Bitmap.CompressFormat.JPEG, qualite, sortie)
            sortie.toByteArray()
        }
}
