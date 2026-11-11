package bj.nakayo.testeur

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope

// Portée des modèles dans les tests : même horloge virtuelle que le test, et (contrairement à
// porteeTest()) prise en compte par advanceUntilIdle(). Pas rattachée au test : les écrans
// laissés ouverts ne le bloquent pas à la fin.
fun TestScope.porteeTest(): CoroutineScope = CoroutineScope(StandardTestDispatcher(testScheduler))
