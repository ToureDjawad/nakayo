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
    if (service == null) application.service = application.api else application.service = service
}
