import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { executerControles } from '../../src/services/controles.js'
import { cookieSession, creerTesteur, creerUtilisateur, JPEG } from '../fabriques.js'
import { creerAppTest, pool, viderBase } from '../outils.js'

let test
let admin
beforeEach(async () => {
  await viderBase()
  test = creerAppTest()
  await creerUtilisateur({ email: 'admin@nakayo.bj', role: 'admin', statut: 'valide', motDePasse: 'admin-nakayo-2026' })
  admin = await connecter('admin@nakayo.bj', 'admin-nakayo-2026')
})

async function connecter(email, motDePasse = 'motdepasse-valide') {
  return cookieSession(await request(test.app).post('/api/auth/connexion').send({ email, motDePasse }))
}
const lister = (query = '', cookie = admin) => request(test.app).get(`/api/admin/comptes${query}`).set('Cookie', cookie)
const valider = (id, cookie = admin) => request(test.app).post(`/api/admin/comptes/${id}/validation`).set('Cookie', cookie)
const refuser = (id, motif, cookie = admin) =>
  request(test.app).post(`/api/admin/comptes/${id}/refus`).set('Cookie', cookie).send({ motif })

async function inscritLe(utilisateur, iso) {
  await pool.query('UPDATE utilisateurs SET cree_le = $2 WHERE id = $1', [utilisateur.id, iso])
}

describe('accès', () => {
  it('réservé aux admins', async () => {
    await creerUtilisateur({ email: 'awa@studio.bj' })
    expect((await request(test.app).get('/api/admin/comptes')).status).toBe(401)
    const dev = await connecter('awa@studio.bj')
    expect((await lister('', dev)).status).toBe(403)
    expect((await valider(1, dev)).status).toBe(403)
  })
})

describe('liste des comptes (§5.1)', () => {
  it('liste les comptes en attente vérifiés, du plus ancien au plus récent', async () => {
    const a = await creerUtilisateur({ email: 'a@studio.bj', nom: 'Studio A' })
    const b = await creerUtilisateur({ email: 'b@studio.bj', nom: 'Studio B' })
    await creerUtilisateur({ email: 'nonverifie@studio.bj', emailVerifie: false })
    await creerUtilisateur({ email: 'valide@studio.bj', statut: 'valide' })
    const t = await creerTesteur()
    await inscritLe(b, '2026-11-01T10:00:00Z')
    await inscritLe(a, '2026-11-02T10:00:00Z')
    await pool.query("UPDATE utilisateurs SET cree_le = '2026-11-03T10:00:00Z' WHERE id = $1", [t.id])

    const r = await lister()
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ total: 3, page: 1, parPage: 20 })
    expect(r.body.comptes.map((c) => c.nom)).toEqual(['Studio B', 'Studio A', 'Koffi Agbo'])
    expect(r.body.comptes[0]).toEqual({
      id: String(b.id),
      role: 'developpeur',
      statut: 'en_attente',
      nom: 'Studio B',
      creeLe: '2026-11-01T10:00:00.000Z',
      developpeur: { email: 'b@studio.bj', pays: 'BJ', lienFicheDeveloppeur: null },
      testeur: null,
      controles: { etat: 'en_cours', liste: [] },
    })
    expect(r.body.comptes[2].testeur).toEqual({
      telephone: '+2290197000000',
      ville: 'Cotonou',
      gmail: 'koffi.agbo@gmail.com',
      numeroMomo: '+2290196000000',
      operateurMomo: 'mtn',
      appareil: { fabricant: 'Tecno', modele: 'Spark 20', versionAndroid: '14', niveauApi: 34 },
    })
  })

  it('filtre par rôle, statut et période (jours à l’heure du Bénin), trie et pagine', async () => {
    const tard = await creerUtilisateur({ email: 'tard@studio.bj', nom: 'Tard' })
    const tot = await creerUtilisateur({ email: 'tot@studio.bj', nom: 'Tôt' })
    await creerTesteur()
    // 23 h 30 UTC le 1er novembre = 0 h 30 le 2 novembre à Cotonou.
    await inscritLe(tard, '2026-11-01T23:30:00Z')
    await inscritLe(tot, '2026-11-01T10:00:00Z')

    expect((await lister('?role=testeur')).body.comptes.map((c) => c.role)).toEqual(['testeur'])
    expect((await lister('?role=developpeur&du=2026-11-02&au=2026-11-02')).body.comptes.map((c) => c.nom)).toEqual(['Tard'])
    expect((await lister('?role=developpeur&au=2026-11-01')).body.comptes.map((c) => c.nom)).toEqual(['Tôt'])
    expect((await lister('?role=developpeur&tri=recent')).body.comptes.map((c) => c.nom)).toEqual(['Tard', 'Tôt'])

    const page2 = await lister('?role=developpeur&parPage=1&page=2')
    expect(page2.body).toMatchObject({ total: 2, page: 2, parPage: 1 })
    expect(page2.body.comptes.map((c) => c.nom)).toEqual(['Tard'])
    const auDela = await lister('?parPage=1&page=9')
    expect(auDela.body).toMatchObject({ comptes: [], total: 3 })

    await pool.query("UPDATE utilisateurs SET statut = 'valide' WHERE id = $1", [tot.id])
    expect((await lister('?statut=valide')).body.comptes.map((c) => c.nom)).toEqual(['Tôt'])
  })

  it('valide les paramètres (422)', async () => {
    const r = await lister('?du=2026-11-10&au=2026-11-01&parPage=100')
    expect(r.status).toBe(422)
    expect(r.body.erreur.champs).toEqual({ au: 'avant_debut', parPage: 'format_invalide' })
  })

  it('inclut les contrôles terminés', async () => {
    const dev = await creerUtilisateur({ email: 'awa@yopmail.com' })
    await executerControles(pool, dev.id)
    const [compte] = (await lister()).body.comptes
    expect(compte.controles.etat).toBe('termine')
    expect(compte.controles.liste.find((c) => c.code === 'email_jetable')).toEqual({
      code: 'email_jetable',
      libelle: 'Adresse email non jetable',
      resultat: 'alerte',
      detail: expect.any(String),
    })
  })
})

describe('détail et photos (§5.2)', () => {
  async function testeurAvecPhotos() {
    const t = await creerTesteur()
    mkdirSync(path.join(test.dossierDocuments, t.id), { recursive: true })
    writeFileSync(path.join(test.dossierDocuments, t.id, 'piece.jpg'), JPEG)
    await pool.query(
      `INSERT INTO documents_identite (utilisateur_id, type, chemin, type_mime, taille_octets)
       VALUES ($1, 'piece_identite', $2, 'image/jpeg', $3)`,
      [t.id, path.join(t.id, 'piece.jpg'), JPEG.length],
    )
    return t
  }

  it('renvoie le compte avec les liens vers les photos', async () => {
    const t = await testeurAvecPhotos()
    const r = await request(test.app).get(`/api/admin/comptes/${t.id}`).set('Cookie', admin)
    expect(r.status).toBe(200)
    expect(r.body.compte.documents).toEqual({ pieceIdentite: `/api/admin/comptes/${t.id}/documents/piece-identite`, selfie: null })
  })

  it('sert la photo sans cache, à l’admin seulement', async () => {
    const t = await testeurAvecPhotos()
    const r = await request(test.app).get(`/api/admin/comptes/${t.id}/documents/piece-identite`).set('Cookie', admin)
    expect(r.status).toBe(200)
    expect(r.headers['content-type']).toBe('image/jpeg')
    expect(r.headers['cache-control']).toBe('private, no-store')
    expect(Buffer.compare(r.body, JPEG)).toBe(0)
    expect((await request(test.app).get(`/api/admin/comptes/${t.id}/documents/piece-identite`)).status).toBe(401)
    expect((await request(test.app).get(`/api/admin/comptes/${t.id}/documents/selfie`).set('Cookie', admin)).status).toBe(404)
    expect((await request(test.app).get(`/api/admin/comptes/${t.id}/documents/autre`).set('Cookie', admin)).status).toBe(404)
  })

  it('répond 404 pour un compte inconnu, non vérifié ou un id mal formé', async () => {
    const nonVerifie = await creerUtilisateur({ email: 'x@studio.bj', emailVerifie: false })
    for (const id of ['999999', String(nonVerifie.id), 'abc', '1;DROP']) {
      expect((await request(test.app).get(`/api/admin/comptes/${id}`).set('Cookie', admin)).status).toBe(404)
    }
  })
})

describe('validation et refus (§5.3, §5.4)', () => {
  it('valide un développeur, garde la trace et le prévient par email', async () => {
    const dev = await creerUtilisateur({ email: 'awa@studio.bj' })
    const r = await valider(dev.id)
    expect(r.status).toBe(200)
    expect(r.body.compte).toMatchObject({ id: String(dev.id), statut: 'valide' })

    const { rows } = await pool.query('SELECT decide_par, decide_le FROM utilisateurs WHERE id = $1', [dev.id])
    expect(rows[0].decide_par).not.toBeNull()
    const { rows: historique } = await pool.query('SELECT decision, motif FROM decisions_comptes')
    expect(historique).toEqual([{ decision: 'valide', motif: null }])
    expect(test.emails.dernierPour('awa@studio.bj').sujet).toBe('Votre compte Nakayo est validé')

    const connexion = await request(test.app).post('/api/auth/connexion').send({ email: 'awa@studio.bj', motDePasse: 'motdepasse-valide' })
    expect(connexion.body.utilisateur.statut).toBe('valide')
  })

  it('refuse un testeur avec un motif, transmis par SMS et dans son profil', async () => {
    const t = await creerTesteur()
    const r = await refuser(t.id, '  La photo de la pièce est illisible.  ')
    expect(r.status).toBe(200)
    expect(r.body.compte.statut).toBe('refuse')
    expect(test.sms.dernierPour('+2290197000000').texte).toContain('Motif : La photo de la pièce est illisible.')
    const profil = await request(test.app).get('/api/testeurs/moi').set('Authorization', `Bearer ${t.jeton}`)
    expect(profil.body.utilisateur.motifRefus).toBe('La photo de la pièce est illisible.')
  })

  it('exige un motif de 10 à 500 caractères (422)', async () => {
    const dev = await creerUtilisateur()
    expect((await refuser(dev.id, '')).body.erreur.champs).toEqual({ motif: 'requis' })
    expect((await refuser(dev.id, 'trop bref')).body.erreur.champs).toEqual({ motif: 'trop_court' })
    expect((await refuser(dev.id, 'x'.repeat(501))).body.erreur.champs).toEqual({ motif: 'trop_long' })
  })

  it('répond 409 si un autre admin a déjà décidé', async () => {
    const dev = await creerUtilisateur()
    await refuser(dev.id, 'Fiche Google Play introuvable.')
    const r = await valider(dev.id)
    expect(r.status).toBe(409)
    expect(r.body.erreur).toMatchObject({ code: 'statut_incompatible', statut: 'refuse' })
  })

  it('ne laisse passer qu’une décision quand deux admins cliquent en même temps', async () => {
    const dev = await creerUtilisateur()
    const [a, b] = await Promise.all([valider(dev.id), refuser(dev.id, 'Décision prise en même temps.')])
    expect([a.status, b.status].sort()).toEqual([200, 409])
    expect((await pool.query('SELECT count(*)::int AS n FROM decisions_comptes')).rows[0].n).toBe(1)
  })

  it('répond 404 pour un compte inconnu ou un admin', async () => {
    expect((await valider(999999)).status).toBe(404)
    const { rows } = await pool.query("SELECT id FROM utilisateurs WHERE role = 'admin'")
    expect((await valider(rows[0].id)).status).toBe(404)
  })

  it('enregistre la décision même si le message ne part pas', async () => {
    const dev = await creerUtilisateur()
    test.emails.envoyer = async () => {
      throw new Error('panne')
    }
    expect((await valider(dev.id)).status).toBe(200)
  })
})
