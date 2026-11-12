import cors from 'cors'
import express from 'express'
import { lireConfig } from './config.js'
import { pool as poolParDefaut } from './db/pool.js'
import { gestionnaireErreurs, introuvable } from './lib/erreurs.js'
import { creerLimitesApi } from './lib/limitesApi.js'
import { chargerSession } from './middlewares/authentification.js'
import { routesAdmin } from './routes/admin.js'
import { routesAuth } from './routes/auth.js'
import { routesInscription } from './routes/inscription.js'
import { routesSms } from './routes/sms.js'
import { routesSupport } from './routes/support.js'
import { routesTesteurs } from './routes/testeurs.js'
import { health } from './routes/health.js'
import { creerLanceurControles } from './services/controles.js'
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
  deps.limites = dependances.limites ?? creerLimitesApi(deps.maintenant)
  deps.controles = creerLanceurControles({ ...deps, fetch: dependances.fetch })
  deps.apresInscription = (utilisateurId) => deps.controles.lancer(utilisateurId)

  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 'loopback')
  app.locals.deps = deps

  app.use(cors({ origin: config.clientUrl, credentials: true }))
  app.use(express.json({ limit: '100kb' }))

  app.use('/api/health', health(deps))
  app.use('/api', chargerSession(deps))
  app.use('/api/auth', routesAuth(deps))
  app.use('/api/auth', routesInscription(deps))
  app.use('/api/auth', routesSms(deps))
  app.use('/api/testeurs', routesTesteurs(deps))
  app.use('/api/admin', routesAdmin(deps))
  app.use('/api/support', routesSupport(deps))

  app.use((_req, _res, next) => next(introuvable('Route introuvable')))
  app.use(gestionnaireErreurs(deps.journal))
  return app
}
