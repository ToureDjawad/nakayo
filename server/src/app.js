import cors from 'cors'
import { creerGroupesDepuisConfig, creerSynchroGroupes } from './services/googleGroupes.js'
import express from 'express'
import { lireConfig } from './config.js'
import { pool as poolParDefaut } from './db/pool.js'
import { gestionnaireErreurs, introuvable } from './lib/erreurs.js'
import { creerLimitesApi } from './lib/limitesApi.js'
import { chargerSession } from './middlewares/authentification.js'
import { routesAdmin } from './routes/admin.js'
import { routesApps } from './routes/apps.js'
import { routesFactures, routesOffres, routesPaiements } from './routes/paiements.js'
import { routesAbonnement } from './routes/abonnement.js'
import { routesAuth } from './routes/auth.js'
import { routesInscription } from './routes/inscription.js'
import { routesSms } from './routes/sms.js'
import { routesSupport } from './routes/support.js'
import { routesTesteurApps } from './routes/testeurApps.js'
import { routesTesteurs } from './routes/testeurs.js'
import { routesTickets } from './routes/tickets.js'
import { routesVersements } from './routes/versements.js'
import { routesFedapay } from './routes/fedapay.js'
import { health } from './routes/health.js'
import { creerLanceurControles } from './services/controles.js'
import { creerMessagerieJournal } from './services/messagerie.js'
import { creerClientFedapay } from './services/fedapay.js'
import { creerMomo } from './services/momo.js'

const creerFedapay = (config) =>
  config.fedapay?.cleSecrete ? creerClientFedapay({ cleSecrete: config.fedapay.cleSecrete, environnement: config.fedapay.environnement }) : null

// Construit l'application. Les dépendances (base, envoi d'emails et de SMS, horloge)
// sont injectables pour les tests.
export function creerApp(dependances = {}) {
  const config = { ...lireConfig(), ...dependances.config }
  const deps = {
    config,
    pool: dependances.pool ?? poolParDefaut,
    emails: dependances.emails ?? creerMessagerieJournal({ canal: 'email' }),
    sms: dependances.sms ?? creerMessagerieJournal({ canal: 'sms' }),
    // Client FedaPay (encaissements et versements) ; null tant que la clé n'est pas configurée.
    fedapay: dependances.fedapay !== undefined ? dependances.fedapay : creerFedapay(config),
    maintenant: dependances.maintenant ?? (() => new Date()),
    journal: dependances.journal ?? console,
  }
  // Fournisseur des versements aux testeurs (US-22) ; null tant qu'aucun n'est branché.
  deps.momo = dependances.momo !== undefined ? dependances.momo : creerMomo(config, { fedapay: deps.fedapay })
  deps.limites = dependances.limites ?? creerLimitesApi(deps.maintenant)
  // US-43 : Groupes Google des campagnes ; null tant que Google Workspace n'est pas branché.
  deps.groupes = dependances.groupes !== undefined ? dependances.groupes : creerGroupesDepuisConfig(config)
  deps.synchroGroupes = creerSynchroGroupes(deps)
  deps.controles = creerLanceurControles({ ...deps, fetch: dependances.fetch })
  deps.apresInscription = (utilisateurId) => deps.controles.lancer(utilisateurId)

  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 'loopback')
  app.locals.deps = deps

  app.use(cors({ origin: config.clientUrl, credentials: true }))
  // Le corps brut est gardé pour vérifier la signature des webhooks de paiement.
  app.use(express.json({ limit: '100kb', verify: (req, _res, brut) => { req.corpsBrut = brut } }))

  app.use('/api/health', health(deps))
  app.use('/api', chargerSession(deps))
  app.use('/api/auth', routesAuth(deps))
  app.use('/api/auth', routesInscription(deps))
  app.use('/api/auth', routesSms(deps))
  app.use('/api/testeurs', routesTesteurs(deps))
  app.use('/api/testeurs/moi', routesTesteurApps(deps))
  app.use('/api/admin', routesAdmin(deps))
  app.use('/api/support', routesSupport(deps))
  app.use('/api/tickets', routesTickets(deps))
  app.use('/api/apps', routesApps(deps))
  app.use('/api/offres', routesOffres(deps))
  app.use('/api/paiements', routesPaiements(deps))
  app.use('/api/abonnement', routesAbonnement(deps))
  app.use('/api/factures', routesFactures(deps))
  app.use('/api/versements', routesVersements(deps))
  app.use('/api/fedapay', routesFedapay(deps))

  app.use((_req, _res, next) => next(introuvable('Route introuvable')))
  app.use(gestionnaireErreurs(deps.journal))
  return app
}
