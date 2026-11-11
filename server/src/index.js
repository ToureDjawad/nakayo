import { creerApp } from './app.js'
import { lireConfig } from './config.js'

const { port } = lireConfig()

creerApp().listen(port, () => {
  console.log(`API Nakayo démarrée sur http://localhost:${port}`)
})
