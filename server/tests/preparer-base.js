import pg from 'pg'
import { appliquerMigrations } from '../src/db/migrations.js'

// Repart d'un schéma vide puis applique toutes les migrations, une fois par lancement.
export default async function preparer() {
  const url = process.env.DATABASE_URL_TEST ?? 'postgres://nakayo:nakayo@localhost:5433/nakayo_test'
  if (!/test/.test(new URL(url).pathname)) {
    throw new Error(`Refus de vider ${url} : le nom de la base de test doit contenir « test ».`)
  }
  const pool = new pg.Pool({ connectionString: url })
  try {
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
    await appliquerMigrations(pool, { log() {} })
  } finally {
    await pool.end()
  }
}
