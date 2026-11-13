import { readdirSync } from 'node:fs'
import path from 'node:path'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { APP, cookieSession, creerTesteursValides, creerUtilisateur, JPEG, PNG } from '../fabriques.js'
import { creerAppTest, pool, viderBase } from '../outils.js'
import { verifierJour } from '../../src/services/verificationQuotidienne.js'

// Rapports de bugs avec captures (US-33, docs/api-bugs.md).
const TOUT = ['testeurs_ajoutes', 'fiche_complete', 'version_publiee', 'pays_coches', 'pas_de_test_interne', 'mises_a_jour_prevues']
const JOUR = 24 * 60 * 60 * 1000
const BUG = {
  titre: 'Le panier se vide',
  etapes: '1. Ajouter du riz au panier. 2. Quitter l’app. 3. Revenir.',
  resultatAttendu: 'Le riz est toujours dans le panier.',
  resultatObtenu: 'Le panier est vide.',
  gravite: 'genante',
  versionApp: '1.0.3',
}
let test
let testeurs
let affectation
let testeur
let dev

async function connecter(email) {
  return cookieSession(await request(test.app).post('/api/auth/connexion').send({ email, motDePasse: 'motdepasse-valide' }))
}

const bearer = (t) => ({ Authorization: `Bearer ${t.jeton}` })

function signaler(champs = BUG, captures = [JPEG], t = testeur, id = affectation) {
  let r = request(test.app).post(`/api/testeurs/moi/apps/${id}/bugs`).set(bearer(t))
  for (const [cle, valeur] of Object.entries(champs)) r = r.field(cle, valeur)
  captures.forEach((c, i) => {
    r = r.attach('captures', c, { filename: `capture-${i}.jpg`, contentType: 'image/jpeg' })
  })
  return r
}

async function campagne(offre) {
  await creerUtilisateur({ email: 'awa@studio.bj', statut: 'valide' })
  await creerUtilisateur({ email: 'admin@nakayo.bj', role: 'admin', statut: 'valide' })
  dev = await connecter('awa@studio.bj')
  const admin = await connecter('admin@nakayo.bj')
  testeurs = await creerTesteursValides(16)
  const id = (await request(test.app).post('/api/apps').set('Cookie', dev).send(APP)).body.app.id
  const { reference } = (await request(test.app).post(`/api/apps/${id}/paiements`).set('Cookie', dev).send({ offre, moyen: 'carte' })).body.paiement
  await request(test.app).post(`/api/paiements/${reference}/simulation`).set('Cookie', dev).send({ resultat: 'reussi' })
  await request(test.app).post(`/api/admin/apps/${id}/validation`).set('Cookie', admin)
  await request(test.app).put(`/api/apps/${id}/preparation`).set('Cookie', dev).send({ elements: TOUT })
  await request(test.app).post(`/api/apps/${id}/campagne`).set('Cookie', dev)
  const { rows } = await pool.query('SELECT id, testeur_id FROM affectations ORDER BY id LIMIT 1')
  affectation = String(rows[0].id)
  testeur = testeurs.find((t) => t.id === String(rows[0].testeur_id))
}

beforeEach(async () => {
  await viderBase()
  test = creerAppTest({ maintenant: '2026-11-13T09:00:00Z', config: { groupeTesteurs: 'testeurs@nakayo.test' } })
})

describe('envoyer un rapport de bug (§1.1)', () => {
  beforeEach(() => campagne('pro'))

  it('enregistre le bug et ses captures hors du dossier public', async () => {
    const apps = (await request(test.app).get('/api/testeurs/moi/apps').set(bearer(testeur))).body.apps
    expect(apps[0].rapportsDeBugs).toBe(true)

    const r = await signaler(BUG, [JPEG, PNG])
    expect(r.status).toBe(201)
    expect(r.body.bug).toEqual({
      id: expect.any(String),
      ...BUG,
      captures: 2,
      statut: 'nouveau',
      motifRefus: null,
      signaleLe: '2026-11-13T09:00:00.000Z',
      decideLe: null,
    })
    const fichiers = readdirSync(path.join(test.dossierDocuments, testeur.id))
    expect(fichiers.filter((f) => f.startsWith(`bug-${affectation}-`))).toHaveLength(2)
  })

  it('accepte un bug sans capture', async () => {
    expect((await signaler(BUG, [])).status).toBe(201)
  })

  it('refuse plus de 5 captures', async () => {
    const r = await signaler(BUG, [JPEG, JPEG, JPEG, JPEG, JPEG, JPEG])
    expect(r.status).toBe(422)
    expect(r.body.erreur.champs).toEqual({ captures: 'trop_nombreuses' })
  })

  it('refuse une capture qui n’est pas une image', async () => {
    const r = await signaler(BUG, [Buffer.from('%PDF-1.4 pas une image')])
    expect(r.status).toBe(422)
    expect(r.body.erreur.champs).toEqual({ captures: 'type_fichier_invalide' })
    expect((await pool.query('SELECT count(*)::int AS n FROM bugs')).rows[0].n).toBe(0)
  })

  it('vérifie les champs : étapes, résultats, gravité', async () => {
    const r = await signaler({ titre: 'Bug', etapes: 'court', gravite: 'grave', versionApp: '1.0' })
    expect(r.status).toBe(422)
    expect(r.body.erreur.champs).toEqual({
      titre: 'trop_court',
      etapes: 'trop_court',
      resultatAttendu: 'requis',
      resultatObtenu: 'requis',
      gravite: 'valeur_inconnue',
    })
  })

  it('un JSON au lieu d’un formulaire multipart est refusé', async () => {
    const r = await request(test.app).post(`/api/testeurs/moi/apps/${affectation}/bugs`).set(bearer(testeur)).send(BUG)
    expect(r.status).toBe(422)
  })

  it('un autre testeur ne peut pas signaler sur cette affectation', async () => {
    const autre = testeurs.find((t) => t.id !== testeur.id)
    expect((await signaler(BUG, [], autre)).status).toBe(404)
  })

  it('liste les bugs du testeur, du plus récent au plus ancien (§1.2)', async () => {
    await signaler({ ...BUG, titre: 'Premier bug' }, [])
    test.avancer(60_000)
    await signaler({ ...BUG, titre: 'Second bug' }, [])
    const r = await request(test.app).get(`/api/testeurs/moi/apps/${affectation}/bugs`).set(bearer(testeur))
    expect(r.status).toBe(200)
    expect(r.body.bugs.map((b) => b.titre)).toEqual(['Second bug', 'Premier bug'])
  })
})

describe('offre Standard', () => {
  beforeEach(() => campagne('standard'))

  it('les rapports de bugs ne sont pas proposés', async () => {
    const apps = (await request(test.app).get('/api/testeurs/moi/apps').set(bearer(testeur))).body.apps
    expect(apps[0].rapportsDeBugs).toBe(false)
    const r = await signaler()
    expect(r.status).toBe(403)
    expect(r.body.erreur.code).toBe('offre_sans_rapports_de_bugs')
  })
})

describe('bonus des bugs acceptés (§3)', () => {
  beforeEach(() => campagne('pro'))

  it('200 FCFA par bug accepté, ajoutés au versement de clôture', async () => {
    for (const titre of ['Bug accepté un', 'Bug accepté deux', 'Bug refusé']) await signaler({ ...BUG, titre }, [])
    await pool.query(`UPDATE bugs SET statut = 'accepte', decide_le = now() WHERE titre LIKE 'Bug accepté%'`)
    await pool.query(`UPDATE bugs SET statut = 'refuse', decide_le = now(), motif_refus = 'Comportement voulu.' WHERE titre = 'Bug refusé'`)

    const portefeuille = (await request(test.app).get('/api/testeurs/moi/portefeuille').set(bearer(testeur))).body.portefeuille
    expect(portefeuille.enAttente[0]).toMatchObject({ montant: 1200, devise: 'XOF' })

    await pool.query('UPDATE affectations SET inscription_confirmee_le = now(), installation_confirmee_le = now(), jours_valides = 14')
    test.avancer(16 * JOUR)
    await verifierJour(test.app.locals.deps, { jour: '2026-11-29', maintenant: test.app.locals.deps.maintenant() })
    const { rows } = await pool.query('SELECT affectation_id::text AS a, montant FROM versements ORDER BY affectation_id')
    expect(rows.find((v) => v.a === affectation).montant).toBe(1200)
    expect(rows.filter((v) => v.a !== affectation).every((v) => v.montant === 800)).toBe(true)
  })
})

describe('côté développeur (US-34, §2)', () => {
  beforeEach(() => campagne('pro'))

  const bugsDev = (requete = '') => request(test.app).get(`/api/apps/${appId()}/bugs${requete}`).set('Cookie', dev)
  const decider = (id, corps) => request(test.app).post(`/api/apps/${appId()}/bugs/${id}/decision`).set('Cookie', dev).send(corps)
  let idApp
  const appId = () => idApp

  beforeEach(async () => {
    idApp = String((await pool.query('SELECT id FROM apps LIMIT 1')).rows[0].id)
    await signaler({ ...BUG, titre: 'Bug mineur ici', gravite: 'mineure' }, [])
    test.avancer(60_000)
    await signaler({ ...BUG, titre: 'Bug bloquant ici', gravite: 'bloquante' }, [JPEG, PNG])
  })

  it('liste les bugs, les plus graves d’abord, avec le testeur anonymisé et les captures', async () => {
    const r = await bugsDev()
    expect(r.status).toBe(200)
    expect(r.body.rapportsDeBugs).toBe(true)
    expect(r.body.resume).toMatchObject({ total: 2, nouveaux: 2, bloquants: 1, mineurs: 1 })
    expect(r.body.bugs.map((b) => b.titre)).toEqual(['Bug bloquant ici', 'Bug mineur ici'])
    const [bloquant] = r.body.bugs
    expect(bloquant).toMatchObject({ statut: 'nouveau', decidable: true, testeur: { numero: 1 } })
    expect(bloquant.testeur).not.toHaveProperty('nom')
    expect(bloquant.captures).toEqual([`/api/apps/${idApp}/bugs/${bloquant.id}/captures/1`, `/api/apps/${idApp}/bugs/${bloquant.id}/captures/2`])

    const capture = await request(test.app).get(bloquant.captures[1]).set('Cookie', dev)
    expect(capture.status).toBe(200)
    expect(capture.headers['content-type']).toBe('image/png')
    expect(capture.headers['cache-control']).toBe('private, no-store')
    expect((await request(test.app).get(`${bloquant.captures[0].slice(0, -1)}3`).set('Cookie', dev)).status).toBe(404)
  })

  it('filtre par gravité et par statut', async () => {
    expect((await bugsDev('?gravite=mineure')).body.bugs.map((b) => b.titre)).toEqual(['Bug mineur ici'])
    expect((await bugsDev('?statut=accepte')).body.bugs).toEqual([])
    expect((await bugsDev('?gravite=grave')).status).toBe(422)
  })

  it('un autre développeur ne voit ni les bugs ni les captures', async () => {
    await creerUtilisateur({ email: 'autre@studio.bj', statut: 'valide' })
    const autre = await connecter('autre@studio.bj')
    const [bug] = (await bugsDev()).body.bugs
    expect((await request(test.app).get(`/api/apps/${idApp}/bugs`).set('Cookie', autre)).status).toBe(404)
    expect((await request(test.app).get(bug.captures[0]).set('Cookie', autre)).status).toBe(404)
    expect((await request(test.app).post(`/api/apps/${idApp}/bugs/${bug.id}/decision`).set('Cookie', autre).send({ decision: 'accepte' })).status).toBe(404)
  })

  it('accepter déclenche le bonus ; refuser exige un motif ; une décision est définitive', async () => {
    const [bloquant, mineur] = (await bugsDev()).body.bugs
    const ok = await decider(bloquant.id, { decision: 'accepte' })
    expect(ok.status).toBe(200)
    expect(ok.body.bug).toMatchObject({ statut: 'accepte', decidable: false, decideLe: '2026-11-13T09:01:00.000Z', motifRefus: null })
    const portefeuille = (await request(test.app).get('/api/testeurs/moi/portefeuille').set(bearer(testeur))).body.portefeuille
    expect(portefeuille.enAttente[0].montant).toBe(1000)

    expect((await decider(mineur.id, { decision: 'refuse' })).body.erreur.champs).toEqual({ motif: 'requis' })
    const refus = await decider(mineur.id, { decision: 'refuse', motif: 'C’est le comportement voulu.' })
    expect(refus.body.bug).toMatchObject({ statut: 'refuse', motifRefus: 'C’est le comportement voulu.' })
    expect((await decider(mineur.id, { decision: 'accepte' })).body.erreur.code).toBe('deja_decide')

    // Le testeur voit la décision.
    const vus = (await request(test.app).get(`/api/testeurs/moi/apps/${affectation}/bugs`).set(bearer(testeur))).body.bugs
    expect(vus.map((b) => b.statut).sort()).toEqual(['accepte', 'refuse'])
  })

  it('campagne terminée : plus de décision', async () => {
    const [bug] = (await bugsDev()).body.bugs
    await pool.query(`UPDATE campagnes SET statut = 'terminee'`)
    expect((await bugsDev()).body.bugs[0].decidable).toBe(false)
    const r = await decider(bug.id, { decision: 'accepte' })
    expect(r.status).toBe(409)
    expect(r.body.erreur.code).toBe('campagne_terminee')
  })

  it('export CSV pour un tableur, sans formule exécutable', async () => {
    await signaler({ ...BUG, titre: '=HYPERLINK("x") bug', etapes: 'Étape 1; puis "Étape 2"\nfin' }, [])
    const r = await request(test.app).get(`/api/apps/${idApp}/bugs.csv`).set('Cookie', dev)
    expect(r.status).toBe(200)
    expect(r.headers['content-type']).toBe('text/csv; charset=utf-8')
    expect(r.headers['content-disposition']).toBe('attachment; filename="bugs-bj.studioawa.marche.csv"')
    const texte = r.text
    expect(texte.startsWith('﻿Titre;Gravité;Statut;')).toBe(true)
    expect(texte).toContain('"\'=HYPERLINK(""x"") bug"')
    expect(texte).toContain('"Étape 1; puis ""Étape 2""\nfin"')
    expect(texte).toContain('Bug bloquant ici;Bloquante;À examiner;')
    expect(texte.trim().split('\r\n')).toHaveLength(4)
  })
})
