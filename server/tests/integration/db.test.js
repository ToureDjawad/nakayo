import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { pool } from '../../src/db/pool.js'
import { appliquerMigrations } from '../../src/db/migrate.js'
import { app } from '../../src/app.js'

beforeAll(async () => {
  // Repart d'un schéma vide pour que chaque exécution soit reproductible.
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
  await appliquerMigrations(pool, { log: () => {} })
})

afterAll(async () => {
  await pool.end()
})

describe('migrations', () => {
  it('sont idempotentes', async () => {
    const deuxiemePassage = await appliquerMigrations(pool, { log: () => {} })
    expect(deuxiemePassage).toEqual([])
  })

  it('créent la table utilisateurs avec un statut en_attente par défaut', async () => {
    const { rows } = await pool.query(
      `INSERT INTO utilisateurs (email, mot_de_passe_hash, role)
       VALUES ('dev@exemple.test', 'hash', 'developpeur')
       RETURNING statut`,
    )
    expect(rows[0].statut).toBe('en_attente')
  })

  it('refusent deux comptes avec le même email', async () => {
    await expect(
      pool.query(
        `INSERT INTO utilisateurs (email, mot_de_passe_hash, role)
         VALUES ('dev@exemple.test', 'hash', 'testeur')`,
      ),
    ).rejects.toThrow(/duplicate key|unique/i)
  })
})

describe('GET /api/health avec la vraie base', () => {
  it('répond ok', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.base).toBe('ok')
  })
})
