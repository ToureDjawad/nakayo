import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { APP, APPAREIL, cookieSession, creerTesteursValides, creerUtilisateur, FORMULAIRE_TESTEUR, JPEG, PNG } from '../fabriques.js'
import { creerAppTest, pool, viderBase } from '../outils.js'
import { traiterVersements } from '../../src/services/versements.js'

// US-29 : suspension, bannissement, réactivation et journal des actions admin (docs/sanctions.md).
const TOUT = ['testeurs_ajoutes', 'fiche_complete', 'version_publiee', 'pays_coches', 'pas_de_test_interne', 'mises_a_jour_prevues']
const MOTIF = 'Rapports recopiés d’une app à l’autre.'
let test
let admin
let dev
let testeurs

const bearer = (t) => ({ Authorization: `Bearer ${t.jeton}` })
const sanction = (id, corps) => request(test.app).post(`/api/admin/comptes/${id}/sanction`).set('Cookie', admin).send(corps)

async function connexionSms(telephone, appareil = APPAREIL) {
  test.avancer(2 * 60 * 1000)
  await request(test.app).post('/api/auth/sms/envoi').send({ telephone })
  const { code } = test.sms.dernierPour(telephone)
  return request(test.app).post('/api/auth/sms/verification').send({ telephone, code, appareil })
}

beforeEach(async () => {
  await viderBase()
  test = creerAppTest({ maintenant: '2026-11-12T09:00:00Z', momo: { verser: async () => ({ statut: 'verse', referenceFournisseur: 'AGR-1' }) } })
  await creerUtilisateur({ email: 'awa@studio.bj', statut: 'valide' })
  await creerUtilisateur({ email: 'admin@nakayo.bj', role: 'admin', statut: 'valide' })
  const connexion = (email) => request(test.app).post('/api/auth/connexion').send({ email, motDePasse: 'motdepasse-valide' })
  dev = cookieSession(await connexion('awa@studio.bj'))
  admin = cookieSession(await connexion('admin@nakayo.bj'))
  testeurs = await creerTesteursValides(15)
})

describe('sanctions (US-29)', () => {
  it('suspension : motif exigé, déconnexion, gains retenus, puis réactivation', async () => {
    const [t] = testeurs
    expect((await sanction(t.id, { action: 'suspension' })).body.erreur.champs).toEqual({ motif: 'requis' })
    expect((await sanction(t.id, { action: 'pause', motif: MOTIF })).body.erreur.champs).toEqual({ action: 'valeur_inconnue' })

    // Un versement dû au testeur.
    const appId = (await request(test.app).post('/api/apps').set('Cookie', dev).send(APP)).body.app.id
    const { reference } = (await request(test.app).post(`/api/apps/${appId}/paiements`).set('Cookie', dev).send({ moyen: 'carte' })).body.paiement
    await request(test.app).post(`/api/paiements/${reference}/simulation`).set('Cookie', dev).send({ resultat: 'reussi' })
    await request(test.app).post(`/api/admin/apps/${appId}/validation`).set('Cookie', admin)
    await request(test.app).put(`/api/apps/${appId}/preparation`).set('Cookie', dev).send({ elements: TOUT })
    await request(test.app).post(`/api/apps/${appId}/campagne`).set('Cookie', dev)
    const { rows } = await pool.query('SELECT id, campagne_id FROM affectations WHERE testeur_id = $1', [t.id])
    await pool.query(
      `INSERT INTO versements (reference, affectation_id, campagne_id, testeur_id, montant, numero_momo, operateur_momo, prochaine_tentative_le, cree_le)
       VALUES ('VER-0000000000000001', $1, $2, $3, 3000, '+2290196000000', 'mtn', '2026-11-12T08:00:00Z', '2026-11-12T08:00:00Z')`,
      [rows[0].id, rows[0].campagne_id, t.id],
    )

    const r = await sanction(t.id, { action: 'suspension', motif: MOTIF })
    expect(r.status).toBe(200)
    expect(r.body.compte).toMatchObject({ statut: 'suspendu', motifSanction: MOTIF })
    expect(test.sms.dernierPour('+2290197000000').texte).toContain(MOTIF)
    expect((await request(test.app).get('/api/testeurs/moi').set(bearer(t))).status).toBe(401)
    expect((await connexionSms('+2290197000000', { ...APPAREIL, identifiant: 'app-0000' })).body.erreur.code).toBe('compte_suspendu')
    expect((await sanction(t.id, { action: 'suspension', motif: MOTIF })).status).toBe(409)

    await traiterVersements(test.app.locals.deps)
    expect((await pool.query('SELECT statut FROM versements')).rows[0].statut).toBe('a_verser')

    const reactive = await sanction(t.id, { action: 'reactivation' })
    expect(reactive.body.compte).toMatchObject({ statut: 'valide', motifSanction: null })
    expect((await connexionSms('+2290197000000', { ...APPAREIL, identifiant: 'app-0000' })).body.resultat).toBe('connecte')
    await traiterVersements(test.app.locals.deps)
    expect((await pool.query('SELECT statut FROM versements')).rows[0].statut).toBe('verse')
  })

  it('bannissement : numéro, téléphone et Mobile Money bloqués pour un nouveau compte', async () => {
    const [t] = testeurs
    expect((await sanction(t.id, { action: 'bannissement', motif: MOTIF })).body.compte.statut).toBe('banni')
    expect((await connexionSms('+2290197000000', { ...APPAREIL, identifiant: 'app-0000' })).body.erreur.code).toBe('compte_banni')

    // Autre numéro, même téléphone : refusé.
    expect((await connexionSms('+2290191111111', { ...APPAREIL, identifiant: 'app-0000' })).body.erreur.code).toBe('compte_banni')

    // Autre numéro et autre téléphone, mais même Mobile Money : refusé à l'inscription.
    const verif = await connexionSms('+2290192222222', { ...APPAREIL, identifiant: 'app-neuf' })
    let r = request(test.app).post('/api/testeurs/inscription').set('Authorization', `Bearer ${verif.body.jetonInscription}`)
    for (const [cle, valeur] of Object.entries({ ...FORMULAIRE_TESTEUR, numeroMomo: '+2290196000000', gmail: 'nouveau@gmail.com' })) r = r.field(cle, valeur)
    r = await r
      .field('appareil', JSON.stringify({ ...APPAREIL, identifiant: 'app-neuf' }))
      .attach('pieceIdentite', JPEG, { filename: 'piece.jpg', contentType: 'image/jpeg' })
      .attach('selfie', PNG, { filename: 'selfie.png', contentType: 'image/png' })
    expect(r.status).toBe(403)
    expect(r.body.erreur.code).toBe('compte_bloque')

    // Réactivation : les blocages sont levés.
    await sanction(t.id, { action: 'reactivation', motif: 'Erreur de notre part.' })
    expect((await connexionSms('+2290191111111', { ...APPAREIL, identifiant: 'app-0000' })).body.resultat).toBe('inscription')
  })

  it('un développeur banni ne peut plus se connecter ; un admin ne peut pas être sanctionné', async () => {
    const { rows } = await pool.query("SELECT id FROM utilisateurs WHERE email = 'awa@studio.bj'")
    await sanction(rows[0].id, { action: 'bannissement', motif: MOTIF })
    expect(test.emails.dernierPour('awa@studio.bj').sujet).toBe('Votre compte Nakayo est fermé')
    const r = await request(test.app).post('/api/auth/connexion').send({ email: 'awa@studio.bj', motDePasse: 'motdepasse-valide' })
    expect(r.body.erreur.code).toBe('compte_banni')
    const { rows: admins } = await pool.query("SELECT id FROM utilisateurs WHERE role = 'admin'")
    expect((await sanction(admins[0].id, { action: 'suspension', motif: MOTIF })).status).toBe(404)
  })

  it('journal des actions admin', async () => {
    await sanction(testeurs[0].id, { action: 'suspension', motif: MOTIF })
    await sanction(testeurs[0].id, { action: 'reactivation' })
    const r = await request(test.app).get('/api/admin/journal').set('Cookie', admin)
    expect(r.status).toBe(200)
    expect(r.body.total).toBe(2)
    expect(r.body.actions.map((a) => a.libelle)).toEqual(['Compte réactivé', 'Compte suspendu'])
    expect(r.body.actions[1]).toMatchObject({ cible: { type: 'compte', id: testeurs[0].id }, detail: MOTIF, admin: { nom: expect.any(String) } })
    expect((await request(test.app).get('/api/admin/journal').set('Cookie', dev)).status).toBe(403)
  })
})
