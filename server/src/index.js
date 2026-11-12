import { creerApp } from './app.js'
import { lireConfig } from './config.js'
import { demarrerVerificationNocturne } from './services/verificationQuotidienne.js'

const { port } = lireConfig()

const app = creerApp()
app.listen(port, () => {
  console.log(`API Nakayo démarrée sur http://localhost:${port}`)
})
// US-20 : vérification des journées de test chaque nuit, à minuit heure du Bénin.
demarrerVerificationNocturne(app.locals.deps)
