import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { APP, cookieSession, creerTesteursValides, creerUtilisateur } from '../fabriques.js'
import { creerAppTest, pool, viderBase } from '../outils.js'

// US-30 : garantie après un refus de Google (docs/garantie.md).
const TOUT = ['testeurs_ajoutes', 'fiche_complete', 'version_publiee', 'pays_coches', 'pas_de_test_interne', 'mises_a_jour_prevues']
const EMAIL_GOOGLE = 'Votre demande d’accès à la production a été refusée : vos testeurs n’ont pas suffisamment utilisé l’application.'
const DEMANDE = { choix: 'nouvelle_campagne', motifGoogle: 'engagement_insuffisant', emailGoogle: EMAIL_GOOGLE, engagement: true }
const JOUR = 24 * 60 * 60 * 1000
let test
let admin
let dev
let appId

const garantie = () => request(test.app).get(`/api/apps/${appId}/garantie`).set('Cookie', dev)
const demander = (corps = DEMANDE) => request(test.app).post(`/api/apps/${appId}/garantie`).set('Cookie', dev).send(corps)
const decider = (id, corps) => request(test.app).post(`/api/admin/garanties/${id}/decision`).set('Cookie', admin).send(corps)

async function terminer(dans = 0) {
  await pool.query("UPDATE campagnes SET statut = 'terminee', terminee_le = $2 WHERE app_id = $1 AND statut = 'en_cours'", [appId, new Date(Date.parse('2026-11-12T09:00:00Z') + dans)])
}

beforeEach(async () => {
  await viderBase()
  test = creerAppTest({ maintenant: '2026-11-12T09:00:00Z' })
  await creerUtilisateur({ email: 'awa@studio.bj', statut: 'valide' })
  await creerUtilisateur({ email: 'admin@nakayo.bj', role: 'admin', statut: 'valide' })
  const connexion = (email) => request(test.app).post('/api/auth/connexion').send({ email, motDePasse: 'motdepasse-valide' })
  dev = cookieSession(await connexion('awa@studio.bj'))
  admin = cookieSession(await connexion('admin@nakayo.bj'))
  await creerTesteursValides(30)
  appId = (await request(test.app).post('/api/apps').set('Cookie', dev).send(APP)).body.app.id
  const { reference } = (await request(test.app).post(`/api/apps/${appId}/paiements`).set('Cookie', dev).send({ moyen: 'carte' })).body.paiement
  await request(test.app).post(`/api/paiements/${reference}/simulation`).set('Cookie', dev).send({ resultat: 'reussi' })
  await request(test.app).post(`/api/admin/apps/${appId}/validation`).set('Cookie', admin)
  await request(test.app).put(`/api/apps/${appId}/preparation`).set('Cookie', dev).send({ elements: TOUT })
  expect((await request(test.app).post(`/api/apps/${appId}/campagne`).set('Cookie', dev)).status).toBe(201)
  test.emails.vider()
})

describe('garantie (US-30)', () => {
  it('pas avant la fin du test, ni après 7 jours', async () => {
    expect((await garantie()).body).toMatchObject({ garantie: null, possible: false, raison: 'campagne_pas_terminee' })
    expect((await demander()).body.erreur.code).toBe('garantie_impossible')

    await terminer()
    expect((await garantie()).body).toMatchObject({ possible: true, jusquau: '2026-11-19' })
    test.avancer(8 * JOUR)
    expect((await garantie()).body).toMatchObject({ possible: false, raison: 'delai_depasse' })
    expect((await demander()).status).toBe(409)
  })

  it('valide le formulaire : motif de Google, email collé et engagement', async () => {
    await terminer()
    const r = await demander({ choix: 'cadeau', motifGoogle: 'autre', emailGoogle: 'court' })
    expect(r.status).toBe(422)
    expect(r.body.erreur.champs).toEqual({ choix: 'valeur_inconnue', motifGoogle: 'valeur_inconnue', emailGoogle: 'trop_court', engagement: 'doit_etre_accepte' })
  })

  it('acceptée : nouvelle campagne offerte avec d’autres testeurs, une seule fois', async () => {
    await terminer()
    const r = await demander()
    expect(r.status).toBe(201)
    expect(r.body.garantie).toMatchObject({ statut: 'en_attente', choix: 'nouvelle_campagne', campagneOfferteDemarree: false })
    expect(test.emails.dernierPour('admin@nakayo.bj').sujet).toBe('Garantie demandée pour « Marché Facile »')
    expect((await demander()).body.erreur.code).toBe('garantie_existante')
    expect((await pool.query('SELECT decision_google FROM campagnes')).rows[0].decision_google).toBe('refusee')

    // Avant la décision, pas de seconde campagne.
    expect((await request(test.app).post(`/api/apps/${appId}/campagne`).set('Cookie', dev)).body.erreur.code).toBe('campagne_existante')

    const liste = await request(test.app).get('/api/admin/garanties').set('Cookie', admin)
    expect(liste.body.total).toBe(1)
    expect(liste.body.garanties[0]).toMatchObject({ emailGoogle: EMAIL_GOOGLE, app: { nom: 'Marché Facile' }, campagne: { preparationComplete: true } })
    const id = liste.body.garanties[0].id
    const dec = await decider(id, { decision: 'acceptee' })
    expect(dec.body.garantie.statut).toBe('acceptee')
    expect(test.emails.dernierPour('awa@studio.bj').sujet).toBe('Garantie pour « Marché Facile » : demande acceptée')
    expect((await decider(id, { decision: 'refusee', motif: 'Trop tard, désolé pour vous.' })).status).toBe(409)

    const seconde = await request(test.app).post(`/api/apps/${appId}/campagne`).set('Cookie', dev)
    expect(seconde.status).toBe(201)
    const campagnes = (await pool.query('SELECT id, offerte FROM campagnes ORDER BY id')).rows
    expect(campagnes.map((c) => c.offerte)).toEqual([false, true])
    const { rows: communs } = await pool.query(
      'SELECT count(*)::int AS n FROM affectations a JOIN affectations b ON a.testeur_id = b.testeur_id WHERE a.campagne_id = $1 AND b.campagne_id = $2',
      [campagnes[0].id, campagnes[1].id],
    )
    expect(communs[0].n).toBe(0)
    expect((await garantie()).body.garantie.campagneOfferteDemarree).toBe(true)

    // La campagne offerte ne rouvre pas de garantie.
    await terminer(14 * JOUR)
    await pool.query('DELETE FROM garanties')
    expect((await garantie()).body.raison).toBe('campagne_offerte')
  })

  it('remboursement accepté, ou refus avec motif', async () => {
    await terminer()
    await demander({ ...DEMANDE, choix: 'remboursement', motifGoogle: 'testeurs_insuffisants' })
    const id = (await request(test.app).get('/api/admin/garanties').set('Cookie', admin)).body.garanties[0].id
    expect((await decider(id, { decision: 'refusee' })).body.erreur.champs).toEqual({ motif: 'requis' })
    await decider(id, { decision: 'acceptee' })
    expect((await pool.query('SELECT statut FROM paiements')).rows[0].statut).toBe('rembourse')
    expect(test.emails.dernierPour('awa@studio.bj').texte).toContain('vous êtes remboursé')
    expect((await request(test.app).post(`/api/apps/${appId}/campagne`).set('Cookie', dev)).body.erreur.code).toBe('campagne_existante')

    await pool.query('DELETE FROM garanties')
    await demander()
    const autre = (await request(test.app).get('/api/admin/garanties').set('Cookie', admin)).body.garanties[0].id
    await decider(autre, { decision: 'refusee', motif: 'Google a refusé pour une autre raison : politique de contenu.' })
    expect(test.emails.dernierPour('awa@studio.bj').texte).toContain('Motif : Google a refusé pour une autre raison')
    expect((await request(test.app).get('/api/admin/garanties?statut=refusee').set('Cookie', admin)).body.total).toBe(1)
    expect((await request(test.app).get('/api/admin/journal').set('Cookie', admin)).body.actions.map((a) => a.libelle)).toEqual([
      'Garantie refusée',
      'Garantie acceptée',
      'App validée',
    ])
  })
})
