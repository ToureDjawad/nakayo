import { Router } from 'express'
import { ErreurHttp } from '../lib/erreurs.js'
import { statutPaiement, statutVersement, webhookFedapayValide } from '../services/fedapay.js'
import { referenceDepuisFournisseur } from '../services/paiements.js'
import { appliquerIssue, prevenir, referenceVersementDepuisFournisseur } from '../services/versements.js'
import { transaction } from './auth.js'
import { creerConfirmation } from './paiements.js'

// docs/fedapay.md §3 : webhook FedaPay (transactions des développeurs, payouts des testeurs).
// Signé avec l'en-tête X-FEDAPAY-SIGNATURE ; FedaPay renvoie l'évènement tant qu'il n'a pas de 2xx.
export function routesFedapay(deps) {
  const { pool, config, maintenant, journal } = deps
  const confirmer = creerConfirmation(deps)
  const routeur = Router()

  routeur.post('/webhook', async (req, res) => {
    if (!webhookFedapayValide(req.corpsBrut, req.get('X-FEDAPAY-SIGNATURE'), config.fedapay?.secretWebhook, maintenant())) {
      throw new ErreurHttp(401, 'signature_invalide', { message: 'Signature du webhook invalide.' })
    }
    const evenement = req.body ?? {}
    const nom = typeof evenement.name === 'string' ? evenement.name : ''
    const entite = evenement.entity ?? evenement.object_data ?? {}
    const idFournisseur = entite.id != null ? String(entite.id) : null
    const notreReference = typeof entite.merchant_reference === 'string' ? entite.merchant_reference : entite.custom_metadata?.reference

    if (nom.startsWith('transaction.')) {
      const statut = statutPaiement(entite.status)
      const reference =
        (typeof notreReference === 'string' && notreReference.startsWith('PAY-') ? notreReference : null) ??
        (idFournisseur && (await referenceDepuisFournisseur(pool, { fournisseur: 'fedapay', referenceFournisseur: idFournisseur })))
      // Évènement sans issue (création, mise à jour) ou transaction étrangère à Nakayo : rien à faire.
      if (!statut || !reference) return res.json({ recu: true })
      const paiement = await confirmer({ reference, statut, referenceFournisseur: idFournisseur })
      return res.json({ recu: true, statut: paiement.statut })
    }

    if (nom.startsWith('payout.')) {
      const statut = statutVersement(entite.status)
      const reference =
        (typeof notreReference === 'string' && notreReference.startsWith('VER-') ? notreReference : null) ??
        (idFournisseur && (await referenceVersementDepuisFournisseur(pool, idFournisseur)))
      if (statut === 'en_cours' || !reference) return res.json({ recu: true })
      const issue = await transaction(pool, (client) =>
        appliquerIssue(client, {
          reference,
          statut,
          referenceFournisseur: idFournisseur,
          motif: typeof entite.last_error_code === 'string' ? entite.last_error_code.toLowerCase().slice(0, 200) : null,
          maintenant: maintenant(),
        }),
      )
      await prevenir(deps, issue)
      return res.json({ recu: true, statut: issue.versement.statut })
    }

    journal.info?.(`Webhook FedaPay ignoré : ${nom || 'sans nom'}`)
    res.json({ recu: true })
  })

  return routeur
}
