package bj.nakayo.testeur

import bj.nakayo.testeur.campagne.DetectionIntegrite
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

// US-28 : indices d'émulateur et de root.
class DetectionIntegriteTest {
    @Test
    fun `reconnaît les émulateurs courants et laisse passer un vrai téléphone`() {
        assertTrue(DetectionIntegrite.estEmulateur("google/sdk_gphone64_x86_64/emu64xa:14/UE1A/user/release-keys", "sdk_gphone64_x86_64", "ranchu", "sdk_gphone64_x86_64", "Google"))
        assertTrue(DetectionIntegrite.estEmulateur("generic/sdk/generic:8.0", "Android SDK built for x86", "goldfish", "sdk", "unknown"))
        assertTrue(DetectionIntegrite.estEmulateur("Genymotion/vbox86p", "Custom Phone", "vbox86", "vbox86p", "Genymotion"))
        assertFalse(DetectionIntegrite.estEmulateur("TECNO/KJ5-OP/TECNO-KJ5:13/TP1A/release-keys", "TECNO KJ5", "mt6768", "KJ5-OP", "TECNO"))
        assertFalse(DetectionIntegrite.estEmulateur(null, null, null, null, null))
    }

    @Test
    fun `root, clés de test ou binaire su`() {
        assertTrue(DetectionIntegrite.estRoote("test-keys") { false })
        assertTrue(DetectionIntegrite.estRoote("release-keys") { it == "/system/xbin/su" })
        assertFalse(DetectionIntegrite.estRoote("release-keys") { false })
    }
}
