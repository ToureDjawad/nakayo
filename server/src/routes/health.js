import { Router } from 'express'

export function health({ pool }) {
  const routeur = Router()
  routeur.get('/', async (_req, res) => {
    try {
      await pool.query('SELECT 1')
      res.json({ api: 'ok', base: 'ok' })
    } catch {
      res.status(503).json({ api: 'ok', base: 'injoignable' })
    }
  })
  return routeur
}
