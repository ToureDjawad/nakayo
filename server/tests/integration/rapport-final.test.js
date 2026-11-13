import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { APP, cookieSession, creerTesteursValides, creerUtilisateur, JPEG } from '../fabriques.js'
import { creerAppTest, pool, viderBase } from '../outils.js'
import { demarrerVerificationNocturne, verifierJour } from '../../src/services/verificationQuotidienne.js'

const TOUT = ['testeurs_ajoutes', 'fiche_complete', 'version_publiee', 'pays_coches', 'pas_de_test_interne', 'mises_a_jour_prevues']
const JOUR = 24 * 60 * 60 * 1000
const RAPPORT = {
  actions: 'J’ai cherché du riz et ajouté deux articles au panier.',
  note: 4,
  bug: false,
  fonctionnalites: ['Panier'],
  versionApp: '1.0.3',
  position: { latitude: 6.36536, longitude: 2.41833 },
}
let test
let dev
let appId
let testeurs
let affectations

const deps = () => test.app.locals.deps
const maintenant = () => deps().maintenant()
const jourCourant = () => new Date(maintenant().getTime() + 60 * 60 * 1000).toISOString().slice(0, 10)
const rapport = () => request(test.app).get(`/api/apps/${appId}/campagne/rapport`).set('Cookie', dev)
const pdf = () => request(test.app).get(`/api/apps/${appId}/campagne/rapport.pdf`).set('Cookie', dev).buffer(true).parse((res, fin) => {
  const morceaux = []
  res.on('data', (m) => morceaux.push(m))
  res.on('end', () => fin(null, Buffer.concat(morceaux)))
})
const decision = (corps) => request(test.app).put(`/api/apps/${appId}/campagne/decision-google`).set('Cookie', dev).send(corps)

async function connecter(email) {
  return cookieSession(await request(test.app).post('/api/auth/connexion').send({ email, motDePasse: 'motdepasse-valide' }))
}

// Le testeur n° `i` de la campagne : inscription, installation.
async function installer(i) {
  const bearer = { Authorization: `Bearer ${testeurs[i].jeton}` }
  await request(test.app).post(`/api/testeurs/moi/apps/${affectations[i]}/inscription`).set(bearer).attach('capture', JPEG, { filename: 'c.jpg', contentType: 'image/jpeg' })
  await request(test.app).post(`/api/testeurs/moi/apps/${affectations[i]}/installation`).set(bearer).send({ sourceInstallation: 'com.android.vending' })
}

async function journee(i, { secondes = 150, rapport = RAPPORT } = {}) {
  const bearer = { Authorization: `Bearer ${testeurs[i].jeton}` }
  await request(test.app).post('/api/testeurs/moi/signal').set(bearer)
  await request(test.app).post('/api/testeurs/moi/usages').set(bearer).send({ usages: [{ package: APP.package, jour: jourCourant(), secondes }] })
  if (rapport) expect((await request(test.app).post(`/api/testeurs/moi/apps/${affectations[i]}/rapports`).set(bearer).send(rapport)).status).toBe(201)
}

beforeEach(async () => {
  await viderBase()
  test = creerAppTest({ maintenant: '2026-11-12T09:00:00Z', config: { groupeTesteurs: 'testeurs@nakayo.test' } })
  await creerUtilisateur({ email: 'awa@studio.bj', statut: 'valide' })
  await creerUtilisateur({ email: 'admin@nakayo.bj', role: 'admin', statut: 'valide' })
  dev = await connecter('awa@studio.bj')
  const admin = await connecter('admin@nakayo.bj')
  const crees = await creerTesteursValides(15, { modele: (i) => (i < 3 ? 'Spark 20' : i < 5 ? 'Redmi 13C' : `Modèle ${i}`) })
  appId = (await request(test.app).post('/api/apps').set('Cookie', dev).send(APP)).body.app.id
  const { reference } = (await request(test.app).post(`/api/apps/${appId}/paiements`).set('Cookie', dev).send({ moyen: 'carte' })).body.paiement
  await request(test.app).post(`/api/paiements/${reference}/simulation`).set('Cookie', dev).send({ resultat: 'reussi' })
  await request(test.app).post(`/api/admin/apps/${appId}/validation`).set('Cookie', admin)
  await request(test.app).put(`/api/apps/${appId}/preparation`).set('Cookie', dev).send({ elements: TOUT })
  await request(test.app).post(`/api/apps/${appId}/campagne`).set('Cookie', dev)
  const { rows } = await pool.query('SELECT id, testeur_id FROM affectations ORDER BY id')
  affectations = rows.map((r) => String(r.id))
  testeurs = rows.map((r) => crees.find((t) => t.id === String(r.testeur_id)))
})


// Jour 1 : deux testeurs en version 1.0.2, dont un problème. Jour 2 : version 1.0.3 avec un avis détaillé.
async function deuxJoursDeTest() {
  for (const i of [0, 1, 2]) await installer(i)
  await journee(0, { rapport: { ...RAPPORT, versionApp: '1.0.2' } })
  await journee(1, { secondes: 60, rapport: { ...RAPPORT, versionApp: '1.0.2', note: 2, bug: true, commentaireBug: 'Le panier se vide quand je quitte l’app.', fonctionnalites: ['Panier'] } })
  const jour1 = jourCourant()
  test.avancer(JOUR)
  await verifierJour(deps(), { jour: jour1, maintenant: maintenant() })
  await journee(0, {
    secondes: 300,
    rapport: { ...RAPPORT, note: 5, fonctionnalites: ['Recherche de produits', 'Panier'], retourDetaille: 'La recherche est rapide et trouve les produits du marché, mais il manque les photos de certains articles pour bien choisir.' },
  })
}

describe('rapport de fin (US-36)', () => {
  it('avant le 14e jour : pas encore prêt, avec la date', async () => {
    const r = await rapport()
    expect(r.status).toBe(200)
    expect(r.body.rapport).toEqual({ pret: false, disponibleLe: '2026-11-25', bilan: null, brouillon: null, decisionGoogle: null })
    expect((await pdf()).status).toBe(409)
    expect((await decision({ decision: 'acceptee' })).status).toBe(409)
  })

  it('au 14e jour : chiffres réels, retours par thème et brouillon sans réponse inventée', async () => {
    await deuxJoursDeTest()
    await pool.query('UPDATE affectations SET jours_valides = 14 WHERE id = ANY($1)', [affectations.slice(0, 2)])
    test.avancer(12 * JOUR)
    const r = (await rapport()).body.rapport
    expect(r.pret).toBe(true)
    const b = r.bilan
    expect(b.testeurs).toMatchObject({ affectes: 15, installes: 3, joursExigesAtteints: 2, objectifAtteint: false })
    expect(b.usage).toEqual({ tempsTotalSecondes: 510, joursTesteurAvecUsage: 3, moyenneSecondes: 170 })
    expect(b.rapports).toEqual({ total: 3, noteMoyenne: 3.7, problemes: 1, avisDetailles: 1 })
    expect(b.versionsApp).toEqual([
      { version: '1.0.2', rapports: 2, premierJour: 1, dernierJour: 1 },
      { version: '1.0.3', rapports: 1, premierJour: 2, dernierJour: 2 },
    ])
    expect(b.appareils).toMatchObject({ modeles: 12, versionsAndroid: ['14'] })
    const panier = b.themes.find((t) => t.fonctionnalite === 'Panier')
    expect(panier).toMatchObject({ rapports: 3, problemes: [{ jourCampagne: 1, versionApp: '1.0.2', fonctionnalites: ['Panier'], commentaire: 'Le panier se vide quand je quitte l’app.' }] })
    expect(b.themes.find((t) => t.fonctionnalite === 'Recherche de produits').avis).toHaveLength(1)

    const [test1, app, prod] = r.brouillon.parties
    expect(r.brouillon.parties.map((p) => p.titre)).toEqual(['À propos de votre test fermé', 'À propos de votre application', 'Préparation pour la production'])
    const reponse = (partie, id) => partie.questions.find((q) => q.id === id).reponse
    expect(reponse(test1, 'recrutement')).toContain('15 testeurs ont rejoint le test fermé, 3 ont installé l\'app depuis le Play Store et 2 l\'ont testée au moins 14 jours.')
    expect(reponse(test1, 'engagement')).toContain('8 min au total, soit 2 min en moyenne')
    expect(reponse(test1, 'engagement')).toContain('3 rapports quotidiens (note moyenne 3,7 sur 5)')
    expect(reponse(test1, 'engagement')).toContain('Versions de l\'app testées : 1.0.2 et 1.0.3.')
    expect(reponse(test1, 'retours')).toContain('- Jour 1, version 1.0.2 : « Le panier se vide quand je quitte l’app. »')
    // Ce que Nakayo ne sait pas reste à compléter par le développeur.
    for (const id of ['public', 'valeur', 'installations']) expect(reponse(app, id)).toMatch(/^\[À compléter/)
    expect(reponse(app, 'public')).toContain(APP.description)
    expect(reponse(prod, 'changements')).toContain('[À compléter')
    expect(reponse(prod, 'changements')).toContain('1.0.2 (à partir du jour 1), puis 1.0.3 (à partir du jour 2)')
    expect(reponse(prod, 'pret')).toMatch(/^2 testeurs ont utilisé l'app pendant au moins 14 jours/)

    const fichier = await pdf()
    expect(fichier.status).toBe(200)
    expect(fichier.headers['content-type']).toBe('application/pdf')
    expect(fichier.headers['content-disposition']).toBe('attachment; filename="rapport-nakayo-bj.studioawa.marche.pdf"')
    const texte = fichier.body.toString('latin1')
    expect(texte.startsWith('%PDF-1.4')).toBe(true)
    expect(texte.match(/\/Type \/Page /g).length).toBeGreaterThanOrEqual(2)
    expect(texte).toContain('Rapport de fin de test ferm')
  })

  it('le développeur est prévenu par email une seule fois, au 14e jour', async () => {
    test.avancer(12 * JOUR)
    test.emails.vider()
    let planificateur = demarrerVerificationNocturne(deps())
    await planificateur.premier
    planificateur.arreter()
    expect(test.emails.envoyes.filter((m) => m.a === 'awa@studio.bj')).toEqual([])

    test.avancer(JOUR)
    planificateur = demarrerVerificationNocturne(deps())
    await planificateur.premier
    planificateur.arreter()
    planificateur = demarrerVerificationNocturne(deps())
    await planificateur.premier
    planificateur.arreter()
    const recus = test.emails.envoyes.filter((m) => m.a === 'awa@studio.bj')
    expect(recus).toHaveLength(1)
    expect(recus[0].sujet).toBe('Votre rapport de fin de test est prêt : « Marché Facile »')
    expect(recus[0].texte).toContain(`/mon-compte/apps/${appId}/campagne`)
  })

  it('le développeur indique la décision de Google', async () => {
    test.avancer(13 * JOUR)
    expect((await decision({ decision: 'peut-etre' })).body.erreur.champs).toEqual({ decision: 'valeur_inconnue' })
    expect((await decision({ decision: 'acceptee', le: '2026-12-40' })).body.erreur.champs).toEqual({ le: 'format_invalide' })
    expect((await decision({ decision: 'acceptee', le: '2027-01-01' })).body.erreur.champs).toEqual({ le: 'format_invalide' })
    const r = await decision({ decision: 'refusee', le: '2026-11-25' })
    expect(r.status).toBe(200)
    expect(r.body.decisionGoogle).toMatchObject({ decision: 'refusee', le: '2026-11-25' })
    expect((await decision({ decision: 'acceptee' })).body.decisionGoogle).toMatchObject({ decision: 'acceptee', le: null })
    expect((await rapport()).body.rapport.decisionGoogle).toMatchObject({ decision: 'acceptee', le: null })
  })

  it('réservé au développeur de l’app', async () => {
    await creerUtilisateur({ email: 'autre@studio.bj', statut: 'valide' })
    const autre = await connecter('autre@studio.bj')
    expect((await request(test.app).get(`/api/apps/${appId}/campagne/rapport`).set('Cookie', autre)).status).toBe(404)
    expect((await request(test.app).put(`/api/apps/${appId}/campagne/decision-google`).set('Cookie', autre).send({ decision: 'acceptee' })).status).toBe(404)
  })
})
