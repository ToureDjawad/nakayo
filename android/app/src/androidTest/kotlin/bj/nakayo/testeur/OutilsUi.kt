package bj.nakayo.testeur

import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.test.platform.app.InstrumentationRegistry
import bj.nakayo.noyau.ServiceTesteur

// 30 s : l'émulateur de la CI rend l'interface en logiciel, le premier écran peut être lent.
fun ComposeTestRule.attendreTexte(texte: String, delaiMs: Long = 30_000) {
    waitUntil(delaiMs) { onAllNodes(hasText(texte, substring = true)).fetchSemanticsNodes().isNotEmpty() }
}

// Remplace le service de l'app par un faux avant de lancer l'activité ; à rétablir après le test.
fun remplacerService(service: ServiceTesteur?) {
    val application = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as NakayoApplication
    if (service == null) application.service = application.api else application.service = service
}
