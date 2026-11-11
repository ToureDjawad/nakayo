import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'

const racine = fileURLToPath(new URL('../../', import.meta.url))

// Démarre le vrai serveur (node src/index.js) sur un port libre, comme en production.
export async function demarrerServeur(env = {}) {
  const port = 4400 + Math.floor(Math.random() * 500)
  const journal = []
  const processus = spawn(process.execPath, ['src/index.js'], {
    cwd: racine,
    env: { ...process.env, PORT: String(port), NODE_ENV: 'test', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  processus.stdout.on('data', (d) => journal.push(String(d)))
  processus.stderr.on('data', (d) => journal.push(String(d)))

  const url = `http://127.0.0.1:${port}`
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`${url}/api/health`)
      if (r.ok) break
    } catch {
      // pas encore prêt
    }
    if (processus.exitCode !== null) throw new Error(`Le serveur s'est arrêté :\n${journal.join('')}`)
    await new Promise((r) => setTimeout(r, 100))
  }

  return {
    url,
    journal,
    // Lit dans le journal du serveur le dernier lien envoyé par email ou SMS.
    dernier(motif) {
      const texte = journal.join('')
      const trouves = [...texte.matchAll(motif)]
      return trouves.length ? trouves.at(-1) : null
    },
    async arreter() {
      if (processus.exitCode !== null) return
      processus.kill('SIGTERM')
      await once(processus, 'exit')
    },
  }
}
