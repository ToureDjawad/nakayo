import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { APP, cookieSession, creerTesteursValides, creerUtilisateur } from '../fabriques.js'
import { creerAppTest, pool, viderBase } from '../outils.js'
import { enBonneVoie } from '../../src/services/tableauDeBord.js'
import { verifierJour } from '../../src/services/verificationQuotidienne.js'
import { traiterVersements } from '../../src/services/versements.js'

const TOUT = ['testeurs_ajoutes', 'fiche_complete', 'version_publiee', 'pays_coches', 'pas_de_test_interne', 'mises_a_jour_prevues']
const JOUR = 24 * 60 * 60 * 1000
let test
let admin
let dev
let affectations
const momo = { reponse: { statut: 'verse' }, async verser() { return this.reponse } }

const deps = () => test.app.locals.deps
const tableau = async () => {
  const r = await request(test.app).get('/api/admin/tableau-de-bord').set('Cookie', admin)
  expect(r.status).toBe(200)
  return r.body.tableauDeBord
}

async function connecter(email) {
  return cookieSession(await request(test.app).post('/api/auth/connexion').send({ email, motDePasse: 'motdepasse-valide' }))
}

beforeEach(async () => {
  await viderBase()
  momo.reponse = { statut: 'verse' }
  test = creerAppTest({ maintenant: '2026-11-12T09:00:00Z', config: { groupeTesteurs: 'testeurs@nakayo.test' }, momo })
  await creerUtilisateur({ email: 'awa@studio.bj', nom: 'Awa Studio', statut: 'valide' })
  await creerUtilisateur({ email: 'admin@nakayo.bj', role: 'admin', statut: 'valide' })
  dev = await connecter('awa@studio.bj')
  admin = await connecter('admin@nakayo.bj')
  await creerTesteursValides(15)
  const id = (await request(test.app).post('/api/apps').set('Cookie', dev).send(APP)).body.app.id
  const { reference } = (await request(test.app).post(`/api/apps/${id}/paiements`).set('Cookie', dev).send({ moyen: 'carte' })).body.paiement
  await request(test.app).post(`/api/paiements/${reference}/simulation`).set('Cookie', dev).send({ resultat: 'reussi' })
  await request(test.app).post(`/api/admin/apps/${id}/validation`).set('Cookie', admin)
  await request(test.app).put(`/api/apps/${id}/preparation`).set('Cookie', dev).send({ elements: TOUT })
  await request(test.app).post(`/api/apps/${id}/campagne`).set('Cookie', dev)
  affectations = (await pool.query('SELECT id FROM affectations ORDER BY id')).rows.map((r) => r.id)
})

describe('tableau de bord global (US-24)', () => {
  it('campagne en retard tant que 12 testeurs ne peuvent pas atteindre 14 jours', async () => {
    let t = await tableau()
    expect(t.campagnes).toMatchObject({ enCours: 1, terminees: 0, enRetard: 1 })
    expect(t.campagnes.retards[0]).toMatchObject({ appNom: 'Marché Facile', jour: 1, testeursEnBonneVoie: 0 })
    expect(t.testeurs).toMatchObject({ valides: 15, actifs: 0, affectations: 15, remplaces: 0, tauxAbandon: 0 })

    await pool.query('UPDATE affectations SET inscription_confirmee_le = $2, installation_confirmee_le = $2 WHERE id = ANY($1)', [
      affectations.slice(0, 12),
      deps().maintenant(),
    ])
    t = await tableau()
    expect(t.campagnes.enRetard).toBe(0)
    expect(t.testeurs.actifs).toBe(12)

    // Jour 10 : il reste 7 jours, seuls les testeurs à 7 jours validés ou plus peuvent encore finir.
    test.avancer(9 * JOUR)
    await pool.query('UPDATE affectations SET jours_valides = CASE WHEN id = ANY($1) THEN 9 ELSE 2 END', [affectations.slice(0, 11)])
    t = await tableau()
    expect(t.campagnes.retards).toEqual([expect.objectContaining({ jour: 10, testeursEnBonneVoie: 11 })])
  })

  it('chiffre d’affaires en FCFA, versements, marge par app et versements échoués', async () => {
    let t = await tableau()
    // 29 $ par carte = 17 400 FCFA ; campagne en cours : marge au pire cas (15 testeurs payés).
    expect(t.finances).toMatchObject({ chiffreAffaires: 17400, chiffreAffairesLisible: '17 400 FCFA', versesTesteurs: 0, dusTesteurs: 0, marge: 17400 })
    expect(t.finances.parApp).toEqual([
      expect.objectContaining({ appNom: 'Marché Facile', developpeur: 'Awa Studio', statut: 'en_cours', encaisse: 17400, marge: 17400 - 7500, margeDefinitive: false }),
    ])

    await pool.query(`UPDATE affectations SET statut = 'remplacee', remplacee_le = $2 WHERE id = $1`, [affectations[14], deps().maintenant()])
    await pool.query('UPDATE affectations SET inscription_confirmee_le = $2, installation_confirmee_le = $2, jours_valides = 14 WHERE id = ANY($1)', [
      affectations.slice(0, 3),
      deps().maintenant(),
    ])
    test.avancer(16 * JOUR)
    await verifierJour(deps(), { jour: '2026-11-27', maintenant: deps().maintenant() })
    // 2 versements réussissent, le 3e échoue 4 fois.
    await traiterVersements({ ...deps(), momo: { calls: 0, async verser() { return ++this.calls <= 2 ? { statut: 'verse' } : { statut: 'echoue', motif: 'compte_inconnu' } } } })
    await pool.query(`UPDATE versements SET statut = 'echoue', tentatives = 4 WHERE statut = 'a_verser'`)

    t = await tableau()
    expect(t.campagnes).toMatchObject({ enCours: 0, terminees: 1, enRetard: 0 })
    expect(t.testeurs.tauxAbandon).toBeCloseTo(1 / 15)
    expect(t.finances).toMatchObject({ versesTesteurs: 1000, dusTesteurs: 500, marge: 17400 - 1500, margeLisible: '15 900 FCFA' })
    expect(t.finances.parApp[0]).toMatchObject({ statut: 'terminee', versesTesteurs: 1000, dusTesteurs: 500, marge: 15900, margeDefinitive: true })
    expect(t.nombreVersementsEchoues).toBe(1)
    expect(t.versementsEchoues).toEqual([expect.objectContaining({ statut: 'echoue', dernierMotif: 'compte_inconnu', montant: 500 })])
  })

  it('réservé aux admins', async () => {
    expect((await request(test.app).get('/api/admin/tableau-de-bord').set('Cookie', dev)).status).toBe(403)
    expect((await request(test.app).get('/api/admin/tableau-de-bord')).status).toBe(401)
  })
})

describe('testeurs en bonne voie', () => {
  it('compte ceux qui peuvent encore atteindre les jours exigés', () => {
    expect(enBonneVoie([0, 4, 5, 14], 14, 9)).toBe(2)
    expect(enBonneVoie([], 14, 16)).toBe(0)
  })
})
