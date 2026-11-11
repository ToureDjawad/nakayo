package bj.nakayo.testeur

import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

// Bout en bout : l'app lancée sur l'émulateur interroge le vrai serveur de la machine (10.0.2.2:3000).
// En CI, le serveur est démarré avant les tests (voir .github/workflows/ci.yml).
@RunWith(AndroidJUnit4::class)
class AccueilApiReelleTest {
    @get:Rule
    val compose = createAndroidComposeRule<MainActivity>()

    @Test
    fun lAppJointLeVraiServeur() {
        compose.waitUntil(timeoutMillis = 15_000) {
            compose.onAllNodes(hasText("J'ai déjà un compte")).fetchSemanticsNodes().isNotEmpty()
        }
        compose.onNodeWithText("J'ai déjà un compte").assertExists()
    }
}
