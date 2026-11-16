import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { APP, cookieSession, creerTesteursValides, creerUtilisateur } from '../fabriques.js'
import { creerAppTest, pool, viderBase } from '../outils.js'
import { MOTIF_AUTOMATIQUE, remplacerInactifs } from '../../src/services/remplacementsAuto.js'

// US-27 : remplacement automatique des testeurs inactifs depuis 2 jours (docs/remplacement-automatique.md).
const TOUT = ['testeurs_ajoutes', 'fiche_complete', 'version_publiee', 'pays_coches', 'pas_de_test_interne', 'mises_a_jour_prevues']
let test
let affectations
let appId

// La campagne démarre le 12/11 à 10 h (Bénin) : le jour N de la campagne est le (11 + N)/11.
const nuitDuJour = (n) => new Date(Date.UTC(2026, 10, 11 + n, 0, 10) - 60 * 60 * 1000)
const jourDate = (n) => `2026-11-${String(11 + n).padStart(2, '0')}`
const passer = (n) => remplacerInactifs(test.app.locals.deps, { maintenant: nuitDuJour(n) })

async function valider(ids, jours) {
  for (const a of ids) {
    for (const jour of jours) {
      await pool.query(
        `INSERT INTO journees (affectation_id, jour, connexion, usage_secondes, rapport, valide, verifie_le) VALUES ($1, $2, true, 200, true, true, now())`,
        [a, jourDate(jour)],
      )
    }
  }
}

const etat = async () =>
  (await pool.query(`SELECT a.id, a.statut, a.motif_remplacement, a.remplacee_par, p.gmail FROM affectations a JOIN profils_testeurs p ON p.utilisateur_id = a.testeur_id WHERE a.app_id = $1 ORDER BY a.id`, [appId])).rows
const finPrevue = async () => (await pool.query('SELECT fin_prevue_le FROM campagnes')).rows[0].fin_prevue_le

beforeEach(async () => {
  await viderBase()
  test = creerAppTest({ maintenant: '2026-11-12T09:00:00Z' })
  await creerUtilisateur({ email: 'awa@studio.bj', statut: 'valide' })
  await creerUtilisateur({ email: 'admin@nakayo.bj', role: 'admin', statut: 'valide' })
  const connexion = (email) => request(test.app).post('/api/auth/connexion').send({ email, motDePasse: 'motdepasse-valide' })
  const dev = cookieSession(await connexion('awa@studio.bj'))
  const admin = cookieSession(await connexion('admin@nakayo.bj'))
  await creerTesteursValides(15)
  appId = (await request(test.app).post('/api/apps').set('Cookie', dev).send(APP)).body.app.id
  const { reference } = (await request(test.app).post(`/api/apps/${appId}/paiements`).set('Cookie', dev).send({ moyen: 'carte' })).body.paiement
  await request(test.app).post(`/api/paiements/${reference}/simulation`).set('Cookie', dev).send({ resultat: 'reussi' })
  await request(test.app).post(`/api/admin/apps/${appId}/validation`).set('Cookie', admin)
  await request(test.app).put(`/api/apps/${appId}/preparation`).set('Cookie', dev).send({ elements: TOUT })
  expect((await request(test.app).post(`/api/apps/${appId}/campagne`).set('Cookie', dev)).status).toBe(201)
  affectations = (await pool.query('SELECT id FROM affectations ORDER BY id')).rows.map((r) => r.id)
  await pool.query('UPDATE affectations SET inscription_confirmee_le = now(), installation_confirmee_le = now()')
  // Deux testeurs disponibles pour les remplacements, ajoutés après le démarrage.
  await creerTesteursValides(2, { debut: 15 })
  test.emails.vider()
  test.sms.vider()
})

describe('remplacement automatique (US-27)', () => {
  it('remplace les inactifs au jour 3, prévient chacun et prolonge la campagne sans frais', async () => {
    const finInitiale = await finPrevue()
    await valider(affectations.slice(0, 13), [1, 2])
    expect(await passer(2)).toEqual({ remplaces: 0, manquants: 0 })

    expect(await passer(3)).toEqual({ remplaces: 2, manquants: 0 })
    const lignes = await etat()
    const remplaces = lignes.filter((l) => l.statut === 'remplacee')
    expect(remplaces.map((l) => l.id)).toEqual(affectations.slice(13))
    expect(remplaces.every((l) => l.motif_remplacement === MOTIF_AUTOMATIQUE && l.remplacee_par)).toBe(true)
    expect(lignes.filter((l) => l.statut === 'active')).toHaveLength(15)

    // Campagne prolongée : 16 jours complets à partir du remplacement.
    expect((await finPrevue()).getTime()).toBe(nuitDuJour(3).getTime() + 16 * 24 * 60 * 60 * 1000)
    expect((await finPrevue()) > finInitiale).toBe(true)

    const email = test.emails.dernierPour('awa@studio.bj')
    expect(email.sujet).toBe('« Marché Facile » : testeurs remplacés')
    expect(email.texte).toContain('2 testeurs de « Marché Facile » ne testaient plus depuis 2 jours')
    expect(email.texte).toContain('- testeur15@gmail.com')
    expect(email.texte).toContain('- testeur16@gmail.com')
    expect(email.texte).toContain('la campagne est prolongée jusqu’au 30 novembre, sans frais')
    expect(test.sms.envoyes.map((m) => m.texte.slice(0, 40))).toHaveLength(4)
    expect(test.sms.envoyes.filter((m) => m.texte.includes('un autre testeur vous remplace'))).toHaveLength(2)
  })

  it('laisse 2 jours aux remplaçants, puis signale quand plus personne n’est disponible', async () => {
    await valider(affectations.slice(0, 13), [1, 2, 3, 4])
    await passer(3)
    // Jour 4 : les remplaçants arrivés la veille ne sont pas jugés.
    expect(await passer(4)).toEqual({ remplaces: 0, manquants: 0 })
    // Jour 5 : ils ne se sont jamais inscrits ; plus aucun testeur disponible.
    test.emails.vider()
    expect(await passer(5)).toEqual({ remplaces: 0, manquants: 2 })
    expect(test.emails.dernierPour('awa@studio.bj').texte).toContain('Aucun testeur n’était disponible pour remplacer 2 testeurs inactifs')
  })

  it('ne remplace jamais un testeur qui a ses 14 jours', async () => {
    await pool.query('UPDATE affectations SET jours_valides = 14')
    expect(await passer(16)).toEqual({ remplaces: 0, manquants: 0 })
  })
})
