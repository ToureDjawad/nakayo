import { Router } from 'express'
import { MOYENS_PAIEMENT } from '../lib/offres.js'
import { corps, exigerChamps } from '../lib/validation.js'
import { exigerRole } from '../middlewares/authentification.js'
import { creerPaiementAbonnement, etatAbonnement, offreAbonnement, versAbonnementApi } from '../services/abonnements.js'
import { normaliserWhatsapp, validerWhatsapp } from '../services/support.js'
import { transaction } from './auth.js'
import { fournisseurPaiement, redirectionPaiement } from './paiements.js'
import { ErreurHttp } from '../lib/erreurs.js'

// US-45 (docs/abonnement.md) : abonnement mensuel des agences et studios.
export function routesAbonnement(deps) {
  const { pool, config, maintenant, limites } = deps
  const routeur = Router()
  routeur.use(exigerRole('developpeur'))
  const developpeurId = (req) => req.session.utilisateur.id

  routeur.get('/', async (req, res) => {
    const etat = await etatAbonnement(pool, { developpeurId: developpeurId(req), maintenant: maintenant() })
    res.json({ abonnement: versAbonnementApi(etat), offre: offreAbonnement() })
  })

  // Souscription ou renouvellement d'un mois : le développeur valide le paiement chez FedaPay.
  routeur.post('/paiements', async (req, res) => {
    if (req.session.utilisateur.statut !== 'valide') {
      throw new ErreurHttp(403, 'compte_non_valide', { message: 'Votre compte doit être validé pour vous abonner.' })
    }
    const { fedapay, fcfa } = fournisseurPaiement({ config, fedapay: deps.fedapay })
    const { moyen, numeroMomo, telephoneRappels } = corps(req)
    const numero = moyen === 'mobile_money' ? normaliserWhatsapp(numeroMomo) : null
    const rappels = telephoneRappels ? normaliserWhatsapp(telephoneRappels) : null
    exigerChamps({
      moyen: !moyen ? 'requis' : MOYENS_PAIEMENT.includes(moyen) ? null : 'valeur_inconnue',
      numeroMomo: moyen === 'mobile_money' ? validerWhatsapp(numero) : null,
      telephoneRappels: rappels ? validerWhatsapp(rappels) : null,
    })
    limites.paiements.consommer(String(developpeurId(req)))
    const paiement = await transaction(pool, (client) =>
      creerPaiementAbonnement(client, {
        developpeurId: developpeurId(req),
        moyen,
        numeroMomo: numero,
        telephoneRappels: rappels,
        fournisseur: config.paiementMode,
        fcfa,
        maintenant: maintenant(),
      }),
    )
    res.status(201).json(
      await redirectionPaiement(deps, {
        fedapay,
        paiement,
        description: 'Nakayo · Abonnement Agence (1 mois)',
        client: { nom: req.session.utilisateur.nom, email: req.session.utilisateur.email, numero },
      }),
    )
  })

  return routeur
}
