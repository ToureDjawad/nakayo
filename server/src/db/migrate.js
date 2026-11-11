import { appliquerMigrations } from './migrations.js'
import { pool } from './pool.js'

try {
  await appliquerMigrations(pool)
} catch (err) {
  console.error(err.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
