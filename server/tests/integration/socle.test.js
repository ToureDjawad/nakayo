import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { creerAppTest, pool } from '../outils.js'

describe('socle de l’API', () => {
  const { app } = creerAppTest()

  it('répond sur /api/health avec la base', async () => {
    const r = await request(app).get('/api/health')
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ api: 'ok', base: 'ok' })
  })

  it('renvoie une 404 au format du contrat', async () => {
    const r = await request(app).get('/api/nexiste-pas')
    expect(r.status).toBe(404)
    expect(r.body).toEqual({ erreur: { code: 'introuvable', message: 'Route introuvable' } })
  })

  it('refuse un JSON illisible avec 400 json_invalide', async () => {
    const r = await request(app).post('/api/nexiste-pas').set('Content-Type', 'application/json').send('{pas du json')
    expect(r.status).toBe(400)
    expect(r.body.erreur.code).toBe('json_invalide')
  })

  it('autorise le front avec les cookies (CORS)', async () => {
    const r = await request(app).get('/api/health').set('Origin', 'http://localhost:5173')
    expect(r.headers['access-control-allow-origin']).toBe('http://localhost:5173')
    expect(r.headers['access-control-allow-credentials']).toBe('true')
    expect(r.headers['x-powered-by']).toBeUndefined()
  })

  it('a appliqué les migrations', async () => {
    const { rows } = await pool.query('SELECT nom FROM schema_migrations ORDER BY nom')
    expect(rows.map((r) => r.nom)[0]).toBe('001_init.sql')
  })
})
