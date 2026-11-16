import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { APP, cookieSession, creerTesteursValides, creerUtilisateur } from '../fabriques.js'
import { creerAppTest, pool, viderBase } from '../outils.js'
import { verifierJour } from '../../src/services/verificationQuotidienne.js'

// docs/api-offres.md §4 : offre Lancement Afrique sur devis (US-37).
const TOUT = ['testeurs_ajoutes', 'fiche_complete', 'version_publiee', 'pays_coches', 'pas_de_test_interne', 'mises_a_jour_prevues']
const JOUR = 24 * 60 * 60 * 1000
const BESOIN = {
  pays: ['BJ', 'TG'],
  langues: ['fr', 'fon'],
  profils: 'Commerçantes de marché, peu habituées aux applications.',
  scenarios: 'Créer un compte, ajouter trois produits, payer par Mobile Money sur un réseau lent.',
}
let test
let dev
let admin
let appId

const connecter = async (email) => cookieSession(await request(test.app).post('/api/auth/connexion').send({ email, motDePasse: 'motdepasse-valide' }))
const demander = (corps = BESOIN) => request(test.app).put(`/api/apps/${appId}/devis`).set('Cookie', dev).send(corps)
const lireDevis = () => request(test.app).get(`/api/apps/${appId}/devis`).set('Cookie', dev)
const proposer = (id, corps) => request(test.app).post(`/api/admin/devis/${id}/proposition`).set('Cookie', admin).send(corps)
const payer = (corps) => request(test.app).post(`/api/apps/${appId}/paiements`).set('Cookie', dev).send(corps)
const simuler = (reference) => request(test.app).post(`/api/paiements/${reference}/simulation`).set('Cookie', dev).send({ resultat: 'reussi' })

beforeEach(async () => {
  await viderBase()
  test = creerAppTest({ maintenant: '2026-11-13T09:00:00Z', config: { groupeTesteurs: 'testeurs@nakayo.test' } })
  await creerUtilisateur({ email: 'awa@studio.bj', nom: 'Studio Awa', statut: 'valide' })
  await creerUtilisateur({ email: 'admin@nakayo.bj', role: 'admin', statut: 'valide' })
  dev = await connecter('awa@studio.bj')
  admin = await connecter('admin@nakayo.bj')
  appId = (await request(test.app).post('/api/apps').set('Cookie', dev).send(APP)).body.app.id
})

describe('offre publique', () => {
  it('Lancement Afrique est ouverte, sur devis, avec son prix de départ et 20 testeurs', async () => {
    const { offres } = (await request(test.app).get('/api/offres')).body
    const afrique = offres.find((o) => o.code === 'afrique')
    expect(afrique).toMatchObject({
      surDevis: true,
      testeurs: 20,
      prix: { carte: { montant: 9900, devise: 'USD' }, mobile_money: { montant: 59400, devise: 'XOF' } },
    })
    expect(afrique).not.toHaveProperty('monteeEnGamme')
    expect(afrique).not.toHaveProperty('remuneration')
    expect(afrique).not.toHaveProperty('questionnaireTerrain')
  })
})

describe('besoin du développeur (§4.1)', () => {
  it('enregistre le besoin, visible sur l’app et dans la file de l’équipe', async () => {
    expect((await lireDevis()).body).toEqual({ devis: null })
    const r = await demander()
    expect(r.status).toBe(200)
    expect(r.body.devis).toMatchObject({ statut: 'demande', pays: ['BJ', 'TG'], langues: ['fr', 'fon'], prix: null, message: null })
    expect((await request(test.app).get(`/api/apps/${appId}`).set('Cookie', dev)).body.app.devis).toEqual({ statut: 'demande' })

    const file = (await request(test.app).get('/api/admin/devis').set('Cookie', admin)).body.devis
    expect(file).toHaveLength(1)
    expect(file[0]).toMatchObject({ app: { nom: 'Marché Facile' }, developpeur: { email: 'awa@studio.bj' }, scenarios: BESOIN.scenarios })
  })

  it('refuse un besoin incomplet ou des codes inconnus', async () => {
    const r = await demander({ pays: ['XX'], langues: [], profils: 'court', scenarios: '' })
    expect(r.status).toBe(422)
    expect(r.body.erreur.champs).toEqual({ pays: 'valeur_inconnue', langues: 'requis', profils: 'trop_court', scenarios: 'requis' })
  })

  it('le développeur n’accède pas à la file de l’équipe', async () => {
    expect((await request(test.app).get('/api/admin/devis').set('Cookie', dev)).status).toBe(403)
  })
})

describe('réponse de l’équipe et paiement (§4.2, §4.3)', () => {
  it('sans devis proposé, Lancement Afrique ne se paie pas', async () => {
    const r = await payer({ offre: 'afrique', moyen: 'carte' })
    expect(r.status).toBe(409)
    expect(r.body.erreur.code).toBe('devis_requis')
  })

  it('l’équipe propose un prix, le développeur le paie et l’app passe en Lancement Afrique', async () => {
    const id = (await demander()).body.devis.id
    expect((await proposer(id, { prixCarte: 5000, prixMobileMoney: 59400 })).body.erreur.champs).toEqual({ prixCarte: 'trop_petit' })

    const r = await proposer(id, { prixCarte: 14900, prixMobileMoney: 89400, message: 'Deux villes et le fon : 149 $.' })
    expect(r.status).toBe(200)
    expect(r.body.devis).toMatchObject({ statut: 'propose', prix: { carte: { montant: 14900 }, mobile_money: { montant: 89400 } } })
    const courriel = test.emails.dernierPour('awa@studio.bj')
    expect(courriel.sujet).toBe('Votre devis Lancement Afrique pour « Marché Facile »')
    expect(courriel.texte).toContain('149,00 $ US')
    expect(courriel.texte).toContain(`/mon-compte/apps/${appId}/devis`)
    expect((await proposer(id, { prixCarte: 9900, prixMobileMoney: 59400 })).body.erreur.code).toBe('deja_repondu')

    const paiement = await payer({ offre: 'afrique', moyen: 'mobile_money', numeroMomo: '+22997000001' })
    expect(paiement.status).toBe(201)
    expect(paiement.body.paiement).toMatchObject({ offre: 'afrique', montant: 89400, devise: 'XOF' })
    await simuler(paiement.body.paiement.reference)
    expect((await request(test.app).get(`/api/apps/${appId}`).set('Cookie', dev)).body.app).toMatchObject({ statut: 'en_verification', offre: 'afrique' })

    // Plus de devis à modifier ni de montée vers Pro une fois l'app payée.
    expect((await demander()).body.erreur.code).toBe('statut_incompatible')
    const montee = await request(test.app).post(`/api/apps/${appId}/montee-en-gamme`).set('Cookie', dev).send({ moyen: 'carte' })
    expect(montee.body.erreur.code).toBe('deja_dans_cette_offre')
  })

  it('l’équipe refuse avec un message ; le développeur peut corriger son besoin', async () => {
    const id = (await demander()).body.devis.id
    expect((await request(test.app).post(`/api/admin/devis/${id}/refus`).set('Cookie', admin).send({})).status).toBe(422)
    const r = await request(test.app).post(`/api/admin/devis/${id}/refus`).set('Cookie', admin).send({ message: 'Pas encore de testeurs au Togo.' })
    expect(r.body.devis).toMatchObject({ statut: 'refuse', message: 'Pas encore de testeurs au Togo.' })
    expect(test.emails.dernierPour('awa@studio.bj').texte).toContain('Pas encore de testeurs au Togo.')

    const corrige = await demander({ ...BESOIN, pays: ['BJ'] })
    expect(corrige.body.devis).toMatchObject({ id, statut: 'demande', pays: ['BJ'], message: null })
  })

  it('une montée en gamme ne peut pas viser Lancement Afrique', async () => {
    const r = await request(test.app).post(`/api/apps/${appId}/montee-en-gamme`).set('Cookie', dev).send({ offre: 'afrique', moyen: 'carte' })
    expect(r.status).toBe(422)
    expect(r.body.erreur.champs).toEqual({ offre: 'valeur_inconnue' })
  })
})

describe('campagne Lancement Afrique (§4.4)', () => {
  it('affecte 20 testeurs et les paie 1 500 FCFA à la clôture', async () => {
    await creerTesteursValides(24)
    const id = (await demander()).body.devis.id
    await proposer(id, { prixCarte: 9900, prixMobileMoney: 59400 })
    await simuler((await payer({ offre: 'afrique', moyen: 'carte' })).body.paiement.reference)
    await request(test.app).post(`/api/admin/apps/${appId}/validation`).set('Cookie', admin)
    expect(test.emails.dernierPour('awa@studio.bj').texte).toContain('20 testeurs seront affectés')
    await request(test.app).put(`/api/apps/${appId}/preparation`).set('Cookie', dev).send({ elements: TOUT })
    expect((await request(test.app).post(`/api/apps/${appId}/campagne`).set('Cookie', dev)).status).toBe(201)

    const { rows } = await pool.query('SELECT testeurs_vises, (SELECT count(*)::int FROM affectations WHERE app_id = $1) AS affectes FROM campagnes WHERE app_id = $1', [appId])
    expect(rows[0]).toEqual({ testeurs_vises: 20, affectes: 20 })

    await pool.query('UPDATE affectations SET inscription_confirmee_le = now(), installation_confirmee_le = now(), jours_valides = 14 WHERE app_id = $1', [appId])
    test.avancer(16 * JOUR)
    await verifierJour(test.app.locals.deps, { jour: '2026-11-28', maintenant: test.app.locals.deps.maintenant() })
    const { rows: v } = await pool.query('SELECT DISTINCT montant FROM versements')
    expect(v).toEqual([{ montant: 1500 }])
  })
})

describe('questionnaire terrain et rapport de fin (§4.5)', () => {
  const RETOUR = { connexion: '3g', reseau: 'lent', telephone: 'fluide', langue: 'fr', comprehension: 4, commentaire: 'Les images chargent lentement en 3G au marché.' }
  const bearer = (t) => ({ Authorization: `Bearer ${t.jeton}` })

  async function campagneAfrique() {
    const testeurs = await creerTesteursValides(20)
    await pool.query('UPDATE appareils SET ram_mo = 8192')
    await pool.query('UPDATE appareils SET ram_mo = 2048 WHERE utilisateur_id = ANY($1)', [testeurs.slice(0, 5).map((t) => t.id)])
    const id = (await demander()).body.devis.id
    await proposer(id, { prixCarte: 9900, prixMobileMoney: 59400 })
    await simuler((await payer({ offre: 'afrique', moyen: 'carte' })).body.paiement.reference)
    await request(test.app).post(`/api/admin/apps/${appId}/validation`).set('Cookie', admin)
    await request(test.app).put(`/api/apps/${appId}/preparation`).set('Cookie', dev).send({ elements: TOUT })
    await request(test.app).post(`/api/apps/${appId}/campagne`).set('Cookie', dev)
    return testeurs
  }
  const affectationDe = async (t) => (await request(test.app).get('/api/testeurs/moi/apps').set(bearer(t))).body.apps[0]
  const repondre = async (t, corps = RETOUR) => request(test.app).post(`/api/testeurs/moi/apps/${(await affectationDe(t)).id}/terrain`).set(bearer(t)).send(corps)

  it('s’ouvre au 7e jour, une seule fois, avec des réponses valides', async () => {
    const [t] = await campagneAfrique()
    expect((await affectationDe(t)).questionnaireTerrain).toEqual({ envoye: false, ouvert: false, ouvertLe: 7 })
    expect((await repondre(t)).body.erreur.code).toBe('trop_tot')

    test.avancer(6 * JOUR)
    expect((await affectationDe(t)).questionnaireTerrain.ouvert).toBe(true)
    const invalide = await repondre(t, { connexion: '5g', comprehension: 9 })
    expect(invalide.body.erreur.champs).toEqual({ connexion: 'valeur_inconnue', reseau: 'requis', telephone: 'requis', langue: 'requis', comprehension: 'format_invalide' })
    const r = await repondre(t)
    expect(r.status).toBe(201)
    expect(r.body.app.questionnaireTerrain).toEqual({ envoye: true, ouvert: false, ouvertLe: 7 })
    expect((await repondre(t)).body.erreur.code).toBe('deja_envoye')
  })

  it('le rapport de fin résume le réseau, les petits téléphones et la langue', async () => {
    const testeurs = await campagneAfrique()
    test.avancer(6 * JOUR)
    await repondre(testeurs[0], { ...RETOUR, telephone: 'lent' })
    await repondre(testeurs[1], { ...RETOUR, connexion: '4g', reseau: 'fluide', langue: 'en', comprehension: 5, commentaire: undefined })
    await repondre(testeurs[10], { ...RETOUR, connexion: '2g', reseau: 'inutilisable', comprehension: 3 })

    test.avancer(8 * JOUR)
    const r = await request(test.app).get(`/api/apps/${appId}/campagne/rapport`).set('Cookie', dev)
    expect(r.body.rapport.bilan.terrain).toEqual({
      reponses: 3,
      reseau: { fluide: 1, lent: 1, inutilisable: 1 },
      parConnexion: [
        { connexion: '4g', reponses: 1, fluide: 1, lent: 0, inutilisable: 0 },
        { connexion: '3g', reponses: 1, fluide: 0, lent: 1, inutilisable: 0 },
        { connexion: '2g', reponses: 1, fluide: 0, lent: 0, inutilisable: 1 },
      ],
      telephone: { fluide: 2, lent: 1, inutilisable: 0 },
      petitsTelephones: { reponses: 2, fluide: 1, lent: 1, inutilisable: 0 },
      langues: [
        { langue: 'fr', reponses: 2, comprehensionMoyenne: 3.5 },
        { langue: 'en', reponses: 1, comprehensionMoyenne: 5 },
      ],
      comprehensionMoyenne: 4,
      commentaires: [RETOUR.commentaire, RETOUR.commentaire],
    })
    const pdf = await request(test.app).get(`/api/apps/${appId}/campagne/rapport.pdf`).set('Cookie', dev).buffer(true)
    expect(pdf.status).toBe(200)
  })

  it('hors Lancement Afrique, ni questionnaire ni section terrain', async () => {
    const [t] = await creerTesteursValides(15)
    await simuler((await payer({ offre: 'pro', moyen: 'carte' })).body.paiement.reference)
    await request(test.app).post(`/api/admin/apps/${appId}/validation`).set('Cookie', admin)
    await request(test.app).put(`/api/apps/${appId}/preparation`).set('Cookie', dev).send({ elements: TOUT })
    await request(test.app).post(`/api/apps/${appId}/campagne`).set('Cookie', dev)
    test.avancer(6 * JOUR)
    expect((await affectationDe(t)).questionnaireTerrain).toBeNull()
    expect((await repondre(t)).status).toBe(403)
  })
})
