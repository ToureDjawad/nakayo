import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { APP, APPAREIL, cookieSession, creerTesteur, creerTesteursValides, creerUtilisateur, FORMULAIRE_TESTEUR, JPEG, PNG } from '../fabriques.js'
import { creerAppTest, pool, viderBase } from '../outils.js'
import { verifierJour } from '../../src/services/verificationQuotidienne.js'

// US-39 : parrainage entre testeurs (docs/api-parrainage.md).
const TOUT = ['testeurs_ajoutes', 'fiche_complete', 'version_publiee', 'pays_coches', 'pas_de_test_interne', 'mises_a_jour_prevues']
const JOUR = 24 * 60 * 60 * 1000
const TELEPHONE = '+2290197000000'
let test

beforeEach(async () => {
  await viderBase()
  test = creerAppTest({ maintenant: '2026-11-12T09:00:00Z' })
})

const bearer = (t) => ({ Authorization: `Bearer ${t.jeton}` })
const codeDe = async (t) => (await pool.query('SELECT code_parrainage FROM profils_testeurs WHERE utilisateur_id = $1', [t.id])).rows[0].code_parrainage
const lireParrainage = async (t) => (await request(test.app).get('/api/testeurs/moi/parrainage').set(bearer(t))).body.parrainage

async function inscrireAvecCode(codeParrainage) {
  await request(test.app).post('/api/auth/sms/envoi').send({ telephone: TELEPHONE })
  const { code } = test.sms.dernierPour(TELEPHONE)
  const { jetonInscription } = (await request(test.app).post('/api/auth/sms/verification').send({ telephone: TELEPHONE, code, appareil: APPAREIL })).body
  let r = request(test.app).post('/api/testeurs/inscription').set('Authorization', `Bearer ${jetonInscription}`)
  for (const [cle, valeur] of Object.entries({ ...FORMULAIRE_TESTEUR, codeParrainage })) r = r.field(cle, valeur)
  return r
    .field('appareil', JSON.stringify(APPAREIL))
    .attach('pieceIdentite', JPEG, { filename: 'piece.jpg', contentType: 'image/jpeg' })
    .attach('selfie', PNG, { filename: 'selfie.png', contentType: 'image/png' })
}

describe('code de parrainage à l’inscription', () => {
  it('relie le filleul à son parrain, même saisi en minuscules avec des espaces', async () => {
    const [parrain] = await creerTesteursValides(1, { debut: 50 })
    const code = await codeDe(parrain)
    const r = await inscrireAvecCode(` ${code.slice(0, 3).toLowerCase()} ${code.slice(3)} `)
    expect(r.status).toBe(201)
    const { rows } = await pool.query('SELECT parrain_id FROM profils_testeurs WHERE utilisateur_id = $1', [r.body.utilisateur.id])
    expect(String(rows[0].parrain_id)).toBe(parrain.id)

    expect(await lireParrainage(parrain)).toEqual({
      code,
      prime: { montant: 500, devise: 'XOF', montantLisible: '500 FCFA' },
      totalVerse: 0,
      totalVerseLisible: '0 FCFA',
      filleuls: [{ nom: 'Koffi A.', inscritLe: '2026-11-12T09:00:00.000Z', etat: 'compte_en_validation' }],
    })
  })

  it('refuse un code inconnu ou mal formé, sans créer le compte', async () => {
    const inconnu = await inscrireAvecCode('ZZZZ22')
    expect(inconnu.status).toBe(422)
    expect(inconnu.body.erreur.champs).toEqual({ codeParrainage: 'inconnu' })
    test.avancer(61 * 1000)
    const malForme = await inscrireAvecCode('AB1')
    expect(malForme.body.erreur.champs).toEqual({ codeParrainage: 'format_invalide' })
    expect((await pool.query('SELECT count(*)::int AS n FROM utilisateurs')).rows[0].n).toBe(0)
  })

  it('le code est facultatif', async () => {
    expect((await inscrireAvecCode('')).status).toBe(201)
  })
})

describe('prime du parrain', () => {
  let dev
  let admin
  beforeEach(async () => {
    await creerUtilisateur({ email: 'awa@studio.bj', statut: 'valide' })
    await creerUtilisateur({ email: 'admin@nakayo.bj', role: 'admin', statut: 'valide' })
    const connexion = (email) => request(test.app).post('/api/auth/connexion').send({ email, motDePasse: 'motdepasse-valide' })
    dev = cookieSession(await connexion('awa@studio.bj'))
    admin = cookieSession(await connexion('admin@nakayo.bj'))
  })

  async function campagneMeneeAuBout(pkg) {
    const corps = { ...APP, package: pkg, lienTestFerme: `https://play.google.com/apps/testing/${pkg}` }
    const id = (await request(test.app).post('/api/apps').set('Cookie', dev).send(corps)).body.app.id
    const { reference } = (await request(test.app).post(`/api/apps/${id}/paiements`).set('Cookie', dev).send({ moyen: 'carte' })).body.paiement
    await request(test.app).post(`/api/paiements/${reference}/simulation`).set('Cookie', dev).send({ resultat: 'reussi' })
    await request(test.app).post(`/api/admin/apps/${id}/validation`).set('Cookie', admin)
    await request(test.app).put(`/api/apps/${id}/preparation`).set('Cookie', dev).send({ elements: TOUT })
    expect((await request(test.app).post(`/api/apps/${id}/campagne`).set('Cookie', dev)).status).toBe(201)
    await pool.query('UPDATE affectations SET inscription_confirmee_le = now(), installation_confirmee_le = now(), jours_valides = 14 WHERE app_id = $1', [id])
    test.avancer(16 * JOUR)
    const maintenant = test.app.locals.deps.maintenant()
    await verifierJour(test.app.locals.deps, { jour: maintenant.toISOString().slice(0, 10), maintenant })
  }

  it('est créée à la première campagne menée au bout du filleul, une seule fois', async () => {
    const [parrain, filleul] = await creerTesteursValides(15)
    await pool.query('UPDATE profils_testeurs SET parrain_id = $1 WHERE utilisateur_id = $2', [parrain.id, filleul.id])

    await campagneMeneeAuBout('bj.studioawa.un')
    const { rows } = await pool.query("SELECT testeur_id, montant, numero_momo FROM versements WHERE nature = 'parrainage'")
    expect(rows).toEqual([{ testeur_id: parrain.id, montant: 500, numero_momo: '+2290196000000' }])
    expect((await lireParrainage(parrain)).filleuls[0].etat).toBe('prime_en_paiement')

    // Le portefeuille du parrain montre la prime, à côté de sa paie de campagne.
    const portefeuille = (await request(test.app).get('/api/testeurs/moi/portefeuille').set(bearer(parrain))).body.portefeuille
    expect(portefeuille.enAttente).toContainEqual(expect.objectContaining({ nature: 'parrainage', appNom: 'Prime de parrainage', montant: 500 }))

    await campagneMeneeAuBout('bj.studioawa.deux')
    expect((await pool.query("SELECT count(*)::int AS n FROM versements WHERE nature = 'parrainage'")).rows[0].n).toBe(1)
  })

  it('pas de prime si le parrain n’est plus validé', async () => {
    const [parrain, filleul] = await creerTesteursValides(16)
    await pool.query('UPDATE profils_testeurs SET parrain_id = $1 WHERE utilisateur_id = $2', [parrain.id, filleul.id])
    await pool.query("UPDATE utilisateurs SET statut = 'suspendu' WHERE id = $1", [parrain.id])
    await campagneMeneeAuBout('bj.studioawa.un')
    expect((await pool.query("SELECT count(*)::int AS n FROM versements WHERE nature = 'parrainage'")).rows[0].n).toBe(0)
  })

  it('un testeur ne peut pas être son propre parrain', async () => {
    const t = await creerTesteur({ statut: 'valide' })
    await expect(pool.query('UPDATE profils_testeurs SET parrain_id = $1 WHERE utilisateur_id = $1', [t.id])).rejects.toThrow()
  })
})
