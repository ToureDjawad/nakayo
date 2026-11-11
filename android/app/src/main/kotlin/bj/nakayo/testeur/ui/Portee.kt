package bj.nakayo.testeur.ui

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel

// Portée d'un écran : enfant de celle de l'app, annulée quand on quitte l'écran.
fun CoroutineScope.porteeEnfant(): CoroutineScope = CoroutineScope(coroutineContext + SupervisorJob(coroutineContext[Job]))

fun CoroutineScope.fermer() = cancel()
