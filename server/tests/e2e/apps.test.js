import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { creerAdmin } from '../../src/services/admins.js'
import { APP, creerUtilisateur } from '../fabriques.js'
import { pool, viderBase } from '../outils.js'
import { demarrerServeur } from './serveur.js'

describe('soumission d’une app sur le serveur réel', () => {
  let serveur
  let devId
  const appel = (chemin, { methode = 'GET', corps, cookie } = {}) =>
    fetch(`${serveur.url}${chemin}`, {
      method: methode,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: corps ? JSON.stringify(corps) : undefined,
    })
  async function connecter(email, motDePasse) {
    const r = await appel('/api/auth/connexion', { methode: 'POST', corps: { email, motDePasse } })
    return r.headers.getSetCookie()[0].split(';')[0]
  }

  beforeAll(async () => {
    await viderBase()
    await creerAdmin(pool, { email: 'admin@nakayo.bj', motDePasse: 'admin-nakayo-2026' })
    devId = String((await creerUtilisateur({ email: 'awa@studio.bj', nom: 'Studio Awa' })).id)
    serveur = await demarrerServeur({ CLIENT_URL: 'http://localhost:5173' })
  })
  afterAll(() => serveur?.arreter())

  it('le compte est validé par l’admin, puis le développeur soumet, corrige et retrouve son app', async () => {
    const dev = await connecter('awa@studio.bj', 'motdepasse-valide')
    expect((await appel('/api/apps', { methode: 'POST', corps: APP, cookie: dev })).status).toBe(403)

    const admin = await connecter('admin@nakayo.bj', 'admin-nakayo-2026')
    expect((await appel(`/api/admin/comptes/${devId}/validation`, { methode: 'POST', cookie: admin })).status).toBe(200)

    const envoi = await appel('/api/apps', { methode: 'POST', corps: APP, cookie: dev })
    expect(envoi.status).toBe(201)
    const { app } = await envoi.json()
    expect(app.statut).toBe('brouillon')

    const correction = await appel(`/api/apps/${app.id}`, {
      methode: 'PUT',
      corps: { ...APP, fonctionnalites: [...APP.fonctionnalites, 'Paiement Mobile Money'] },
      cookie: dev,
    })
    expect(correction.status).toBe(200)

    const { apps } = await (await appel('/api/apps', { cookie: dev })).json()
    expect(apps.map((a) => a.fonctionnalites.length)).toEqual([4])
  })
})
