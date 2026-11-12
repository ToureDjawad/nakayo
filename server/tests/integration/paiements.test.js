import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { signer } from '../../src/services/paiements.js'
import { APP, cookieSession, creerUtilisateur } from '../fabriques.js'
import { creerAppTest, pool, viderBase } from '../outils.js'

const SECRET = 'secret-webhook-developpement'
let test
let dev
let appId
beforeEach(async () => {
  await viderBase()
  test = creerAppTest({ maintenant: '2026-11-12T09:00:00Z' })
  await creerUtilisateur({ email: 'awa@studio.bj', nom: 'Studio Awa', statut: 'valide' })
  dev = await connecter('awa@studio.bj')
  appId = (await request(test.app).post('/api/apps').set('Cookie', dev).send(APP)).body.app.id
})

async function connecter(email) {
  return cookieSession(await request(test.app).post('/api/auth/connexion').send({ email, motDePasse: 'motdepasse-valide' }))
}
const payer = (corps = { moyen: 'carte' }, id = appId, cookie = dev) =>
  request(test.app).post(`/api/apps/${id}/paiements`).set('Cookie', cookie).send(corps)
const simuler = (reference, resultat, cookie = dev) =>
  request(test.app).post(`/api/paiements/${reference}/simulation`).set('Cookie', cookie).send({ resultat })
function webhook(corps, signature) {
  const brut = JSON.stringify(corps)
  return request(test.app)
    .post('/api/paiements/webhook/agregateur')
    .set('Content-Type', 'application/json')
    .set('X-Nakayo-Signature', signature ?? `sha256=${signer(brut, SECRET)}`)
    .send(brut)
}
const appActuelle = async () => (await request(test.app).get(`/api/apps/${appId}`).set('Cookie', dev)).body.app

describe('offre publique (§2.1)', () => {
  it('donne les prix par moyen de paiement et la garantie', async () => {
    const r = await request(test.app).get('/api/offres')
    expect(r.status).toBe(200)
    expect(r.body.offres[0]).toMatchObject({
      code: 'standard',
      prix: { carte: { montant: 2900, devise: 'USD' }, mobile_money: { montant: 17500, devise: 'XOF' } },
      garantie: expect.stringContaining('nouvelle campagne'),
    })
  })
})

describe('paiement d’une app (§2.2 et §2.3)', () => {
  it('par carte : paiement en attente, puis la simulation le confirme, l’app passe en vérification et le reçu part', async () => {
    const r = await payer()
    expect(r.status).toBe(201)
    expect(r.body.paiement).toMatchObject({
      reference: expect.stringMatching(/^PAY-[0-9A-F]{16}$/),
      appId,
      appNom: 'Marché Facile',
      moyen: 'carte',
      montant: 2900,
      devise: 'USD',
      montantLisible: '29,00 $ US',
      statut: 'en_attente',
      facture: null,
    })
    expect(r.body.redirection).toBe(`/paiement/simulation/${r.body.paiement.reference}`)
    expect((await appActuelle()).statut).toBe('brouillon')

    const s = await simuler(r.body.paiement.reference, 'reussi')
    expect(s.status).toBe(200)
    expect(s.body.paiement).toMatchObject({ statut: 'reussi', facture: 'NKY-2026-00001', confirmeLe: '2026-11-12T09:00:00.000Z' })
    expect((await appActuelle()).statut).toBe('en_verification')

    const recu = test.emails.dernierPour('awa@studio.bj')
    expect(recu.sujet).toBe('Reçu de paiement Nakayo NKY-2026-00001')
    expect(recu.texte).toContain('29,00 $ US')
    expect(recu.texte).toContain('Marché Facile')
  })

  it('par Mobile Money : en FCFA, avec le numéro qui paie', async () => {
    const r = await payer({ moyen: 'mobile_money', numeroMomo: '+229 01 97 00 00 00' })
    expect(r.status).toBe(201)
    expect(r.body.paiement).toMatchObject({ moyen: 'mobile_money', montant: 17500, devise: 'XOF', montantLisible: '17 500 FCFA' })
    const { rows } = await pool.query('SELECT numero_momo FROM paiements')
    expect(rows[0].numero_momo).toBe('+2290197000000')
  })

  it('champs invalides : 422', async () => {
    expect((await payer({})).body.erreur.champs).toEqual({ moyen: 'requis' })
    expect((await payer({ moyen: 'cheque' })).body.erreur.champs).toEqual({ moyen: 'valeur_inconnue' })
    expect((await payer({ moyen: 'mobile_money', numeroMomo: '0197' })).body.erreur.champs).toEqual({ numeroMomo: 'format_invalide' })
  })

  it('un échec laisse l’app en brouillon, et on peut réessayer', async () => {
    const { body } = await payer()
    const s = await simuler(body.paiement.reference, 'echoue')
    expect(s.body.paiement.statut).toBe('echoue')
    expect((await appActuelle()).statut).toBe('brouillon')
    expect(test.emails.dernierPour('awa@studio.bj')).toBeNull()
    expect((await payer()).status).toBe(201)
  })

  it('une app déjà payée ne se paie plus (409) ; un second paiement confirmé devient un doublon', async () => {
    const premier = (await payer()).body.paiement.reference
    const second = (await payer()).body.paiement.reference
    await simuler(premier, 'reussi')
    expect((await payer()).body.erreur).toMatchObject({ code: 'statut_incompatible', statut: 'en_verification' })
    const s = await simuler(second, 'reussi')
    expect(s.body.paiement).toMatchObject({ statut: 'doublon', facture: null })
  })

  it('une confirmation déjà appliquée ne change plus rien (idempotence)', async () => {
    const { body } = await payer()
    await simuler(body.paiement.reference, 'reussi')
    const encore = await simuler(body.paiement.reference, 'echoue')
    expect(encore.body.paiement.statut).toBe('reussi')
    expect(test.emails.envoyes.filter((m) => m.a === 'awa@studio.bj')).toHaveLength(1)
  })

  it('l’app d’un autre développeur ou son paiement répondent 404', async () => {
    const { body } = await payer()
    await creerUtilisateur({ email: 'kofi@studio.bj', statut: 'valide' })
    const autre = await connecter('kofi@studio.bj')
    expect((await payer({ moyen: 'carte' }, appId, autre)).status).toBe(404)
    expect((await simuler(body.paiement.reference, 'reussi', autre)).status).toBe(404)
    expect((await request(test.app).get(`/api/paiements/${body.paiement.reference}`).set('Cookie', autre)).status).toBe(404)
  })

  it('numéros de facture continus dans l’année', async () => {
    const autreApp = { ...APP, package: 'bj.studioawa.autre', lienTestFerme: 'https://play.google.com/apps/testing/bj.studioawa.autre' }
    const id2 = (await request(test.app).post('/api/apps').set('Cookie', dev).send(autreApp)).body.app.id
    await simuler((await payer()).body.paiement.reference, 'reussi')
    const s = await simuler((await payer({ moyen: 'carte' }, id2)).body.paiement.reference, 'reussi')
    expect(s.body.paiement.facture).toBe('NKY-2026-00002')
  })

  it('historique des paiements du développeur, du plus récent au plus ancien', async () => {
    const a = (await payer()).body.paiement.reference
    await simuler(a, 'echoue')
    test.avancer(60 * 1000)
    const b = (await payer({ moyen: 'mobile_money', numeroMomo: '+2290197000000' })).body.paiement.reference
    await simuler(b, 'reussi')
    const r = await request(test.app).get('/api/paiements').set('Cookie', dev)
    expect(r.body.paiements.map((p) => [p.reference, p.statut])).toEqual([
      [b, 'reussi'],
      [a, 'echoue'],
    ])
    const detail = await request(test.app).get(`/api/paiements/${b}`).set('Cookie', dev)
    expect(detail.body.paiement.facture).toBe('NKY-2026-00001')
  })

  it('paiement fermé hors simulation : 503 paiement_indisponible, et la simulation n’existe pas', async () => {
    const { body } = await payer()
    const prod = creerAppTest({ maintenant: '2026-11-12T09:00:00Z', config: { paiementMode: 'aucun' } })
    const cookie = cookieSession(await request(prod.app).post('/api/auth/connexion').send({ email: 'awa@studio.bj', motDePasse: 'motdepasse-valide' }))
    const r = await request(prod.app).post(`/api/apps/${appId}/paiements`).set('Cookie', cookie).send({ moyen: 'carte' })
    expect(r.status).toBe(503)
    expect(r.body.erreur.code).toBe('paiement_indisponible')
    expect((await request(prod.app).post(`/api/paiements/${body.paiement.reference}/simulation`).set('Cookie', cookie).send({ resultat: 'reussi' })).status).toBe(404)
  })
})

describe('webhook d’un fournisseur (§2.4)', () => {
  it('confirme un paiement avec une signature valide', async () => {
    const { body } = await payer({ moyen: 'mobile_money', numeroMomo: '+2290197000000' })
    const r = await webhook({ reference: body.paiement.reference, statut: 'reussi', referenceFournisseur: 'AGR-778' })
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ recu: true, statut: 'reussi' })
    expect((await appActuelle()).statut).toBe('en_verification')
    const { rows } = await pool.query('SELECT reference_fournisseur FROM paiements')
    expect(rows[0].reference_fournisseur).toBe('AGR-778')
  })

  it('refuse une signature absente ou fausse (401), sans rien changer', async () => {
    const { body } = await payer()
    const corps = { reference: body.paiement.reference, statut: 'reussi' }
    expect((await webhook(corps, 'sha256=00')).status).toBe(401)
    expect((await webhook(corps, `sha256=${signer(JSON.stringify({ ...corps, statut: 'echoue' }), SECRET)}`)).status).toBe(401)
    expect((await appActuelle()).statut).toBe('brouillon')
  })

  it('corps invalide (400) ou référence inconnue (404)', async () => {
    expect((await webhook({ reference: 'PAY-1', statut: 'peut-etre' })).status).toBe(400)
    expect((await webhook({ reference: 'PAY-INCONNU', statut: 'reussi' })).status).toBe(404)
  })
})

describe('facture PDF (§3)', () => {
  it('le développeur télécharge sa facture ; un autre compte reçoit 404, un admin y a accès', async () => {
    const { body } = await payer()
    await simuler(body.paiement.reference, 'reussi')
    const r = await request(test.app).get('/api/factures/NKY-2026-00001').set('Cookie', dev).buffer(true).parse((res, fin) => {
      const morceaux = []
      res.on('data', (m) => morceaux.push(m))
      res.on('end', () => fin(null, Buffer.concat(morceaux)))
    })
    expect(r.status).toBe(200)
    expect(r.headers['content-type']).toBe('application/pdf')
    expect(r.headers['content-disposition']).toBe('attachment; filename="facture-NKY-2026-00001.pdf"')
    const texte = r.body.toString('latin1')
    expect(texte.startsWith('%PDF-1.4')).toBe(true)
    expect(texte).toContain('(NKY-2026-00001)')
    expect(texte).toContain('(Studio Awa)')
    expect(texte).toContain('(29,00 $ US)')
    expect(texte).toContain('%%EOF')

    await creerUtilisateur({ email: 'kofi@studio.bj', statut: 'valide' })
    expect((await request(test.app).get('/api/factures/NKY-2026-00001').set('Cookie', await connecter('kofi@studio.bj'))).status).toBe(404)
    await creerUtilisateur({ email: 'admin@nakayo.bj', role: 'admin', statut: 'valide' })
    expect((await request(test.app).get('/api/factures/NKY-2026-00001').set('Cookie', await connecter('admin@nakayo.bj'))).status).toBe(200)
  })
})
