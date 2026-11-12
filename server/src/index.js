import { creerApp } from './app.js'
import { lireConfig } from './config.js'
import { demarrerVerificationNocturne } from './services/verificationQuotidienne.js'
import { demarrerVersements } from './services/versements.js'
import { demarrerRappelsSms } from './services/rappelsSoir.js'

const { port } = lireConfig()

const app = creerApp()
app.listen(port, () => {
  console.log(`API Nakayo démarrée sur http://localhost:${port}`)
})
// US-20 : vérification des journées de test chaque nuit, à minuit heure du Bénin.
demarrerVerificationNocturne(app.locals.deps)
// US-22 : versements MoMo aux testeurs, toutes les 15 minutes.
demarrerVersements(app.locals.deps)
// US-25 : SMS de secours à 22 h quand un rapport du jour manque.
if (app.locals.deps.config.rappelsSms) demarrerRappelsSms(app.locals.deps)
