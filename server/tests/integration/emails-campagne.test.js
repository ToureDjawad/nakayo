import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { APP, cookieSession, creerTesteursValides, creerUtilisateur } from '../fabriques.js'
import { creerAppTest, pool, viderBase } from '../outils.js'
import { envoyerEmailsCampagnes } from '../../src/services/emailsCampagne.js'

// US-26 : emails au développeur aux étapes clés de la campagne (docs/emails-campagne.md).
const TOUT = ['testeurs_ajoutes', 'fiche_complete', 'version_publiee', 'pays_coches', 'pas_de_test_interne', 'mises_a_jour_prevues']
let test
let affectations

// La campagne démarre le 12/11 à 10 h (Bénin) : le jour N de la campagne est le (11 + N)/11.
const nuitDuJour = (n) => new Date(Date.UTC(2026, 10, 11 + n, 0, 10) - 60 * 60 * 1000)
const jourDate = (n) => `2026-11-${String(11 + n).padStart(2, '0')}`
const recus = () => test.emails.envoyes.filter((m) => m.a === 'awa@studio.bj').map((m) => m.sujet)
const passer = (n) => envoyerEmailsCampagnes(test.app.locals.deps, { maintenant: nuitDuJour(n) })

// Les `n` premiers testeurs valident les jours donnés ; tous sont inscrits au test.
async function journees(jours, n = 15) {
  for (const a of affectations.slice(0, n)) {
    for (const jour of jours) {
      await pool.query(
        `INSERT INTO journees (affectation_id, jour, connexion, usage_secondes, rapport, valide, verifie_le) VALUES ($1, $2, true, 200, true, true, now())
         ON CONFLICT DO NOTHING`,
        [a, jourDate(jour)],
      )
    }
  }
}

beforeEach(async () => {
  await viderBase()
  test = creerAppTest({ maintenant: '2026-11-12T09:00:00Z' })
  await creerUtilisateur({ email: 'awa@studio.bj', statut: 'valide' })
  await creerUtilisateur({ email: 'admin@nakayo.bj', role: 'admin', statut: 'valide' })
  const connexion = (email) => request(test.app).post('/api/auth/connexion').send({ email, motDePasse: 'motdepasse-valide' })
  const dev = cookieSession(await connexion('awa@studio.bj'))
  const admin = cookieSession(await connexion('admin@nakayo.bj'))
  await creerTesteursValides(15)
  const appId = (await request(test.app).post('/api/apps').set('Cookie', dev).send(APP)).body.app.id
  const { reference } = (await request(test.app).post(`/api/apps/${appId}/paiements`).set('Cookie', dev).send({ moyen: 'carte' })).body.paiement
  await request(test.app).post(`/api/paiements/${reference}/simulation`).set('Cookie', dev).send({ resultat: 'reussi' })
  await request(test.app).post(`/api/admin/apps/${appId}/validation`).set('Cookie', admin)
  await request(test.app).put(`/api/apps/${appId}/preparation`).set('Cookie', dev).send({ elements: TOUT })
  expect((await request(test.app).post(`/api/apps/${appId}/campagne`).set('Cookie', dev)).status).toBe(201)
  const { rows } = await pool.query('SELECT id FROM affectations ORDER BY id')
  affectations = rows.map((r) => r.id)
  await pool.query('UPDATE affectations SET inscription_confirmee_le = now(), installation_confirmee_le = now()')
  test.emails.vider()
})

describe('emails d’étapes (US-26)', () => {
  it('rappels de version à J5 et J10, mi-parcours à J7, une seule fois chacun', async () => {
    await journees([1, 2, 3, 4, 5, 6, 7, 8, 9])
    await passer(4)
    expect(recus()).toEqual([])
    await passer(5)
    await passer(5)
    expect(recus()).toEqual(['« Marché Facile » : publiez une nouvelle version avec vos corrections'])
    await passer(7)
    expect(recus()[1]).toBe('« Marché Facile » : la campagne est à mi-parcours')
    expect(test.emails.dernierPour('awa@studio.bj').texte).toContain('15 testeurs sur 15 sont actifs')
    await passer(10)
    await passer(11)
    expect(recus()).toHaveLength(3)
  })

  it('après un arrêt du serveur, n’envoie que l’étape la plus récente', async () => {
    await journees([7, 8, 9])
    await passer(10)
    expect(recus()).toEqual(['« Marché Facile » : publiez une nouvelle version avec vos corrections'])
    await passer(11)
    expect(recus()).toHaveLength(1)
  })

  it('alerte sous 13 testeurs actifs, puis de nouveau après un retour à la normale', async () => {
    // J3 : 12 testeurs ont validé les jours 1 et 2, les 3 autres n'ont rien fait.
    await journees([1, 2], 12)
    await passer(3)
    expect(recus()).toEqual(['« Marché Facile » : moins de 13 testeurs actifs'])
    expect(test.emails.dernierPour('awa@studio.bj').texte).toContain('Seuls 12 testeurs sur 15 sont actifs')
    await passer(3)
    expect(recus()).toHaveLength(1)

    // Retour à 15 actifs au jour 4, puis nouvelle chute au jour 6 : nouvelle alerte.
    await journees([3])
    await passer(4)
    await journees([4, 5], 10)
    await passer(6)
    expect(recus().filter((s) => s.includes('moins de 13'))).toHaveLength(2)
  })

  it('pas d’alerte pendant les 2 premiers jours pour des testeurs inscrits', async () => {
    await passer(2)
    expect(recus()).toEqual([])
  })
})
