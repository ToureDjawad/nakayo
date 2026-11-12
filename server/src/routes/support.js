import { Router } from 'express'
import { lireSupportPublic } from '../services/support.js'

// §11.1 Contact du support, sans connexion : l'app Android et le site l'affichent.
export function routesSupport({ pool }) {
  const routeur = Router()
  routeur.get('/', async (_req, res) => {
    res.set('Cache-Control', 'public, max-age=60')
    res.json({ support: await lireSupportPublic(pool) })
  })
  return routeur
}
