import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { cookieSession, creerUtilisateur } from '../fabriques.js'
import { creerAppTest, pool, viderBase } from '../outils.js'

const VALIDE = {
  email: 'awa@studio.bj',
  motDePasse: 'une phrase assez longue',
  nom: 'Studio Awa',
  pays: 'BJ',
  lienFicheDeveloppeur: 'https://play.google.com/store/apps/dev?id=1234567890',
  accepteConditions: true,
}

describe('inscription développeur (§2.1)', () => {
  let test
  beforeEach(async () => {
    await viderBase()
    test = creerAppTest()
  })
  const inscrire = (corps, app = test.app) => request(app).post('/api/auth/inscription').send(corps)

  it('crée un compte en attente, email non vérifié, sans ouvrir de session', async () => {
    const r = await inscrire({ ...VALIDE, email: ' Awa@Studio.BJ ', nom: '  Studio Awa ', pays: 'bj' })
    expect(r.status).toBe(201)
    expect(r.body.utilisateur).toMatchObject({
      role: 'developpeur',
      statut: 'en_attente',
      emailVerifie: false,
      email: 'awa@studio.bj',
      nom: 'Studio Awa',
      pays: 'BJ',
      lienFicheDeveloppeur: VALIDE.lienFicheDeveloppeur,
      motifRefus: null,
    })
    expect(r.headers['set-cookie']).toBeUndefined()
    const { rows } = await pool.query('SELECT mot_de_passe_hash FROM utilisateurs')
    expect(rows[0].mot_de_passe_hash).toMatch(/^scrypt\$/)
  })

  it('envoie un lien de vérification valable 24 h', async () => {
    await inscrire(VALIDE)
    const message = test.emails.dernierPour('awa@studio.bj')
    expect(message.sujet).toBe('Confirmez votre adresse email Nakayo')
    expect(message.lien).toMatch(/^http:\/\/localhost:5173\/verification-email\?jeton=[A-Za-z0-9_-]{43}$/)
    expect(message.texte).toContain('24 heures')
  })

  it('remet en forme un lien de fiche collé sans https', async () => {
    const r = await inscrire({ ...VALIDE, lienFicheDeveloppeur: 'play.google.com/store/apps/dev?id=1234567890' })
    expect(r.body.utilisateur.lienFicheDeveloppeur).toBe(VALIDE.lienFicheDeveloppeur)
  })

  it('renvoie toutes les erreurs de champ d’un coup (422)', async () => {
    const r = await inscrire({ email: 'awa', motDePasse: 'court', nom: 'A', pays: 'XX', lienFicheDeveloppeur: 'https://exemple.com' })
    expect(r.status).toBe(422)
    expect(r.body.erreur.champs).toEqual({
      email: 'format_invalide',
      motDePasse: 'trop_court',
      nom: 'trop_court',
      pays: 'valeur_inconnue',
      lienFicheDeveloppeur: 'format_invalide',
      accepteConditions: 'doit_etre_accepte',
    })
  })

  it('exige des champs présents et une case cochée avec true', async () => {
    const r = await inscrire({ accepteConditions: 'true' })
    expect(r.body.erreur.champs).toEqual({
      email: 'requis',
      motDePasse: 'requis',
      nom: 'requis',
      pays: 'requis',
      lienFicheDeveloppeur: 'requis',
      accepteConditions: 'doit_etre_accepte',
    })
  })

  it('refuse un email déjà utilisé (409 conflit)', async () => {
    await creerUtilisateur({ email: 'awa@studio.bj' })
    const r = await inscrire(VALIDE)
    expect(r.status).toBe(409)
    expect(r.body.erreur).toMatchObject({ code: 'conflit', champs: { email: 'deja_utilise' } })
  })

  it('refuse une fiche Google Play déjà liée à un compte non refusé', async () => {
    await inscrire(VALIDE)
    const r = await inscrire({ ...VALIDE, email: 'autre@studio.bj' })
    expect(r.status).toBe(409)
    expect(r.body.erreur.champs).toEqual({ lienFicheDeveloppeur: 'deja_utilise' })

    await pool.query("UPDATE utilisateurs SET statut = 'refuse', motif_refus = 'Fiche d’un autre studio.'")
    expect((await inscrire({ ...VALIDE, email: 'autre@studio.bj' })).status).toBe(201)
  })

  it('traduit une course entre deux inscriptions en 409, pas en 500', async () => {
    const [a, b] = await Promise.all([inscrire(VALIDE), inscrire(VALIDE)])
    expect([a.status, b.status].sort()).toEqual([201, 409])
  })

  it('limite à 5 inscriptions par heure depuis une IP', async () => {
    for (let i = 0; i < 5; i++) {
      const r = await inscrire({ ...VALIDE, email: `dev${i}@studio.bj`, lienFicheDeveloppeur: `${VALIDE.lienFicheDeveloppeur}${i}` })
      expect(r.status).toBe(201)
    }
    const r = await inscrire({ ...VALIDE, email: 'dev9@studio.bj', lienFicheDeveloppeur: `${VALIDE.lienFicheDeveloppeur}9` })
    expect(r.status).toBe(429)
    expect(r.headers['retry-after']).toBeDefined()
  })

  it('crée le compte même si l’email ne part pas', async () => {
    test.emails.envoyer = async () => {
      throw new Error('fournisseur en panne')
    }
    expect((await inscrire(VALIDE)).status).toBe(201)
  })
})

describe('vérification de l’email (§2.2)', () => {
  let test
  beforeEach(async () => {
    await viderBase()
    test = creerAppTest()
  })

  async function inscrireEtLireJeton(email = 'awa@studio.bj') {
    await request(test.app).post('/api/auth/inscription').send({ ...VALIDE, email })
    return new URL(test.emails.dernierPour(email).lien).searchParams.get('jeton')
  }
  const verifier = (jeton) => request(test.app).post('/api/auth/verification-email').send({ jeton })

  it('vérifie l’email et ouvre une session web', async () => {
    const r = await verifier(await inscrireEtLireJeton())
    expect(r.status).toBe(200)
    expect(r.body.utilisateur).toMatchObject({ emailVerifie: true, statut: 'en_attente' })
    const moi = await request(test.app).get('/api/auth/moi').set('Cookie', cookieSession(r))
    expect(moi.body.utilisateur.email).toBe('awa@studio.bj')
  })

  it('permet ensuite de se connecter avec le mot de passe choisi', async () => {
    await verifier(await inscrireEtLireJeton())
    const r = await request(test.app).post('/api/auth/connexion').send({ email: VALIDE.email, motDePasse: VALIDE.motDePasse })
    expect(r.status).toBe(200)
  })

  it('n’accepte un lien qu’une fois (400 jeton_invalide)', async () => {
    const jeton = await inscrireEtLireJeton()
    await verifier(jeton)
    const r = await verifier(jeton)
    expect(r.status).toBe(400)
    expect(r.body.erreur.code).toBe('jeton_invalide')
    expect((await verifier('inconnu')).status).toBe(400)
    expect((await verifier(undefined)).status).toBe(400)
  })

  it('refuse un lien de plus de 24 h (410 jeton_expire)', async () => {
    const jeton = await inscrireEtLireJeton()
    test.avancer(24 * 60 * 60 * 1000 + 1000)
    const r = await verifier(jeton)
    expect(r.status).toBe(410)
    expect(r.body.erreur.code).toBe('jeton_expire')
  })

  it('n’accepte pas un lien de réinitialisation de mot de passe', async () => {
    await creerUtilisateur({ email: 'awa@studio.bj' })
    await request(test.app).post('/api/auth/mot-de-passe/oubli').send({ email: 'awa@studio.bj' })
    const jeton = new URL(test.emails.dernierPour('awa@studio.bj').lien).searchParams.get('jeton')
    expect((await verifier(jeton)).status).toBe(400)
  })
})

describe('renvoi du lien de vérification (§2.3)', () => {
  let test
  beforeEach(async () => {
    await viderBase()
    test = creerAppTest()
  })
  const renvoyer = (email) => request(test.app).post('/api/auth/verification-email/renvoi').send({ email })

  it('envoie un nouveau lien et désactive le précédent', async () => {
    await request(test.app).post('/api/auth/inscription').send(VALIDE)
    const ancien = new URL(test.emails.dernierPour('awa@studio.bj').lien).searchParams.get('jeton')
    const r = await renvoyer('AWA@studio.bj')
    expect(r.status).toBe(202)
    expect(r.body).toEqual({})
    expect(test.emails.envoyes).toHaveLength(2)
    const nouveau = new URL(test.emails.dernierPour('awa@studio.bj').lien).searchParams.get('jeton')
    expect((await request(test.app).post('/api/auth/verification-email').send({ jeton: ancien })).status).toBe(400)
    expect((await request(test.app).post('/api/auth/verification-email').send({ jeton: nouveau })).status).toBe(200)
  })

  it('répond 202 sans rien envoyer pour un email inconnu ou déjà vérifié', async () => {
    await creerUtilisateur({ email: 'verifie@studio.bj' })
    expect((await renvoyer('personne@studio.bj')).status).toBe(202)
    expect((await renvoyer('verifie@studio.bj')).status).toBe(202)
    expect(test.emails.envoyes).toHaveLength(0)
  })

  it('valide l’email (422 format_invalide)', async () => {
    const r = await renvoyer('')
    expect(r.status).toBe(422)
    expect(r.body.erreur.champs).toEqual({ email: 'format_invalide' })
  })

  it('limite à un renvoi par minute, sans bloquer le mot de passe oublié', async () => {
    await renvoyer('awa@studio.bj')
    const r = await renvoyer('awa@studio.bj')
    expect(r.status).toBe(429)
    expect(Number(r.headers['retry-after'])).toBeLessThanOrEqual(60)
    expect((await request(test.app).post('/api/auth/mot-de-passe/oubli').send({ email: 'awa@studio.bj' })).status).toBe(202)
    test.avancer(61 * 1000)
    expect((await renvoyer('awa@studio.bj')).status).toBe(202)
  })
})
