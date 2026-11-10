import { Router } from 'express'
import { pool } from '../db/pool.js'

export const health = Router()

health.get('/', async (_req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ api: 'ok', base: 'ok' })
  } catch {
    res.status(503).json({ api: 'ok', base: 'injoignable' })
  }
})
