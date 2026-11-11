import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { executerControles, lireControles } from '../../src/services/controles.js'
import { APPAREIL, creerTesteur, creerUtilisateur } from '../fabriques.js'
import { creerAppTest, pool, viderBase } from '../outils.js'

const FICHE = 'https://play.google.com/store/apps/dev?id=1234567890'

async function developpeur(options = {}) {
  const u = await creerUtilisateur(options)
  await pool.query('UPDATE utilisateurs SET lien_fiche_developpeur = $2 WHERE id = $1', [u.id, options.fiche ?? FICHE])
  return u
}

const parCode = (liste) => Object.fromEntries(liste.map((c) => [c.code, c]))

beforeEach(viderBase)

describe('contrôles d’un développeur', () => {
  it('tout est conforme pour un compte ordinaire', async () => {
    const dev = await developpeur({ email: 'awa@studio.bj' })
    const fetch = async () => ({ ok: true, status: 200 })
    const liste = await executerControles(pool, dev.id, { reseau: true, fetch })
    expect(liste.map((c) => [c.code, c.resultat])).toEqual([
      ['email_jetable', 'ok'],
      ['fiche_play_doublon', 'ok'],
      ['fiche_play_accessible', 'ok'],
    ])
  })

  it('signale un email jetable et une fiche déjà liée à un compte refusé', async () => {
    const ancien = await developpeur({ email: 'ancien@studio.bj', fiche: FICHE })
    await pool.query("UPDATE utilisateurs SET statut = 'refuse', motif_refus = 'Fiche d’un autre studio.' WHERE id = $1", [ancien.id])
    const dev = await developpeur({ email: 'awa@yopmail.com', fiche: FICHE })
    const c = parCode(await executerControles(pool, dev.id))
    expect(c.email_jetable.resultat).toBe('alerte')
    expect(c.fiche_play_doublon).toMatchObject({ resultat: 'echec', detail: 'Fiche déjà liée à 1 compte refusé.' })
    expect(c.fiche_play_accessible).toMatchObject({ resultat: 'indisponible' })
  })

  it('marque la fin des contrôles et remplace les anciens résultats', async () => {
    const dev = await developpeur()
    await executerControles(pool, dev.id, { reseau: true, fetch: async () => ({ ok: false, status: 404 }) })
    await executerControles(pool, dev.id, { reseau: true, fetch: async () => ({ ok: true, status: 200 }) })
    const controles = (await lireControles(pool, [dev.id])).get(String(dev.id))
    expect(controles.etat).toBe('termine')
    expect(controles.liste).toHaveLength(3)
    expect(parCode(controles.liste).fiche_play_accessible.resultat).toBe('ok')
  })
})

describe('contrôles d’un testeur', () => {
  it('tout est conforme, sauf le titulaire MoMo pas encore vérifiable', async () => {
    const t = await creerTesteur()
    await pool.query(
      `INSERT INTO documents_identite (utilisateur_id, type, chemin, type_mime, taille_octets)
       VALUES ($1, 'piece_identite', 'x.jpg', 'image/jpeg', 10), ($1, 'selfie', 'y.png', 'image/png', 10)`,
      [t.id],
    )
    const c = parCode(await executerControles(pool, t.id))
    expect(Object.fromEntries(Object.entries(c).map(([code, v]) => [code, v.resultat]))).toEqual({
      momo_doublon: 'ok',
      momo_titulaire: 'indisponible',
      gmail_doublon: 'ok',
      appareil_doublon: 'ok',
      photos_presentes: 'ok',
    })
  })

  it('détecte un téléphone partagé, des photos manquantes et un Gmail déjà utilisé par un développeur', async () => {
    await creerUtilisateur({ email: 'k.offi.agbo@gmail.com' })
    const premier = await creerTesteur({ telephone: '+2290191000000', gmail: 'autre@gmail.com', numeroMomo: '+2290191000001' })
    await pool.query("UPDATE utilisateurs SET statut = 'refuse', motif_refus = 'Photos illisibles, merci.' WHERE id = $1", [premier.id])
    const t = await creerTesteur({ appareil: APPAREIL })
    const c = parCode(await executerControles(pool, t.id))
    expect(c.appareil_doublon).toMatchObject({
      resultat: 'echec',
      detail: 'Ce téléphone est déjà utilisé par 1 autre compte, dont 1 refusé.',
    })
    expect(c.photos_presentes).toMatchObject({ resultat: 'echec', detail: 'Manquant : pièce d’identité et selfie.' })
    expect(c.gmail_doublon.resultat).toBe('alerte')
  })

  it('signale un numéro MoMo demandé par un autre testeur', async () => {
    const autre = await creerTesteur({ telephone: '+2290191000000', gmail: 'autre@gmail.com', numeroMomo: '+2290191000001', appareil: null })
    await pool.query(
      `INSERT INTO demandes_changement_momo (utilisateur_id, numero_momo, operateur_momo, motif)
       VALUES ($1, '+2290196000000', 'mtn', 'Changement de numéro demandé.')`,
      [autre.id],
    )
    const t = await creerTesteur()
    expect(parCode(await executerControles(pool, t.id)).momo_doublon.resultat).toBe('alerte')
  })
})

describe('lancement après une inscription', () => {
  it('lance les contrôles d’un développeur sans retarder la réponse', async () => {
    const test = creerAppTest()
    const r = await request(test.app).post('/api/auth/inscription').send({
      email: 'awa@mailinator.com',
      motDePasse: 'une phrase assez longue',
      nom: 'Studio Awa',
      pays: 'BJ',
      lienFicheDeveloppeur: FICHE,
      accepteConditions: true,
    })
    expect(r.status).toBe(201)
    await test.attendreControles()
    const controles = (await lireControles(pool, [r.body.utilisateur.id])).get(r.body.utilisateur.id)
    expect(controles.etat).toBe('termine')
    expect(parCode(controles.liste).email_jetable.resultat).toBe('alerte')
  })

  it('renvoie « en cours » tant que les contrôles ne sont pas finis', async () => {
    const dev = await developpeur()
    expect((await lireControles(pool, [dev.id])).get(String(dev.id))).toEqual({ etat: 'en_cours', liste: [] })
    expect((await lireControles(pool, [])).size).toBe(0)
  })
})
