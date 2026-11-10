import express from 'express'
import cors from 'cors'
import { health } from './routes/health.js'

export const app = express()

app.use(cors({ origin: process.env.CLIENT_URL ?? 'http://localhost:5173' }))
app.use(express.json())

app.use('/api/health', health)

app.use((_req, res) => {
  res.status(404).json({ erreur: 'Route introuvable' })
})
