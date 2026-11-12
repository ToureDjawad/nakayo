import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { APP, cookieSession, creerUtilisateur } from '../fabriques.js'
import { creerAppTest, pool, viderBase } from '../outils.js'

let test
let dev
let admin
let appId

async function connecter(email) {
  return cookieSession(await request(test.app).post('/api/auth/connexion').send({ email, motDePasse: 'motdepasse-valide' }))
}

// App soumise puis payée par carte (simulation) : elle arrive dans la file de vérification.
async function appPayee(corps = APP) {
  const id = (await request(test.app).post('/api/apps').set('Cookie', dev).send(corps)).body.app.id
  const { reference } = (await request(test.app).post(`/api/apps/${id}/paiements`).set('Cookie', dev).send({ moyen: 'carte' })).body.paiement
  await request(test.app).post(`/api/paiements/${reference}/simulation`).set('Cookie', dev).send({ resultat: 'reussi' })
  return id
}

const enAdmin = (methode, chemin, cookie = admin) => request(test.app)[methode](chemin).set('Cookie', cookie)

beforeEach(async () => {
  await viderBase()
  test = creerAppTest({ maintenant: '2026-11-12T09:00:00Z' })
  await creerUtilisateur({ email: 'awa@studio.bj', nom: 'Studio Awa', statut: 'valide' })
  await creerUtilisateur({ email: 'admin@nakayo.bj', nom: 'Équipe Nakayo', role: 'admin', statut: 'valide' })
  dev = await connecter('awa@studio.bj')
  admin = await connecter('admin@nakayo.bj')
  appId = await appPayee()
})

describe('file de vérification des apps (US-14)', () => {
  it('liste les apps payées avec le développeur et le paiement ; les brouillons n’y sont pas', async () => {
    const autre = { ...APP, package: 'bj.studioawa.brouillon', lienTestFerme: 'https://play.google.com/apps/testing/bj.studioawa.brouillon' }
    await request(test.app).post('/api/apps').set('Cookie', dev).send(autre)
    const r = await enAdmin('get', '/api/admin/apps')
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ total: 1, page: 1, parPage: 20 })
    expect(r.body.apps[0]).toMatchObject({
      id: appId,
      nom: 'Marché Facile',
      statut: 'en_verification',
      lienTestFerme: APP.lienTestFerme,
      developpeur: { nom: 'Studio Awa', email: 'awa@studio.bj' },
      paiement: { statut: 'reussi', montantLisible: '29,00 $ US', facture: 'NKY-2026-00001' },
    })
  })

  it('filtres invalides : 422 ; brouillon ou id inconnu : 404', async () => {
    expect((await enAdmin('get', '/api/admin/apps?statut=brouillon')).body.erreur.champs).toEqual({ statut: 'valeur_inconnue' })
    expect((await enAdmin('get', '/api/admin/apps?parPage=99')).body.erreur.champs).toEqual({ parPage: 'format_invalide' })
    const brouillon = (
      await request(test.app)
        .post('/api/apps')
        .set('Cookie', dev)
        .send({ ...APP, package: 'bj.studioawa.b', lienTestFerme: 'https://play.google.com/apps/testing/bj.studioawa.b' })
    ).body.app.id
    expect((await enAdmin('get', `/api/admin/apps/${brouillon}`)).status).toBe(404)
    expect((await enAdmin('get', '/api/admin/apps/abc')).status).toBe(404)
  })

  it('réservée aux admins', async () => {
    expect((await enAdmin('get', '/api/admin/apps', dev)).status).toBe(403)
    expect((await request(test.app).get('/api/admin/apps')).status).toBe(401)
  })

  it('valider : l’app passe en « validee », l’historique garde la décision et le développeur est prévenu', async () => {
    test.avancer(60 * 60 * 1000)
    const r = await enAdmin('post', `/api/admin/apps/${appId}/validation`)
    expect(r.status).toBe(200)
    expect(r.body.app).toMatchObject({ statut: 'validee', motifRefus: null, decideLe: '2026-11-12T10:00:00.000Z' })
    expect(r.body.historique).toEqual([{ decision: 'validee', motif: null, admin: 'Équipe Nakayo', creeLe: '2026-11-12T10:00:00.000Z' }])
    const email = test.emails.dernierPour('awa@studio.bj')
    expect(email.sujet).toBe('Votre app « Marché Facile » est validée')

    expect((await enAdmin('get', '/api/admin/apps')).body.total).toBe(0)
    expect((await enAdmin('get', '/api/admin/apps?statut=validee')).body.apps[0].id).toBe(appId)
  })

  it('refuser : motif obligatoire, paiement remboursé, email avec le motif, package libéré', async () => {
    expect((await enAdmin('post', `/api/admin/apps/${appId}/refus`).send({ motif: 'non' })).body.erreur.champs).toEqual({ motif: 'trop_court' })
    const motif = 'Le lien du test fermé ne s’ouvre pas : vérifiez que le test est publié.'
    const r = await enAdmin('post', `/api/admin/apps/${appId}/refus`).send({ motif })
    expect(r.status).toBe(200)
    expect(r.body.app).toMatchObject({ statut: 'refusee', motifRefus: motif, paiement: { statut: 'rembourse', rembourseLe: '2026-11-12T09:00:00.000Z' } })

    const email = test.emails.dernierPour('awa@studio.bj')
    expect(email.sujet).toBe('Votre app « Marché Facile » n’a pas été acceptée')
    expect(email.texte).toContain(`Motif : ${motif}`)
    expect(email.texte).toContain('29,00 $ US vous est remboursé')

    // Côté développeur : l'app refusée montre le motif, le paiement est remboursé.
    expect((await request(test.app).get(`/api/apps/${appId}`).set('Cookie', dev)).body.app).toMatchObject({ statut: 'refusee', motifRefus: motif })
    const paiements = (await request(test.app).get('/api/paiements').set('Cookie', dev)).body.paiements
    expect(paiements[0]).toMatchObject({ statut: 'rembourse', facture: 'NKY-2026-00001' })

    // Le package peut être soumis à nouveau.
    expect((await request(test.app).post('/api/apps').set('Cookie', dev).send(APP)).status).toBe(201)
  })

  it('une app déjà traitée répond 409 statut_incompatible', async () => {
    await enAdmin('post', `/api/admin/apps/${appId}/validation`)
    const r = await enAdmin('post', `/api/admin/apps/${appId}/refus`).send({ motif: 'Un motif suffisamment long.' })
    expect(r.status).toBe(409)
    expect(r.body.erreur).toMatchObject({ code: 'statut_incompatible', statut: 'validee' })
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM decisions_apps')
    expect(rows[0].n).toBe(1)
  })

  it('la facture d’un paiement remboursé porte la mention', async () => {
    await enAdmin('post', `/api/admin/apps/${appId}/refus`).send({ motif: 'Application interdite par nos conditions.' })
    const r = await enAdmin('get', '/api/factures/NKY-2026-00001').buffer(true).parse((res, fin) => {
      const morceaux = []
      res.on('data', (m) => morceaux.push(m))
      res.on('end', () => fin(null, Buffer.concat(morceaux)))
    })
    expect(r.body.toString('latin1')).toContain('Rembours')
  })
})
