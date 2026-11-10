import { readdir, readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from './pool.js'

const dossier = join(dirname(fileURLToPath(import.meta.url)), '../../migrations')

await pool.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    nom TEXT PRIMARY KEY,
    appliquee_le TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`)

const { rows } = await pool.query('SELECT nom FROM schema_migrations')
const dejaFaites = new Set(rows.map((r) => r.nom))
const fichiers = (await readdir(dossier)).filter((f) => f.endsWith('.sql')).sort()

for (const fichier of fichiers) {
  if (dejaFaites.has(fichier)) continue
  const sql = await readFile(join(dossier, fichier), 'utf8')
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(sql)
    await client.query('INSERT INTO schema_migrations (nom) VALUES ($1)', [fichier])
    await client.query('COMMIT')
    console.log(`Migration appliquée : ${fichier}`)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(`Échec de la migration ${fichier} :`, err.message)
    process.exitCode = 1
    break
  } finally {
    client.release()
  }
}

await pool.end()
