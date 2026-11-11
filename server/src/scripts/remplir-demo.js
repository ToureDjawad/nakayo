// Usage : npm run demo:remplir (depuis la racine)
// Crée les comptes de démonstration décrits dans le README. Refusé en production.
import { pool } from '../db/pool.js'
import { lireConfig } from '../config.js'
import { remplirDemo } from '../services/demo.js'

const config = lireConfig()
if (config.production) {
  console.error('Refusé : les comptes de démonstration ne sont pas autorisés en production.')
  process.exit(1)
}

try {
  const { comptes, testeurs } = await remplirDemo(pool, { dossierDocuments: config.dossierDocuments })
  console.log(`${comptes} comptes web et ${testeurs} testeurs de démonstration créés (identifiants dans le README).`)
} catch (erreur) {
  console.error(erreur.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
