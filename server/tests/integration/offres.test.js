import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { APP, cookieSession, creerTesteursValides, creerUtilisateur } from '../fabriques.js'
import { creerAppTest, pool, viderBase } from '../outils.js'
import { verifierJour } from '../../src/services/verificationQuotidienne.js'

// docs/api-offres.md : offres Standard et Pro, montée en gamme (US-32).
const TOUT = ['testeurs_ajoutes', 'fiche_complete', 'version_publiee', 'pays_coches', 'pas_de_test_interne', 'mises_a_jour_prevues']
const JOUR = 24 * 60 * 60 * 1000
let test
let dev
let admin
let appId

const connecter = async (email) => cookieSession(await request(test.app).post('/api/auth/connexion').send({ email, motDePasse: 'motdepasse-valide' }))
const payer = (corps, id = appId) => request(test.app).post(`/api/apps/${id}/paiements`).set('Cookie', dev).send(corps)
const monter = (corps) => request(test.app).post(`/api/apps/${appId}/montee-en-gamme`).set('Cookie', dev).send(corps)
const simuler = (reference, resultat = 'reussi') => request(test.app).post(`/api/paiements/${reference}/simulation`).set('Cookie', dev).send({ resultat })
const appActuelle = async () => (await request(test.app).get(`/api/apps/${appId}`).set('Cookie', dev)).body.app

beforeEach(async () => {
  await viderBase()
  test = creerAppTest({ maintenant: '2026-11-13T09:00:00Z', config: { groupeTesteurs: 'testeurs@nakayo.test' } })
  await creerUtilisateur({ email: 'awa@studio.bj', nom: 'Studio Awa', statut: 'valide' })
  await creerUtilisateur({ email: 'admin@nakayo.bj', role: 'admin', statut: 'valide' })
  dev = await connecter('awa@studio.bj')
  admin = await connecter('admin@nakayo.bj')
  appId = (await request(test.app).post('/api/apps').set('Cookie', dev).send(APP)).body.app.id
})

async function lancerCampagne() {
  await request(test.app).post(`/api/admin/apps/${appId}/validation`).set('Cookie', admin)
  await request(test.app).put(`/api/apps/${appId}/preparation`).set('Cookie', dev).send({ elements: TOUT })
  return request(test.app).post(`/api/apps/${appId}/campagne`).set('Cookie', dev)
}

describe('offres publiques (§1)', () => {
  it('Standard et Pro, avec leurs prix, sans la paie des testeurs', async () => {
    const { offres } = (await request(test.app).get('/api/offres')).body
    expect(offres.map((o) => o.code)).toEqual(['standard', 'pro'])
    expect(offres[1]).toMatchObject({
      nom: 'Offre Pro',
      prix: { carte: { montant: 5900, devise: 'USD' }, mobile_money: { montant: 35400, devise: 'XOF' } },
      monteeEnGamme: { prix: { carte: { montant: 3000, devise: 'USD' }, mobile_money: { montant: 18000, devise: 'XOF' } } },
    })
    expect(offres[0]).not.toHaveProperty('monteeEnGamme')
    expect(offres[1]).not.toHaveProperty('remuneration')
  })
})

describe('payer l’offre Pro (§1)', () => {
  it('l’app en brouillon est payée en Pro : 59 $, facture et app en Pro', async () => {
    const r = await payer({ offre: 'pro', moyen: 'carte' })
    expect(r.status).toBe(201)
    expect(r.body.paiement).toMatchObject({ offre: 'pro', nature: 'offre', montant: 5900, devise: 'USD' })
    await simuler(r.body.paiement.reference)
    expect(await appActuelle()).toMatchObject({ statut: 'en_verification', offre: 'pro' })
    const { rows } = await pool.query('SELECT libelle FROM factures')
    expect(rows[0].libelle).toBe('Offre Pro : campagne de test pour « Marché Facile »')
    expect(test.emails.dernierPour('awa@studio.bj').texte).toContain('pour l’Offre Pro')
  })

  it('refuse une offre inconnue', async () => {
    const r = await payer({ offre: 'platine', moyen: 'carte' })
    expect(r.status).toBe(422)
    expect(r.body.erreur.champs).toEqual({ offre: 'valeur_inconnue' })
  })
})

describe('montée en gamme (§2)', () => {
  it('une app Standard payée passe en Pro en payant la différence : 18 000 FCFA', async () => {
    await simuler((await payer({ moyen: 'carte' })).body.paiement.reference)
    const r = await monter({ moyen: 'mobile_money', numeroMomo: '+229 01 97 00 00 00' })
    expect(r.status).toBe(201)
    expect(r.body.paiement).toMatchObject({ offre: 'pro', nature: 'montee_en_gamme', montant: 18000, devise: 'XOF', montantLisible: '18 000 FCFA' })
    expect((await appActuelle()).offre).toBe('standard')

    await simuler(r.body.paiement.reference)
    // L'app reste où elle en était (en vérification), mais passe en Pro.
    expect(await appActuelle()).toMatchObject({ statut: 'en_verification', offre: 'pro' })
    const { rows } = await pool.query('SELECT libelle FROM factures ORDER BY id')
    expect(rows[1].libelle).toBe('Passage à l’Offre Pro pour « Marché Facile » (différence de prix)')
    expect(test.emails.dernierPour('awa@studio.bj').texte).toContain('pour passer l’app « Marché Facile » à l’Offre Pro')

    // Déjà en Pro : plus de montée possible.
    const encore = await monter({ moyen: 'carte' })
    expect(encore.status).toBe(409)
    expect(encore.body.erreur.code).toBe('deja_dans_cette_offre')
  })

  it('pas de montée pour une app en brouillon : l’offre se choisit au paiement', async () => {
    const r = await monter({ moyen: 'carte' })
    expect(r.status).toBe(409)
    expect(r.body.erreur.code).toBe('statut_incompatible')
  })

  it('deux montées payées en même temps : la seconde est un doublon à rembourser', async () => {
    await simuler((await payer({ moyen: 'carte' })).body.paiement.reference)
    const a = (await monter({ moyen: 'carte' })).body.paiement.reference
    const b = (await monter({ moyen: 'carte' })).body.paiement.reference
    await simuler(a)
    expect((await simuler(b)).body.paiement.statut).toBe('doublon')
  })
})

describe('campagne Pro (§3)', () => {
  it('confie la campagne aux testeurs confirmés d’abord, et les paie 800 FCFA', async () => {
    const testeurs = await creerTesteursValides(20)
    // 5 testeurs ont déjà mené une campagne au bout : ils passent avant les 15 autres.
    const confirmes = testeurs.slice(15).map((t) => t.id)
    const autre = (await request(test.app).post('/api/apps').set('Cookie', dev).send({ ...APP, nom: 'Ancienne', package: 'bj.studioawa.ancienne', lienTestFerme: 'https://play.google.com/apps/testing/bj.studioawa.ancienne' })).body.app.id
    const { rows: c } = await pool.query(
      `INSERT INTO campagnes (app_id, developpeur_id, statut, demarree_le, fin_prevue_le, testeurs_vises, jours_exiges)
       SELECT $1, developpeur_id, 'terminee', now() - interval '20 days', now() - interval '4 days', 15, 14 FROM apps WHERE id = $1 RETURNING id`,
      [autre],
    )
    for (const id of confirmes) {
      await pool.query(`INSERT INTO affectations (campagne_id, app_id, testeur_id, statut, affecte_le) VALUES ($1, $2, $3, 'terminee', now())`, [c[0].id, autre, id])
    }

    await simuler((await payer({ offre: 'pro', moyen: 'carte' })).body.paiement.reference)
    expect((await lancerCampagne()).status).toBe(201)
    const { rows: choisis } = await pool.query('SELECT testeur_id FROM affectations WHERE app_id = $1', [appId])
    expect(choisis.map((r) => String(r.testeur_id))).toEqual(expect.arrayContaining(confirmes.map(String)))

    // Clôture : tous les testeurs ont leurs 14 jours, ils reçoivent 800 FCFA.
    await pool.query('UPDATE affectations SET inscription_confirmee_le = now(), installation_confirmee_le = now(), jours_valides = 14 WHERE app_id = $1', [appId])
    test.avancer(16 * JOUR)
    await verifierJour(test.app.locals.deps, { jour: '2026-11-28', maintenant: test.app.locals.deps.maintenant() })
    const { rows: v } = await pool.query('SELECT DISTINCT montant FROM versements')
    expect(v).toEqual([{ montant: 800 }])
  })
})
