import { Router } from 'express'
import { ErreurHttp } from '../lib/erreurs.js'
import { corps, texte } from '../lib/validation.js'
import { signatureValide } from '../services/paiements.js'
import { appliquerIssue, prevenir } from '../services/versements.js'
import { transaction } from './auth.js'

const ISSUES_WEBHOOK = ['verse', 'echoue']

// docs/api-sprint4.md §2.3 : confirmation tardive d'un versement par l'agrégateur.
export function routesVersements(deps) {
  const { pool, config, maintenant } = deps
  const routeur = Router()

  routeur.post('/webhook/:fournisseur', async (req, res) => {
    if (!signatureValide(req.corpsBrut, req.get('X-Nakayo-Signature'), config.paiementWebhookSecret)) {
      throw new ErreurHttp(401, 'signature_invalide', { message: 'Signature du webhook invalide.' })
    }
    const { reference, statut, referenceFournisseur, motif } = corps(req)
    if (typeof reference !== 'string' || !ISSUES_WEBHOOK.includes(statut)) {
      throw new ErreurHttp(400, 'corps_invalide', { message: 'Corps du webhook invalide.' })
    }
    const issue = await transaction(pool, (client) =>
      appliquerIssue(client, {
        reference,
        statut,
        referenceFournisseur: texte(referenceFournisseur) || null,
        motif: texte(motif)?.slice(0, 200) || null,
        maintenant: maintenant(),
      }),
    )
    await prevenir(deps, issue)
    res.json({ recu: true, statut: issue.versement.statut })
  })

  return routeur
}
