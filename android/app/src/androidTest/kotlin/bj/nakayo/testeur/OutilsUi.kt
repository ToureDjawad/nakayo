package bj.nakayo.testeur

import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.test.platform.app.InstrumentationRegistry
import bj.nakayo.noyau.ServiceTesteur

fun ComposeTestRule.attendreTexte(texte: String, delaiMs: Long = 10_000) {
    waitUntil(delaiMs) { onAllNodes(hasText(texte, substring = true)).fetchSemanticsNodes().isNotEmpty() }
}

// Remplace le service de l'app par un faux avant de lancer l'activité ; à rétablir après le test.
fun remplacerService(service: ServiceTesteur?) {
    val application = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as NakayoApplication
    // Notifications des rappels du soir (US-25) accordées d'avance : la fenêtre d'Android bloquerait les tests.
    if (service != null && android.os.Build.VERSION.SDK_INT >= 33) {
        InstrumentationRegistry.getInstrumentation().uiAutomation
            .grantRuntimePermission(application.packageName, "android.permission.POST_NOTIFICATIONS")
    }
    if (service == null) application.service = application.api else application.service = service
}
