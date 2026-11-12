import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { APP, cookieSession, creerTesteursValides, creerUtilisateur, JPEG } from '../fabriques.js'
import { creerAppTest, pool, viderBase } from '../outils.js'
import { demarrerRappelsSms, envoyerRappelsSms, messageRappel } from '../../src/services/rappelsSoir.js'

const TOUT = ['testeurs_ajoutes', 'fiche_complete', 'version_publiee', 'pays_coches', 'pas_de_test_interne', 'mises_a_jour_prevues']
const RAPPORT = {
  actions: 'J’ai cherché du riz et ajouté deux articles au panier.',
  note: 4,
  bug: false,
  fonctionnalites: ['Panier'],
  versionApp: '1.0.3',
  position: { latitude: 6.36, longitude: 2.41 },
  retourDetaille: 'La recherche est rapide, mais le panier se vide quand je quitte l’app et il faut alors tout recommencer depuis le début.',
}
const JOUR = '2026-11-12'
let test
let affectations
let testeurs

const deps = () => test.app.locals.deps
const bearer = (i) => ({ Authorization: `Bearer ${testeurs[i].jeton}` })

async function connecter(email) {
  return cookieSession(await request(test.app).post('/api/auth/connexion').send({ email, motDePasse: 'motdepasse-valide' }))
}

async function telephone(i) {
  const { rows } = await pool.query('SELECT telephone FROM utilisateurs WHERE id = $1', [testeurs[i].id])
  return rows[0].telephone
}

// 21 h 30 au Bénin le jour du démarrage (avant le rappel de 22 h).
async function preparer(maintenant = '2026-11-12T20:30:00Z') {
  await viderBase()
  test = creerAppTest({ maintenant, config: { groupeTesteurs: 'testeurs@nakayo.test' } })
  await creerUtilisateur({ email: 'awa@studio.bj', statut: 'valide' })
  await creerUtilisateur({ email: 'admin@nakayo.bj', role: 'admin', statut: 'valide' })
  const dev = await connecter('awa@studio.bj')
  const admin = await connecter('admin@nakayo.bj')
  const crees = await creerTesteursValides(15)
  const id = (await request(test.app).post('/api/apps').set('Cookie', dev).send(APP)).body.app.id
  const { reference } = (await request(test.app).post(`/api/apps/${id}/paiements`).set('Cookie', dev).send({ moyen: 'carte' })).body.paiement
  await request(test.app).post(`/api/paiements/${reference}/simulation`).set('Cookie', dev).send({ resultat: 'reussi' })
  await request(test.app).post(`/api/admin/apps/${id}/validation`).set('Cookie', admin)
  await request(test.app).put(`/api/apps/${id}/preparation`).set('Cookie', dev).send({ elements: TOUT })
  await request(test.app).post(`/api/apps/${id}/campagne`).set('Cookie', dev)
  const { rows } = await pool.query('SELECT id, testeur_id FROM affectations ORDER BY id')
  affectations = rows.map((r) => String(r.id))
  testeurs = rows.map((r) => crees.find((t) => t.id === String(r.testeur_id)))
  // Les 3 premiers testeurs ont installé l'app ; le 2e a envoyé son rapport, le 3e a ses 14 jours.
  for (const i of [0, 1, 2]) {
    await request(test.app).post(`/api/testeurs/moi/apps/${affectations[i]}/inscription`).set(bearer(i)).attach('capture', JPEG, { filename: 'c.jpg', contentType: 'image/jpeg' })
    await request(test.app).post(`/api/testeurs/moi/apps/${affectations[i]}/installation`).set(bearer(i)).send({ sourceInstallation: 'com.android.vending' })
  }
  expect((await request(test.app).post(`/api/testeurs/moi/apps/${affectations[1]}/rapports`).set(bearer(1)).send(RAPPORT)).status).toBe(201)
  await pool.query('UPDATE affectations SET jours_valides = 14 WHERE id = $1', [affectations[2]])
  test.sms.vider()
}

describe('SMS de secours à 22 h (US-25)', () => {
  beforeEach(() => preparer())

  it('prévient seulement le testeur dont le rapport manque, une seule fois par soir', async () => {
    expect(await envoyerRappelsSms(deps(), { jour: JOUR, maintenant: deps().maintenant() })).toEqual({ jour: JOUR, envoyes: 1 })
    expect(test.sms.envoyes).toHaveLength(1)
    expect(test.sms.envoyes[0]).toMatchObject({
      a: await telephone(0),
      texte: 'Nakayo : il manque votre rapport du jour pour « Marché Facile ». Envoyez-le avant minuit pour garder votre compteur.',
    })
    expect(await envoyerRappelsSms(deps(), { jour: JOUR, maintenant: deps().maintenant() })).toEqual({ jour: JOUR, envoyes: 0 })
    expect(test.sms.envoyes).toHaveLength(1)
  })

  it('liste toutes les apps sans rapport dans un seul SMS', () => {
    expect(messageRappel(['Marché Facile', 'Zem Express', 'Tontine'])).toBe(
      'Nakayo : il manque vos rapports du jour pour « Marché Facile », « Zem Express » et « Tontine ». Envoyez-les avant minuit pour garder votre compteur.',
    )
  })

  it('se programme pour 22 h, sans rien envoyer avant', async () => {
    const planificateur = demarrerRappelsSms(deps())
    await planificateur.premier
    planificateur.arreter()
    expect(test.sms.envoyes).toEqual([])
  })
})

describe('démarrage tardif (US-25)', () => {
  // 22 h 30 au Bénin : le serveur vient de redémarrer, les rappels du soir partent tout de suite.
  beforeEach(() => preparer('2026-11-12T21:30:00Z'))

  it('envoie tout de suite les rappels du soir', async () => {
    const planificateur = demarrerRappelsSms(deps())
    await planificateur.premier
    planificateur.arreter()
    expect(test.sms.envoyes).toHaveLength(1)
    const { rows } = await pool.query('SELECT jour::text AS jour, apps FROM rappels_sms')
    expect(rows).toEqual([{ jour: JOUR, apps: ['Marché Facile'] }])
  })
})
