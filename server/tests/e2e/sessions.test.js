import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { pool, viderBase } from '../outils.js'
import { demarrerServeur } from './serveur.js'

const executer = promisify(execFile)
const racine = fileURLToPath(new URL('../../', import.meta.url))

function cookieDe(reponse) {
  return reponse.headers.getSetCookie().find((c) => c.startsWith('nakayo_session='))?.split(';')[0] ?? null
}

describe('parcours de connexion sur le serveur réel', () => {
  let serveur
  const appel = (chemin, { corps, cookie, methode = corps ? 'POST' : 'GET' } = {}) =>
    fetch(`${serveur.url}${chemin}`, {
      method: methode,
      headers: { ...(corps ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: corps ? JSON.stringify(corps) : undefined,
    })

  beforeAll(async () => {
    await viderBase()
    serveur = await demarrerServeur({ CLIENT_URL: 'http://localhost:5173' })
  })
  afterAll(async () => {
    await serveur?.arreter()
  })

  it('crée le premier admin avec le script npm run admin:creer', async () => {
    const { stdout } = await executer(process.execPath, ['src/scripts/creer-admin.js', '--email', 'admin@nakayo.bj'], {
      cwd: racine,
      env: { ...process.env, NAKAYO_ADMIN_MOT_DE_PASSE: 'admin-nakayo-2026' },
    })
    expect(stdout).toMatch(/Admin créé/)
    const { rows } = await pool.query("SELECT role, statut FROM utilisateurs WHERE email = 'admin@nakayo.bj'")
    expect(rows).toEqual([{ role: 'admin', statut: 'valide' }])
  })

  it('connecte l’admin, lit sa session puis le déconnecte', async () => {
    const connexion = await appel('/api/auth/connexion', {
      corps: { email: 'admin@nakayo.bj', motDePasse: 'admin-nakayo-2026' },
    })
    expect(connexion.status).toBe(200)
    const cookie = cookieDe(connexion)
    expect(cookie).toBeTruthy()

    const moi = await appel('/api/auth/moi', { cookie })
    expect((await moi.json()).utilisateur).toMatchObject({ role: 'admin', email: 'admin@nakayo.bj' })

    expect((await appel('/api/auth/deconnexion', { methode: 'POST', cookie })).status).toBe(204)
    expect((await appel('/api/auth/moi', { cookie })).status).toBe(401)
  })

  it('réinitialise le mot de passe avec le lien reçu par email', async () => {
    const oubli = await appel('/api/auth/mot-de-passe/oubli', { corps: { email: 'admin@nakayo.bj' } })
    expect(oubli.status).toBe(202)

    // En développement, les emails sont écrits dans le journal du serveur.
    let lien = null
    for (let i = 0; i < 20 && !lien; i++) {
      lien = serveur.dernier(/http:\/\/localhost:5173\/reinitialiser-mot-de-passe\?jeton=([A-Za-z0-9_-]+)/g)
      if (!lien) await new Promise((r) => setTimeout(r, 50))
    }
    expect(lien).not.toBeNull()

    const reinit = await appel('/api/auth/mot-de-passe/reinitialisation', {
      corps: { jeton: lien[1], motDePasse: 'nouvelle-phrase-admin' },
    })
    expect(reinit.status).toBe(204)

    const ancien = await appel('/api/auth/connexion', { corps: { email: 'admin@nakayo.bj', motDePasse: 'admin-nakayo-2026' } })
    expect((await ancien.json()).erreur.code).toBe('identifiants_invalides')
    const nouveau = await appel('/api/auth/connexion', {
      corps: { email: 'admin@nakayo.bj', motDePasse: 'nouvelle-phrase-admin' },
    })
    expect(nouveau.status).toBe(200)
  })
})
