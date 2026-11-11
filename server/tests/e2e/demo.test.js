import { spawnSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MOT_DE_PASSE_DEMO } from '../../src/services/demo.js'
import { pool, viderBase } from '../outils.js'
import { demarrerServeur } from './serveur.js'

const racine = fileURLToPath(new URL('../../', import.meta.url))
const lancerScript = (env) =>
  spawnSync(process.execPath, ['src/scripts/remplir-demo.js'], {
    cwd: racine,
    env: { ...process.env, ...env },
    encoding: 'utf8',
  })

describe('script npm run demo:remplir puis serveur réel', () => {
  const documents = mkdtempSync(path.join(tmpdir(), 'nakayo-demo-'))
  let serveur

  beforeAll(async () => {
    await viderBase()
  })
  afterAll(() => serveur?.arreter())

  it('refuse de tourner en production', async () => {
    const resultat = lancerScript({ NODE_ENV: 'production', DOSSIER_DOCUMENTS: documents })
    expect(resultat.status).toBe(1)
    expect(resultat.stderr).toMatch(/production/)
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM utilisateurs')
    expect(rows[0].n).toBe(0)
  })

  it('remplit la base, puis l’admin de démo se connecte et voit les photos', async () => {
    const resultat = lancerScript({ NODE_ENV: 'test', DOSSIER_DOCUMENTS: documents })
    expect(resultat.status, resultat.stderr).toBe(0)
    expect(resultat.stdout).toMatch(/de démonstration créés/)

    serveur = await demarrerServeur({ DOSSIER_DOCUMENTS: documents })
    const connexion = await fetch(`${serveur.url}/api/auth/connexion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@nakayo.test', motDePasse: MOT_DE_PASSE_DEMO }),
    })
    expect(connexion.status).toBe(200)
    const cookie = connexion.headers.getSetCookie()[0].split(';')[0]

    const liste = await (await fetch(`${serveur.url}/api/admin/comptes?role=testeur`, { headers: { Cookie: cookie } })).json()
    expect(liste.comptes.length).toBeGreaterThan(0)
    const photo = await fetch(`${serveur.url}/api/admin/comptes/${liste.comptes[0].id}/documents/piece-identite`, {
      headers: { Cookie: cookie },
    })
    expect(photo.status).toBe(200)
    expect(photo.headers.get('content-type')).toMatch(/image\/png/)
  })
})
