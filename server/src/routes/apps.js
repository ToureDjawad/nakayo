import { Router } from 'express'
import { lireApp } from '../lib/apps.js'
import { ErreurHttp, introuvable } from '../lib/erreurs.js'
import { corps, exigerChamps } from '../lib/validation.js'
import { exigerRole } from '../middlewares/authentification.js'
import { creerApp, lireAppDeveloppeur, listerAppsDeveloppeur, modifierApp, supprimerApp, versAppApi } from '../services/apps.js'

// Seul un compte validé par l'équipe peut soumettre ou modifier une app.
function exigerCompteValide(req, _res, next) {
  if (req.session.utilisateur.statut === 'valide') return next()
  next(new ErreurHttp(403, 'compte_non_valide', { message: 'Votre compte doit être validé pour soumettre une app.' }))
}

// Un identifiant non numérique ne peut correspondre à aucune app.
function idApp(req) {
  if (!/^\d{1,18}$/.test(req.params.id)) throw introuvable('App introuvable.')
  return req.params.id
}

function lireCorps(req) {
  const { valeurs, erreurs } = lireApp(corps(req))
  exigerChamps(erreurs)
  return valeurs
}

// docs/api-sprint2.md §1 : apps du développeur connecté (cookie du site).
export function routesApps({ pool, limites, maintenant }) {
  const routeur = Router()
  routeur.use(exigerRole('developpeur'))
  const developpeurId = (req) => req.session.utilisateur.id

  routeur.get('/', async (req, res) => {
    res.json({ apps: await listerAppsDeveloppeur(pool, developpeurId(req)) })
  })

  routeur.post('/', exigerCompteValide, async (req, res) => {
    const valeurs = lireCorps(req)
    limites.apps.consommer(String(developpeurId(req)))
    const app = await creerApp(pool, { developpeurId: developpeurId(req), valeurs, maintenant: maintenant() })
    res.status(201).json({ app })
  })

  routeur.get('/:id', async (req, res) => {
    res.json({ app: versAppApi(await lireAppDeveloppeur(pool, { id: idApp(req), developpeurId: developpeurId(req) })) })
  })

  routeur.put('/:id', exigerCompteValide, async (req, res) => {
    const id = idApp(req)
    const valeurs = lireCorps(req)
    res.json({ app: await modifierApp(pool, { id, developpeurId: developpeurId(req), valeurs, maintenant: maintenant() }) })
  })

  routeur.delete('/:id', async (req, res) => {
    await supprimerApp(pool, { id: idApp(req), developpeurId: developpeurId(req) })
    res.status(204).end()
  })

  return routeur
}
