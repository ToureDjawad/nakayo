import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

vi.mock('../../src/db/pool.js', () => ({
  pool: { query: vi.fn() },
}))

const { pool } = await import('../../src/db/pool.js')
const { app } = await import('../../src/app.js')

describe('GET /api/health', () => {
  beforeEach(() => {
    pool.query.mockReset()
  })

  it('répond ok quand la base répond', async () => {
    pool.query.mockResolvedValue({ rows: [{ '?column?': 1 }] })
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ api: 'ok', base: 'ok' })
  })

  it('répond 503 quand la base est injoignable', async () => {
    pool.query.mockRejectedValue(new Error('connexion refusée'))
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(503)
    expect(res.body).toEqual({ api: 'ok', base: 'injoignable' })
  })
})

describe('route inconnue', () => {
  it('répond 404 en JSON', async () => {
    const res = await request(app).get('/api/nexiste-pas')
    expect(res.status).toBe(404)
    expect(res.body.erreur).toBe('Route introuvable')
  })
})
