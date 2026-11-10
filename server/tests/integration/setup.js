// Les tests d'intégration utilisent une vraie base PostgreSQL dédiée aux tests.
// Ils ne tournent jamais sur la base de développement.
import { existsSync } from 'node:fs'

if (existsSync('.env')) process.loadEnvFile('.env')

if (!process.env.DATABASE_URL_TEST) {
  throw new Error('DATABASE_URL_TEST est requis pour les tests d\'intégration (voir server/.env.example).')
}
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST
