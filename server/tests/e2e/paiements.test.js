import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { signer } from '../../src/services/paiements.js'
import { APP, creerUtilisateur } from '../fabriques.js'
import { viderBase } from '../outils.js'
import { demarrerServeur } from './serveur.js'

describe('paiement d’une app sur le serveur réel', () => {
  let serveur
  const appel = (chemin, { methode = 'GET', corps, cookie, entetes = {} } = {}) =>
    fetch(`${serveur.url}${chemin}`, {
      method: methode,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...entetes },
      body: typeof corps === 'string' ? corps : corps ? JSON.stringify(corps) : undefined,
    })

  beforeAll(async () => {
    await viderBase()
    await creerUtilisateur({ email: 'awa@studio.bj', nom: 'Studio Awa', statut: 'valide' })
    serveur = await demarrerServeur({ CLIENT_URL: 'http://localhost:5173', PAIEMENT_WEBHOOK_SECRET: 'secret-e2e' })
  })
  afterAll(() => serveur?.arreter())

  it('le développeur paie par Mobile Money, le webhook confirme, la facture se télécharge', async () => {
    const connexion = await appel('/api/auth/connexion', { methode: 'POST', corps: { email: 'awa@studio.bj', motDePasse: 'motdepasse-valide' } })
    const dev = connexion.headers.getSetCookie()[0].split(';')[0]
    const { app } = await (await appel('/api/apps', { methode: 'POST', corps: APP, cookie: dev })).json()

    const envoi = await appel(`/api/apps/${app.id}/paiements`, { methode: 'POST', corps: { moyen: 'mobile_money', numeroMomo: '+2290197000000' }, cookie: dev })
    expect(envoi.status).toBe(201)
    const { paiement } = await envoi.json()

    const brut = JSON.stringify({ reference: paiement.reference, statut: 'reussi', referenceFournisseur: 'AGR-1' })
    const webhook = await appel('/api/paiements/webhook/agregateur', { methode: 'POST', corps: brut, entetes: { 'X-Nakayo-Signature': `sha256=${signer(brut, 'secret-e2e')}` } })
    expect(webhook.status).toBe(200)

    const { paiements } = await (await appel('/api/paiements', { cookie: dev })).json()
    expect(paiements[0]).toMatchObject({ statut: 'reussi', facture: expect.stringMatching(/^NKY-\d{4}-00001$/) })
    const pdf = await appel(`/api/factures/${paiements[0].facture}`, { cookie: dev })
    expect(pdf.headers.get('content-type')).toBe('application/pdf')
    expect(Buffer.from(await pdf.arrayBuffer()).subarray(0, 8).toString()).toBe('%PDF-1.4')
    expect(serveur.journal.join('')).toContain('Reçu de paiement Nakayo')
  })
})
