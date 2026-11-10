import { pool } from './pool.js'
import { appliquerMigrations } from './migrate.js'

try {
  await appliquerMigrations(pool)
} catch (err) {
  console.error(err.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
