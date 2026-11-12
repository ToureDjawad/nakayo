import { Router } from 'express'
import { corps, exigerChamps } from '../lib/validation.js'
import { exigerRole } from '../middlewares/authentification.js'
import { creerTicket, lireTicket, listerTicketsUtilisateur } from '../services/tickets.js'

// §12.1 Messages au support, depuis l'espace développeur (cookie) ou l'app testeur (Bearer).
export function routesTickets({ pool, limites, maintenant }) {
  const routeur = Router()
  routeur.use(exigerRole('developpeur', 'testeur'))

  routeur.post('/', async (req, res) => {
    const { valeurs, erreurs } = lireTicket(corps(req))
    exigerChamps(erreurs)
    const utilisateurId = req.session.utilisateur.id
    limites.tickets.consommer(String(utilisateurId))
    const ticket = await creerTicket(pool, { utilisateurId, ...valeurs, maintenant: maintenant() })
    res.status(201).json({ ticket })
  })

  routeur.get('/moi', async (req, res) => {
    res.json({ tickets: await listerTicketsUtilisateur(pool, req.session.utilisateur.id) })
  })

  return routeur
}
