package bj.nakayo.testeur

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.ExifInterface
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import bj.nakayo.testeur.photo.CompressionPhoto
import org.junit.Test
import org.junit.runner.RunWith
import java.io.ByteArrayInputStream
import java.io.File
import kotlin.random.Random
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

@RunWith(AndroidJUnit4::class)
class CompressionPhotoTest {
    private val contexte = InstrumentationRegistry.getInstrumentation().targetContext

    @Test
    fun photoReduiteRedresseeEtSansMetadonnees() {
        // Image bruitée (la pire à compresser), prise « couchée » avec une position GPS.
        val largeur = 3000
        val hauteur = 2000
        val pixels = IntArray(largeur * hauteur) { Random.nextInt() or (0xFF shl 24) }
        val image = Bitmap.createBitmap(pixels, largeur, hauteur, Bitmap.Config.ARGB_8888)
        val fichier = File.createTempFile("test", ".jpg", contexte.cacheDir)
        fichier.outputStream().use { image.compress(Bitmap.CompressFormat.JPEG, 95, it) }
        image.recycle()
        ExifInterface(fichier.path).apply {
            setAttribute(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_ROTATE_90.toString())
            setAttribute(ExifInterface.TAG_GPS_LATITUDE, "6/1,22/1,0/1")
            setAttribute(ExifInterface.TAG_GPS_LATITUDE_REF, "N")
            saveAttributes()
        }

        val octets = CompressionPhoto.preparer(fichier)
        fichier.delete()

        assertTrue(octets.size <= CompressionPhoto.CIBLE_OCTETS, "taille ${octets.size}")
        assertEquals(0xFF.toByte(), octets[0])
        assertEquals(0xD8.toByte(), octets[1])
        val bornes = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(octets, 0, octets.size, bornes)
        assertTrue(bornes.outHeight > bornes.outWidth, "photo remise à l'endroit")
        assertTrue(maxOf(bornes.outWidth, bornes.outHeight) <= CompressionPhoto.COTE_MAX)
        assertNull(ExifInterface(ByteArrayInputStream(octets)).getAttribute(ExifInterface.TAG_GPS_LATITUDE))
    }

    @Test(expected = IllegalArgumentException::class)
    fun fichierQuiNEstPasUneImage() {
        val fichier = File.createTempFile("test", ".jpg", contexte.cacheDir).apply { writeText("pas une image") }
        try {
            CompressionPhoto.preparer(fichier)
        } finally {
            fichier.delete()
        }
    }
}
