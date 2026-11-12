import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { gestionnaireErreurs } from '../../src/lib/erreurs.js'
import { chargerSession, exigerRole } from '../../src/middlewares/authentification.js'
import { creerAdmin } from '../../src/services/admins.js'
import { cookieSession, creerUtilisateur } from '../fabriques.js'
import { creerAppTest, pool, viderBase } from '../outils.js'

const TRENTE_JOURS = 30 * 24 * 60 * 60 * 1000

function connexion(app, email, motDePasse) {
  return request(app).post('/api/auth/connexion').send({ email, motDePasse })
}

describe('connexion (§3.1)', () => {
  let test
  beforeEach(async () => {
    await viderBase()
    test = creerAppTest()
  })

  it('ouvre une session de 30 jours dans un cookie httpOnly', async () => {
    const dev = await creerUtilisateur({ email: 'awa@studio.bj' })
    const r = await connexion(test.app, 'awa@studio.bj', 'motdepasse-valide')
    expect(r.status).toBe(200)
    expect(r.body.utilisateur).toMatchObject({ id: String(dev.id), role: 'developpeur', emailVerifie: true })
    expect(r.body.utilisateur).not.toHaveProperty('motDePasseHash')
    const cookie = r.headers['set-cookie'][0]
    expect(cookie).toMatch(/^nakayo_session=[A-Za-z0-9_-]{43};/)
    expect(cookie).toMatch(/Max-Age=2592000/)
    expect(cookie).toMatch(/HttpOnly/)
    expect(cookie).toMatch(/SameSite=Lax/)
    expect(cookie).not.toMatch(/Secure/)

    const { rows } = await pool.query('SELECT client, jeton_hash FROM sessions')
    expect(rows).toHaveLength(1)
    expect(rows[0].client).toBe('web')
    expect(rows[0].jeton_hash.toString()).not.toContain(cookieSession(r).split('=')[1])
  })

  it('pose un cookie Secure quand la configuration le demande (production)', async () => {
    await creerUtilisateur({ email: 'awa@studio.bj' })
    const prod = creerAppTest({ config: { cookieSecurise: true } })
    const r = await connexion(prod.app, 'awa@studio.bj', 'motdepasse-valide')
    expect(r.headers['set-cookie'][0]).toMatch(/Secure/)
  })

  it('accepte l’email avec des majuscules et des espaces', async () => {
    await creerUtilisateur({ email: 'awa@studio.bj' })
    const r = await connexion(test.app, '  AWA@Studio.bj ', 'motdepasse-valide')
    expect(r.status).toBe(200)
  })

  it('répond pareil pour un email inconnu et un mauvais mot de passe', async () => {
    await creerUtilisateur({ email: 'awa@studio.bj' })
    const faux = await connexion(test.app, 'awa@studio.bj', 'pas-le-bon-mot')
    const inconnu = await connexion(test.app, 'personne@studio.bj', 'motdepasse-valide')
    for (const r of [faux, inconnu]) {
      expect(r.status).toBe(401)
      expect(r.body.erreur.code).toBe('identifiants_invalides')
      expect(r.headers['set-cookie']).toBeUndefined()
    }
  })

  it('valide les champs (422)', async () => {
    const r = await request(test.app).post('/api/auth/connexion').send({ email: 'pas-un-email', motDePasse: '' })
    expect(r.status).toBe(422)
    expect(r.body.erreur.champs).toEqual({ email: 'format_invalide', motDePasse: 'requis' })

    const vide = await request(test.app).post('/api/auth/connexion').send([])
    expect(vide.body.erreur.champs).toEqual({ email: 'requis', motDePasse: 'requis' })

    const long = await connexion(test.app, 'awa@studio.bj', 'x'.repeat(129))
    expect(long.body.erreur.champs).toEqual({ motDePasse: 'trop_long' })
  })

  it('refuse un email pas encore vérifié (403 email_non_verifie)', async () => {
    await creerUtilisateur({ email: 'awa@studio.bj', emailVerifie: false })
    const r = await connexion(test.app, 'awa@studio.bj', 'motdepasse-valide')
    expect(r.status).toBe(403)
    expect(r.body.erreur.code).toBe('email_non_verifie')
  })

  it('refuse un compte suspendu (403 compte_suspendu)', async () => {
    await creerUtilisateur({ email: 'awa@studio.bj', statut: 'suspendu' })
    const r = await connexion(test.app, 'awa@studio.bj', 'motdepasse-valide')
    expect(r.status).toBe(403)
    expect(r.body.erreur.code).toBe('compte_suspendu')
  })

  it('connecte un compte en attente ou refusé, avec le motif du refus', async () => {
    await creerUtilisateur({ email: 'attente@studio.bj', statut: 'en_attente' })
    await creerUtilisateur({ email: 'refuse@studio.bj', statut: 'refuse', motifRefus: 'Fiche Google Play introuvable.' })
    expect((await connexion(test.app, 'attente@studio.bj', 'motdepasse-valide')).body.utilisateur.statut).toBe('en_attente')
    const refuse = await connexion(test.app, 'refuse@studio.bj', 'motdepasse-valide')
    expect(refuse.status).toBe(200)
    expect(refuse.body.utilisateur.motifRefus).toBe('Fiche Google Play introuvable.')
  })

  it('bloque après 5 échecs en 15 min pour un email, avec Retry-After', async () => {
    await creerUtilisateur({ email: 'awa@studio.bj' })
    for (let i = 0; i < 5; i++) expect((await connexion(test.app, 'awa@studio.bj', 'mauvais-mot')).status).toBe(401)
    const bloque = await connexion(test.app, 'awa@studio.bj', 'motdepasse-valide')
    expect(bloque.status).toBe(429)
    expect(bloque.body.erreur.code).toBe('trop_de_requetes')
    expect(Number(bloque.headers['retry-after'])).toBeGreaterThan(800)

    test.avancer(15 * 60 * 1000 + 1000)
    expect((await connexion(test.app, 'awa@studio.bj', 'motdepasse-valide')).status).toBe(200)
  })

  it('bloque après 5 échecs depuis une même IP, quel que soit l’email', async () => {
    for (let i = 0; i < 5; i++) await connexion(test.app, `inconnu${i}@studio.bj`, 'mauvais-mot')
    const r = await connexion(test.app, 'autre@studio.bj', 'mauvais-mot')
    expect(r.status).toBe(429)
  })

  it('remet le compteur de l’email à zéro après une connexion réussie', async () => {
    await creerUtilisateur({ email: 'awa@studio.bj' })
    const autreIp = creerAppTest()
    for (let i = 0; i < 4; i++) await connexion(autreIp.app, 'awa@studio.bj', 'mauvais-mot')
    expect((await connexion(autreIp.app, 'awa@studio.bj', 'motdepasse-valide')).status).toBe(200)
    // Le compteur par IP garde ses 4 échecs : un 5e échec est encore permis.
    expect((await connexion(autreIp.app, 'awa@studio.bj', 'mauvais-mot')).status).toBe(401)
  })

  it('ne connecte pas un testeur par email', async () => {
    await creerUtilisateur({ email: 'testeur@gmail.com', role: 'testeur', telephone: '+2290197000000' })
    expect((await connexion(test.app, 'testeur@gmail.com', 'motdepasse-valide')).status).toBe(401)
  })
})

describe('session courante et déconnexion (§3.2, §3.3)', () => {
  let test
  let cookie
  beforeEach(async () => {
    await viderBase()
    test = creerAppTest()
    await creerUtilisateur({ email: 'awa@studio.bj', nom: 'Studio Awa' })
    cookie = cookieSession(await connexion(test.app, 'awa@studio.bj', 'motdepasse-valide'))
  })

  it('renvoie l’utilisateur avec le cookie', async () => {
    const r = await request(test.app).get('/api/auth/moi').set('Cookie', cookie)
    expect(r.status).toBe(200)
    expect(r.body.utilisateur).toMatchObject({ email: 'awa@studio.bj', nom: 'Studio Awa' })
  })

  it('accepte le même jeton en Bearer (app Android)', async () => {
    const jeton = cookie.split('=')[1]
    const r = await request(test.app).get('/api/auth/moi').set('Authorization', `Bearer ${jeton}`)
    expect(r.status).toBe(200)
  })

  it('répond 401 sans session ou avec un jeton inconnu', async () => {
    for (const entete of [{}, { Cookie: 'nakayo_session=inconnu' }, { Authorization: 'Bearer inconnu' }]) {
      const r = await request(test.app).get('/api/auth/moi').set(entete)
      expect(r.status).toBe(401)
      expect(r.body.erreur.code).toBe('non_authentifie')
    }
  })

  it('expire après 30 jours sans utilisation', async () => {
    test.avancer(TRENTE_JOURS + 60 * 1000)
    expect((await request(test.app).get('/api/auth/moi').set('Cookie', cookie)).status).toBe(401)
  })

  it('chaque utilisation repousse l’échéance de 30 jours et renouvelle le cookie', async () => {
    test.avancer(TRENTE_JOURS - 60 * 1000)
    const r = await request(test.app).get('/api/auth/moi').set('Cookie', cookie)
    expect(r.status).toBe(200)
    expect(r.headers['set-cookie'][0]).toMatch(/^nakayo_session=.*Max-Age=2592000/)
    // 40 jours après la connexion, mais seulement 10 jours après la dernière utilisation.
    test.avancer(10 * 24 * 60 * 60 * 1000)
    expect((await request(test.app).get('/api/auth/moi').set('Cookie', cookie)).status).toBe(200)
  })

  it('ne renvoie pas de cookie quand la session n’est pas prolongée (moins d’une heure)', async () => {
    test.avancer(10 * 60 * 1000)
    const r = await request(test.app).get('/api/auth/moi').set('Cookie', cookie)
    expect(r.status).toBe(200)
    expect(r.headers['set-cookie']).toBeUndefined()
  })

  it('note la dernière utilisation au plus une fois par heure', async () => {
    const avant = (await pool.query('SELECT utilisee_le FROM sessions')).rows[0].utilisee_le
    test.avancer(2 * 60 * 60 * 1000)
    await request(test.app).get('/api/auth/moi').set('Cookie', cookie)
    const apres = (await pool.query('SELECT utilisee_le FROM sessions')).rows[0].utilisee_le
    expect(apres.getTime() - avant.getTime()).toBeGreaterThanOrEqual(2 * 60 * 60 * 1000 - 1000)
  })

  it('révoque la session et efface le cookie à la déconnexion', async () => {
    const r = await request(test.app).post('/api/auth/deconnexion').set('Cookie', cookie)
    expect(r.status).toBe(204)
    expect(r.headers['set-cookie'][0]).toMatch(/^nakayo_session=;.*Expires=Thu, 01 Jan 1970/)
    expect((await request(test.app).get('/api/auth/moi').set('Cookie', cookie)).status).toBe(401)
    const { rows } = await pool.query('SELECT revoquee_le FROM sessions')
    expect(rows[0].revoquee_le).not.toBeNull()
  })

  it('ne touche qu’à la session courante', async () => {
    const autre = cookieSession(await connexion(test.app, 'awa@studio.bj', 'motdepasse-valide'))
    await request(test.app).post('/api/auth/deconnexion').set('Cookie', cookie)
    expect((await request(test.app).get('/api/auth/moi').set('Cookie', autre)).status).toBe(200)
  })

  it('répond 204 même sans session', async () => {
    expect((await request(test.app).post('/api/auth/deconnexion')).status).toBe(204)
  })
})

describe('mot de passe oublié (§3.4) et réinitialisation (§3.5)', () => {
  let test
  beforeEach(async () => {
    await viderBase()
    test = creerAppTest()
  })

  async function demanderLien(email = 'awa@studio.bj') {
    const r = await request(test.app).post('/api/auth/mot-de-passe/oubli').send({ email })
    expect(r.status).toBe(202)
    const message = test.emails.dernierPour(email.trim().toLowerCase())
    return message && new URL(message.lien).searchParams.get('jeton')
  }

  function reinitialiser(jeton, motDePasse = 'nouvelle-phrase-secrete') {
    return request(test.app).post('/api/auth/mot-de-passe/reinitialisation').send({ jeton, motDePasse })
  }

  it('envoie un lien vers la page du front', async () => {
    await creerUtilisateur({ email: 'awa@studio.bj' })
    await demanderLien(' AWA@studio.bj')
    const message = test.emails.dernierPour('awa@studio.bj')
    expect(message.lien).toMatch(/^http:\/\/localhost:5173\/reinitialiser-mot-de-passe\?jeton=[A-Za-z0-9_-]{43}$/)
    expect(message.texte).toContain('valable 1 heure')
    expect(message.texte).not.toMatch(/\u2014/)
  })

  it('répond 202 sans rien envoyer pour un email inconnu ou un compte suspendu', async () => {
    await creerUtilisateur({ email: 'suspendu@studio.bj', statut: 'suspendu' })
    expect(await demanderLien('personne@studio.bj')).toBeNull()
    expect(await demanderLien('suspendu@studio.bj')).toBeNull()
    expect(test.emails.envoyes).toHaveLength(0)
  })

  it('valide l’email (422 format_invalide)', async () => {
    const r = await request(test.app).post('/api/auth/mot-de-passe/oubli').send({ email: 'awa' })
    expect(r.status).toBe(422)
    expect(r.body.erreur.champs).toEqual({ email: 'format_invalide' })
  })

  it('limite à un envoi par minute et 5 par heure pour une adresse', async () => {
    await demanderLien('personne@studio.bj')
    const r = await request(test.app).post('/api/auth/mot-de-passe/oubli').send({ email: 'personne@studio.bj' })
    expect(r.status).toBe(429)
    expect(Number(r.headers['retry-after'])).toBeLessThanOrEqual(60)
    for (let i = 0; i < 4; i++) {
      test.avancer(61 * 1000)
      await demanderLien('personne@studio.bj')
    }
    test.avancer(61 * 1000)
    const heure = await request(test.app).post('/api/auth/mot-de-passe/oubli').send({ email: 'personne@studio.bj' })
    expect(heure.status).toBe(429)
    expect(Number(heure.headers['retry-after'])).toBeGreaterThan(60)
  })

  it('change le mot de passe et ferme toutes les sessions', async () => {
    await creerUtilisateur({ email: 'awa@studio.bj' })
    const cookie = cookieSession(await connexion(test.app, 'awa@studio.bj', 'motdepasse-valide'))
    const jeton = await demanderLien()

    const r = await reinitialiser(jeton)
    expect(r.status).toBe(204)
    expect(r.headers['set-cookie']).toBeUndefined()
    expect((await request(test.app).get('/api/auth/moi').set('Cookie', cookie)).status).toBe(401)
    expect((await connexion(test.app, 'awa@studio.bj', 'motdepasse-valide')).status).toBe(401)
    expect((await connexion(test.app, 'awa@studio.bj', 'nouvelle-phrase-secrete')).status).toBe(200)
  })

  it('n’accepte un lien qu’une fois (400 jeton_invalide)', async () => {
    await creerUtilisateur({ email: 'awa@studio.bj' })
    const jeton = await demanderLien()
    await reinitialiser(jeton)
    const r = await reinitialiser(jeton, 'encore-une-autre-phrase')
    expect(r.status).toBe(400)
    expect(r.body.erreur.code).toBe('jeton_invalide')
  })

  it('refuse un jeton inconnu ou absent', async () => {
    expect((await reinitialiser('inconnu')).body.erreur.code).toBe('jeton_invalide')
    expect((await reinitialiser(undefined)).status).toBe(400)
  })

  it('refuse un lien de plus d’une heure (410 jeton_expire)', async () => {
    await creerUtilisateur({ email: 'awa@studio.bj' })
    const jeton = await demanderLien()
    test.avancer(61 * 60 * 1000)
    const r = await reinitialiser(jeton)
    expect(r.status).toBe(410)
    expect(r.body.erreur.code).toBe('jeton_expire')
  })

  it('désactive l’ancien lien quand un nouveau est demandé', async () => {
    await creerUtilisateur({ email: 'awa@studio.bj' })
    const ancien = await demanderLien()
    test.avancer(61 * 1000)
    const nouveau = await demanderLien()
    expect((await reinitialiser(ancien)).status).toBe(400)
    expect((await reinitialiser(nouveau)).status).toBe(204)
  })

  it('valide le nouveau mot de passe sans consommer le lien', async () => {
    await creerUtilisateur({ email: 'awa@studio.bj' })
    const jeton = await demanderLien()
    const court = await reinitialiser(jeton, 'court')
    expect(court.status).toBe(422)
    expect(court.body.erreur.champs).toEqual({ motDePasse: 'trop_court' })
    expect((await reinitialiser(jeton)).status).toBe(204)
  })
})

describe('accès par rôle', () => {
  let test
  beforeEach(async () => {
    await viderBase()
    test = creerAppTest()
  })

  function appProtegee() {
    const { pool: base } = { pool }
    const app = express()
    app.use(chargerSession({ pool: base, maintenant: () => new Date() }))
    app.get('/admin', exigerRole('admin'), (_req, res) => res.json({ ok: true }))
    app.use(gestionnaireErreurs())
    return app
  }

  it('laisse passer un admin, refuse les autres rôles (403) et les anonymes (401)', async () => {
    await creerUtilisateur({ email: 'admin@nakayo.bj', role: 'admin', statut: 'valide' })
    await creerUtilisateur({ email: 'awa@studio.bj' })
    const admin = cookieSession(await connexion(test.app, 'admin@nakayo.bj', 'motdepasse-valide'))
    const dev = cookieSession(await connexion(test.app, 'awa@studio.bj', 'motdepasse-valide'))
    const app = appProtegee()
    expect((await request(app).get('/admin').set('Cookie', admin)).status).toBe(200)
    expect((await request(app).get('/admin').set('Cookie', dev)).body.erreur.code).toBe('interdit')
    expect((await request(app).get('/admin')).status).toBe(401)
  })
})

describe('création d’un admin (npm run admin:creer)', () => {
  beforeEach(viderBase)

  it('crée un admin validé qui peut se connecter', async () => {
    const { cree } = await creerAdmin(pool, { email: 'Admin@Nakayo.bj', nom: 'Équipe', motDePasse: 'admin-nakayo-2026' })
    expect(cree).toBe(true)
    const r = await connexion(creerAppTest().app, 'admin@nakayo.bj', 'admin-nakayo-2026')
    expect(r.body.utilisateur).toMatchObject({ role: 'admin', statut: 'valide', emailVerifie: true, nom: 'Équipe' })
  })

  it('met à jour le mot de passe d’un admin existant', async () => {
    await creerAdmin(pool, { email: 'admin@nakayo.bj', motDePasse: 'admin-nakayo-2026' })
    const { cree } = await creerAdmin(pool, { email: 'admin@nakayo.bj', motDePasse: 'autre-phrase-admin' })
    expect(cree).toBe(false)
    expect((await connexion(creerAppTest().app, 'admin@nakayo.bj', 'autre-phrase-admin')).status).toBe(200)
  })

  it('refuse un mot de passe trop court ou l’email d’un développeur', async () => {
    await expect(creerAdmin(pool, { email: 'admin@nakayo.bj', motDePasse: 'court' })).rejects.toThrow(/motDePasse/)
    await creerUtilisateur({ email: 'awa@studio.bj' })
    await expect(creerAdmin(pool, { email: 'awa@studio.bj', motDePasse: 'admin-nakayo-2026' })).rejects.toThrow(
      /developpeur/,
    )
  })
})
