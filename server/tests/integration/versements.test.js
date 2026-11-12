import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { APP, cookieSession, creerTesteursValides, creerUtilisateur } from '../fabriques.js'
import { creerAppTest, pool, viderBase } from '../outils.js'
import { signer } from '../../src/services/paiements.js'
import { verifierJour } from '../../src/services/verificationQuotidienne.js'
import { traiterVersements } from '../../src/services/versements.js'

const TOUT = ['testeurs_ajoutes', 'fiche_complete', 'version_publiee', 'pays_coches', 'pas_de_test_interne', 'mises_a_jour_prevues']
const SECRET = 'secret-webhook-developpement'
const JOUR = 24 * 60 * 60 * 1000
const HEURE = 60 * 60 * 1000
let test
let admin
let momo
let affectations

// Fournisseur de test : répond selon `reponses` (une par appel, la dernière se répète).
function creerMomoTest(reponses = [{ statut: 'verse' }]) {
  const appels = []
  return {
    appels,
    reponses,
    async verser(demande) {
      appels.push(demande)
      const reponse = this.reponses[Math.min(appels.length - 1, this.reponses.length - 1)]
      if (reponse instanceof Error) throw reponse
      return { referenceFournisseur: `AGR-${appels.length}`, ...reponse }
    },
  }
}

const deps = () => test.app.locals.deps
const traiter = () => traiterVersements(deps())
const versements = async () => (await pool.query('SELECT * FROM versements ORDER BY id')).rows

async function connecter(email) {
  return cookieSession(await request(test.app).post('/api/auth/connexion').send({ email, motDePasse: 'motdepasse-valide' }))
}

function webhook(corps, signature) {
  const brut = JSON.stringify(corps)
  return request(test.app)
    .post('/api/versements/webhook/agregateur')
    .set('Content-Type', 'application/json')
    .set('X-Nakayo-Signature', signature ?? `sha256=${signer(brut, SECRET)}`)
    .send(brut)
}

// Campagne de 15 testeurs, puis clôture à J16. Les 3 premiers testeurs ont leurs 14 jours,
// le 4e n'en a que 13, le 5e a été remplacé, le 6e n'a jamais confirmé son inscription.
async function cloturerCampagne() {
  await pool.query('UPDATE affectations SET inscription_confirmee_le = $2, installation_confirmee_le = $2, jours_valides = 14 WHERE id = ANY($1)', [
    affectations.slice(0, 5),
    deps().maintenant(),
  ])
  await pool.query('UPDATE affectations SET jours_valides = 13 WHERE id = $1', [affectations[3]])
  await pool.query(`UPDATE affectations SET statut = 'remplacee', remplacee_le = $2 WHERE id = $1`, [affectations[4], deps().maintenant()])
  await pool.query('UPDATE affectations SET jours_valides = 14 WHERE id = $1', [affectations[5]])
  test.avancer(16 * JOUR)
  await verifierJour(deps(), { jour: '2026-11-27', maintenant: deps().maintenant() })
  // Le 4e testeur, à 13 jours, a reçu le SMS de remise à zéro de la nuit.
  test.sms.vider()
}

async function preparer(reponses) {
  await viderBase()
  momo = creerMomoTest(reponses)
  test = creerAppTest({ maintenant: '2026-11-12T09:00:00Z', config: { groupeTesteurs: 'testeurs@nakayo.test' }, momo })
  await creerUtilisateur({ email: 'awa@studio.bj', statut: 'valide' })
  await creerUtilisateur({ email: 'admin@nakayo.bj', role: 'admin', statut: 'valide' })
  const dev = await connecter('awa@studio.bj')
  admin = await connecter('admin@nakayo.bj')
  await creerTesteursValides(15)
  const id = (await request(test.app).post('/api/apps').set('Cookie', dev).send(APP)).body.app.id
  const { reference } = (await request(test.app).post(`/api/apps/${id}/paiements`).set('Cookie', dev).send({ moyen: 'carte' })).body.paiement
  await request(test.app).post(`/api/paiements/${reference}/simulation`).set('Cookie', dev).send({ resultat: 'reussi' })
  await request(test.app).post(`/api/admin/apps/${id}/validation`).set('Cookie', admin)
  await request(test.app).put(`/api/apps/${id}/preparation`).set('Cookie', dev).send({ elements: TOUT })
  await request(test.app).post(`/api/apps/${id}/campagne`).set('Cookie', dev)
  affectations = (await pool.query('SELECT id FROM affectations ORDER BY id')).rows.map((r) => r.id)
  test.sms.vider()
  test.emails.vider()
}

const testeurDe = async (affectationId) => {
  const { rows } = await pool.query(
    `SELECT u.telephone, p.numero_momo, p.operateur_momo FROM affectations a
       JOIN utilisateurs u ON u.id = a.testeur_id JOIN profils_testeurs p ON p.utilisateur_id = u.id WHERE a.id = $1`,
    [affectationId],
  )
  return rows[0]
}

describe('versements à la clôture (US-22)', () => {
  beforeEach(() => preparer())

  it('paie 500 FCFA aux seuls testeurs qui ont leurs 14 jours et sont restés inscrits, puis envoie un SMS', async () => {
    await cloturerCampagne()
    const crees = await versements()
    expect(crees.map((v) => v.affectation_id)).toEqual(affectations.slice(0, 3))
    expect(crees[0]).toMatchObject({ montant: 500, devise: 'XOF', statut: 'a_verser', tentatives: 0 })

    expect(await traiter()).toEqual({ tentes: 3, verses: 3, enCours: 0, echecs: 0, alertes: 0 })
    const premier = await testeurDe(affectations[0])
    expect(momo.appels[0]).toEqual({
      reference: crees[0].reference,
      numero: premier.numero_momo,
      operateur: premier.operateur_momo,
      montant: 500,
      devise: 'XOF',
    })
    expect((await versements())[0]).toMatchObject({ statut: 'verse', tentatives: 1, reference_fournisseur: 'AGR-1' })

    const sms = test.sms.dernierPour(premier.telephone)
    expect(sms.texte).toBe(
      `Nakayo : 500 FCFA vous ont été versés sur votre compte ${premier.operateur_momo === 'mtn' ? 'MTN MoMo' : 'Moov Money'} ` +
        `(•••• ${premier.numero_momo.slice(-2)}) pour votre test de « Marché Facile ». Merci pour vos 14 jours de test !`,
    )
    expect(test.sms.envoyes).toHaveLength(3)
  })

  it('ne crée ni ne paie rien deux fois : vérification rejouée, passage suivant', async () => {
    await cloturerCampagne()
    await traiter()
    await verifierJour(deps(), { jour: '2026-11-27', maintenant: deps().maintenant() })
    expect(await traiter()).toMatchObject({ tentes: 0 })
    expect(await versements()).toHaveLength(3)
    expect(momo.appels).toHaveLength(3)
  })

  it('sans fournisseur branché, les versements attendent', async () => {
    deps().momo = null
    await cloturerCampagne()
    expect(await traiter()).toMatchObject({ tentes: 0 })
    expect((await versements()).every((v) => v.statut === 'a_verser')).toBe(true)
  })
})

describe('échecs et nouvelles tentatives (US-22)', () => {
  beforeEach(() => preparer([{ statut: 'echoue', motif: 'compte_inconnu' }]))

  it('3 nouvelles tentatives espacées, puis abandon et alerte de l’admin, qui peut relancer', async () => {
    await cloturerCampagne()
    await pool.query('DELETE FROM versements WHERE affectation_id <> $1', [affectations[0]])

    expect(await traiter()).toMatchObject({ tentes: 1, echecs: 1, alertes: 0 })
    let [v] = await versements()
    expect(v).toMatchObject({ statut: 'a_verser', tentatives: 1, dernier_motif: 'compte_inconnu' })
    expect(v.prochaine_tentative_le.getTime() - deps().maintenant().getTime()).toBe(HEURE)

    // Pas de nouvelle tentative avant l'heure.
    expect(await traiter()).toMatchObject({ tentes: 0 })
    for (const attente of [HEURE, 4 * HEURE, 24 * HEURE]) {
      test.avancer(attente)
      await traiter()
    }
    ;[v] = await versements()
    expect(v).toMatchObject({ statut: 'echoue', tentatives: 4, prochaine_tentative_le: null })
    expect(v.alerte_le).not.toBeNull()
    expect(momo.appels).toHaveLength(4)
    expect(test.sms.envoyes).toEqual([])
    const alerte = test.emails.dernierPour('admin@nakayo.bj')
    expect(alerte.sujet).toBe(`Versement testeur en échec : ${v.reference}`)
    expect(alerte.texte).toContain('a échoué 4 fois')
    expect(alerte.texte).toContain('Dernier motif : compte_inconnu')

    const liste = await request(test.app).get('/api/admin/versements').set('Cookie', admin)
    expect(liste.status).toBe(200)
    expect(liste.body.versements).toHaveLength(1)
    expect(liste.body.versements[0]).toMatchObject({ reference: v.reference, statut: 'echoue', tentatives: 4, montantLisible: '500 FCFA' })
    expect(liste.body.versements[0].testeur.numeroMomo).toBe(v.numero_momo)

    // Le testeur a corrigé son compte : l'admin relance, le versement part tout de suite.
    momo.reponses = [{ statut: 'verse' }]
    const relance = await request(test.app).post(`/api/admin/versements/${v.reference}/relance`).set('Cookie', admin)
    expect(relance.status).toBe(200)
    expect(relance.body.versement).toMatchObject({ statut: 'verse', tentatives: 1 })
    expect(test.sms.envoyes).toHaveLength(1)

    const encore = await request(test.app).post(`/api/admin/versements/${v.reference}/relance`).set('Cookie', admin)
    expect(encore.status).toBe(409)
  })

  it('un fournisseur injoignable compte comme un échec', async () => {
    momo.reponses = [new Error('ECONNRESET')]
    await cloturerCampagne()
    expect(await traiter()).toMatchObject({ tentes: 3, echecs: 3 })
    expect((await versements())[0]).toMatchObject({ statut: 'a_verser', dernier_motif: 'fournisseur_injoignable' })
  })

  it('les routes admin sont réservées aux admins et vérifient le filtre', async () => {
    const dev = await connecter('awa@studio.bj')
    expect((await request(test.app).get('/api/admin/versements').set('Cookie', dev)).status).toBe(403)
    expect((await request(test.app).get('/api/admin/versements?statut=perdu').set('Cookie', admin)).status).toBe(422)
    expect((await request(test.app).post('/api/admin/versements/VER-0000000000000000/relance').set('Cookie', admin)).status).toBe(404)
  })
})

describe('confirmation par webhook (US-22)', () => {
  beforeEach(() => preparer([{ statut: 'en_cours' }]))

  it('un versement en cours est confirmé par l’agrégateur, une seule fois', async () => {
    await cloturerCampagne()
    expect(await traiter()).toMatchObject({ tentes: 3, enCours: 3 })
    const [v] = await versements()
    expect(v.statut).toBe('en_cours')
    expect(test.sms.envoyes).toEqual([])

    expect((await webhook({ reference: v.reference, statut: 'verse' }, 'sha256=faux')).status).toBe(401)
    const r = await webhook({ reference: v.reference, statut: 'verse', referenceFournisseur: 'AGR-FINAL' })
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ recu: true, statut: 'verse' })
    expect((await versements())[0]).toMatchObject({ statut: 'verse', reference_fournisseur: 'AGR-FINAL' })
    expect(test.sms.envoyes).toHaveLength(1)

    await webhook({ reference: v.reference, statut: 'verse' })
    expect(test.sms.envoyes).toHaveLength(1)
    // Un passage ne reprend pas un versement en attente de confirmation.
    expect(await traiter()).toMatchObject({ tentes: 0 })
  })

  it('un échec annoncé par webhook programme une nouvelle tentative', async () => {
    await cloturerCampagne()
    await traiter()
    const [v] = await versements()
    await webhook({ reference: v.reference, statut: 'echoue', motif: 'solde_agregateur_insuffisant' })
    expect((await versements())[0]).toMatchObject({ statut: 'a_verser', dernier_motif: 'solde_agregateur_insuffisant' })
    expect((await webhook({ reference: 'VER-INCONNU', statut: 'verse' })).status).toBe(404)
    expect((await webhook({ reference: v.reference, statut: 'perdu' })).status).toBe(400)
  })
})
