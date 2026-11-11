import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { creerApp } from '../src/app.js'
import { pool } from '../src/db/pool.js'
import { creerMessagerieJournal } from '../src/services/messagerie.js'

const silencieux = { info() {}, log() {}, warn() {}, error() {} }

// Vide toutes les tables (sauf l'historique des migrations) entre deux tests.
export async function viderBase() {
  const { rows } = await pool.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations'",
  )
  if (rows.length) {
    await pool.query(`TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`)
  }
}

// Application de test : messageries en mémoire, horloge réglable, journal muet.
export function creerAppTest({ maintenant, journal = silencieux, config } = {}) {
  const emails = creerMessagerieJournal({ canal: 'email', journal: silencieux })
  const sms = creerMessagerieJournal({ canal: 'sms', journal: silencieux })
  const horloge = { date: maintenant ?? null }
  const app = creerApp({
    pool,
    emails,
    sms,
    journal,
    // Photos des testeurs dans un dossier temporaire propre à chaque application de test.
    config: { dossierDocuments: mkdtempSync(path.join(tmpdir(), 'nakayo-documents-')), ...config },
    maintenant: () => (horloge.date ? new Date(horloge.date) : new Date()),
  })
  return {
    app,
    dossierDocuments: app.locals.deps.config.dossierDocuments,
    emails,
    sms,
    // Avance l'horloge de l'application (ex. pour tester l'expiration d'un lien).
    avancer(ms) {
      horloge.date = new Date((horloge.date ? new Date(horloge.date) : new Date()).getTime() + ms)
    },
  }
}

export { pool }
