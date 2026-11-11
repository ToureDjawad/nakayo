import cors from 'cors'
import express from 'express'
import { lireConfig } from './config.js'
import { pool as poolParDefaut } from './db/pool.js'
import { gestionnaireErreurs, introuvable } from './lib/erreurs.js'
import { health } from './routes/health.js'
import { creerMessagerieJournal } from './services/messagerie.js'

// Construit l'application. Les dépendances (base, envoi d'emails et de SMS, horloge)
// sont injectables pour les tests.
export function creerApp(dependances = {}) {
  const config = { ...lireConfig(), ...dependances.config }
  const deps = {
    config,
    pool: dependances.pool ?? poolParDefaut,
    emails: dependances.emails ?? creerMessagerieJournal({ canal: 'email' }),
    sms: dependances.sms ?? creerMessagerieJournal({ canal: 'sms' }),
    maintenant: dependances.maintenant ?? (() => new Date()),
    journal: dependances.journal ?? console,
  }

  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 'loopback')
  app.locals.deps = deps

  app.use(cors({ origin: config.clientUrl, credentials: true }))
  app.use(express.json({ limit: '100kb' }))

  app.use('/api/health', health(deps))

  app.use((_req, _res, next) => next(introuvable('Route introuvable')))
  app.use(gestionnaireErreurs(deps.journal))
  return app
}
