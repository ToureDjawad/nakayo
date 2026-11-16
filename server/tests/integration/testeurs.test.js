import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { APPAREIL, FORMULAIRE_TESTEUR, JPEG, PNG } from '../fabriques.js'
import { creerAppTest, pool, viderBase } from '../outils.js'

const TELEPHONE = '+2290197000000'

let test
beforeEach(async () => {
  await viderBase()
  test = creerAppTest()
})

const envoyerCode = (telephone = TELEPHONE) => request(test.app).post('/api/auth/sms/envoi').send({ telephone })
const verifierCode = (code, { telephone = TELEPHONE, appareil = APPAREIL } = {}) =>
  request(test.app).post('/api/auth/sms/verification').send({ telephone, code, appareil })
const dernierCode = (telephone = TELEPHONE) => test.sms.dernierPour(telephone).code

async function jetonInscription(telephone = TELEPHONE) {
  await envoyerCode(telephone)
  const r = await verifierCode(dernierCode(telephone), { telephone })
  expect(r.body.resultat).toBe('inscription')
  return r.body.jetonInscription
}

function inscrire(jeton, { champs = FORMULAIRE_TESTEUR, appareil = APPAREIL, piece = JPEG, selfie = PNG } = {}) {
  let r = request(test.app).post('/api/testeurs/inscription')
  if (jeton) r = r.set('Authorization', `Bearer ${jeton}`)
  for (const [cle, valeur] of Object.entries(champs)) r = r.field(cle, valeur)
  if (appareil) r = r.field('appareil', JSON.stringify(appareil))
  if (piece) r = r.attach('pieceIdentite', piece, { filename: 'piece.jpg', contentType: 'image/jpeg' })
  if (selfie) r = r.attach('selfie', selfie, { filename: 'selfie.png', contentType: 'image/png' })
  return r
}

describe('envoi du code SMS (§4.1)', () => {
  it('envoie un code à 6 chiffres valable 10 min', async () => {
    const r = await envoyerCode('01 97 00 00 00')
    expect(r.status).toBe(202)
    expect(r.body).toEqual({ expireDans: 600, renvoiPossibleDans: 60 })
    const sms = test.sms.dernierPour(TELEPHONE)
    expect(sms.code).toMatch(/^\d{6}$/)
    expect(sms.texte).toContain(sms.code)
    const { rows } = await pool.query('SELECT code_hash FROM codes_sms')
    expect(rows[0].code_hash.toString('utf8')).not.toContain(sms.code)
  })

  it('refuse un numéro hors du Bénin (422)', async () => {
    const r = await envoyerCode('+33612345678')
    expect(r.status).toBe(422)
    expect(r.body.erreur.champs).toEqual({ telephone: 'format_invalide' })
  })

  it('limite à un SMS par minute et 5 par heure', async () => {
    await envoyerCode()
    const r = await envoyerCode()
    expect(r.status).toBe(429)
    expect(r.headers['retry-after']).toBeDefined()
    for (let i = 0; i < 4; i++) {
      test.avancer(61 * 1000)
      expect((await envoyerCode()).status).toBe(202)
    }
    test.avancer(61 * 1000)
    expect((await envoyerCode()).status).toBe(429)
  })

  it('répond 503 si le fournisseur SMS est en panne, sans bloquer un nouvel essai', async () => {
    const envoyer = test.sms.envoyer
    test.sms.envoyer = async () => {
      throw new Error('fournisseur en panne')
    }
    const r = await envoyerCode()
    expect(r.status).toBe(503)
    expect(r.body.erreur.code).toBe('service_indisponible')
    test.sms.envoyer = envoyer
    expect((await envoyerCode()).status).toBe(202)
  })
})

describe('vérification du code SMS (§4.2)', () => {
  it('donne un jeton d’inscription de 30 min pour un numéro inconnu', async () => {
    await envoyerCode()
    const r = await verifierCode(dernierCode())
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ resultat: 'inscription', expireDans: 1800 })
    expect(r.body.jetonInscription).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it('compte les codes faux et invalide le code au 5e', async () => {
    await envoyerCode()
    const bon = dernierCode()
    const faux = bon === '000000' ? '111111' : '000000'
    for (let restantes = 4; restantes >= 1; restantes--) {
      const r = await verifierCode(faux)
      expect(r.status).toBe(400)
      expect(r.body.erreur).toMatchObject({ code: 'code_invalide', tentativesRestantes: restantes })
    }
    const cinquieme = await verifierCode(faux)
    expect(cinquieme.status).toBe(429)
    expect((await verifierCode(bon)).status).toBe(410)
  })

  it('refuse un code de plus de 10 min (410 code_expire)', async () => {
    await envoyerCode()
    test.avancer(10 * 60 * 1000 + 1000)
    const r = await verifierCode(dernierCode())
    expect(r.status).toBe(410)
    expect(r.body.erreur.code).toBe('code_expire')
  })

  it('n’accepte un code qu’une fois, et seulement le dernier envoyé', async () => {
    await envoyerCode()
    const ancien = dernierCode()
    test.avancer(61 * 1000)
    await envoyerCode()
    if (ancien !== dernierCode()) expect((await verifierCode(ancien)).status).toBe(400)
    expect((await verifierCode(dernierCode())).status).toBe(200)
    expect((await verifierCode(dernierCode())).status).toBe(410)
  })

  it('valide le numéro, le code et l’appareil (422)', async () => {
    const r = await request(test.app).post('/api/auth/sms/verification').send({ telephone: '123', code: '12', appareil: {} })
    expect(r.status).toBe(422)
    expect(r.body.erreur.champs).toEqual({ telephone: 'format_invalide', code: 'format_invalide', appareil: 'format_invalide' })
  })

  it('connecte un testeur déjà inscrit avec un jeton Bearer', async () => {
    await inscrire(await jetonInscription())
    test.avancer(61 * 1000)
    await envoyerCode()
    const r = await verifierCode(dernierCode(), { appareil: { ...APPAREIL, versionAndroid: '15', niveauApi: 35 } })
    expect(r.status).toBe(200)
    expect(r.body.resultat).toBe('connecte')
    expect(r.body.utilisateur).toMatchObject({ role: 'testeur', telephone: TELEPHONE, appareil: { versionAndroid: '15' } })
    const moi = await request(test.app).get('/api/auth/moi').set('Authorization', `Bearer ${r.body.jeton}`)
    expect(moi.body.utilisateur.gmail).toBe('koffi.agbo@gmail.com')
  })

  it('refuse un testeur suspendu (403)', async () => {
    await inscrire(await jetonInscription())
    await pool.query("UPDATE utilisateurs SET statut = 'suspendu'")
    test.avancer(61 * 1000)
    await envoyerCode()
    const r = await verifierCode(dernierCode())
    expect(r.status).toBe(403)
    expect(r.body.erreur.code).toBe('compte_suspendu')
  })
})

describe('inscription d’un testeur (§4.3)', () => {
  it('crée le compte en attente, range les photos et ouvre une session Android', async () => {
    const r = await inscrire(await jetonInscription())
    expect(r.status).toBe(201)
    expect(r.body.jeton).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(r.body.utilisateur).toEqual({
      id: expect.any(String),
      role: 'testeur',
      statut: 'en_attente',
      telephone: TELEPHONE,
      nom: 'Koffi Agbo',
      ville: 'Cotonou',
      gmail: 'koffi.agbo@gmail.com',
      numeroMomo: '+2290196000000',
      operateurMomo: 'mtn',
      langues: [],
      appareil: { fabricant: 'Tecno', modele: 'Spark 20', versionAndroid: '14', niveauApi: 34 },
      demandeChangementMomo: null,
      motifRefus: null,
      creeLe: expect.any(String),
      niveau: {
        code: 'bronze',
        nom: 'Bronze',
        campagnesTerminees: 0,
        bugsAcceptes: 0,
        assiduite: 50,
        suivant: { code: 'argent', nom: 'Argent', conditions: [{ code: 'campagnes', requis: 1, actuel: 0, rempli: false }] },
      },
    })

    const { rows } = await pool.query('SELECT type, chemin, type_mime, taille_octets FROM documents_identite ORDER BY type')
    expect(rows.map((d) => [d.type, d.type_mime])).toEqual([
      ['piece_identite', 'image/jpeg'],
      ['selfie', 'image/png'],
    ])
    expect(readFileSync(path.join(test.dossierDocuments, rows[0].chemin)).equals(JPEG)).toBe(true)

    const { rows: u } = await pool.query('SELECT telephone_verifie_le, email FROM utilisateurs')
    expect(u[0].telephone_verifie_le).not.toBeNull()
    expect(u[0].email).toBeNull()

    const moi = await request(test.app).get('/api/auth/moi').set('Authorization', `Bearer ${r.body.jeton}`)
    expect(moi.body.utilisateur.role).toBe('testeur')
  })

  it('n’utilise le jeton d’inscription qu’une fois', async () => {
    const jeton = await jetonInscription()
    await inscrire(jeton)
    const r = await inscrire(jeton, { champs: { ...FORMULAIRE_TESTEUR, gmail: 'autre@gmail.com', numeroMomo: '+2290195000000' } })
    expect(r.status).toBe(401)
  })

  it('répond 401 sans jeton, avec un faux jeton ou un jeton de plus de 30 min', async () => {
    expect((await inscrire(null)).status).toBe(401)
    expect((await inscrire('faux')).status).toBe(401)
    const jeton = await jetonInscription()
    test.avancer(31 * 60 * 1000)
    const r = await inscrire(jeton)
    expect(r.status).toBe(401)
    expect(r.body.erreur.code).toBe('non_authentifie')
  })

  it('valide tous les champs et les photos (422)', async () => {
    const r = await inscrire(await jetonInscription(), {
      champs: { nom: 'K', ville: '', gmail: 'koffi@yahoo.fr', numeroMomo: '97000000', operateurMomo: 'celtiis', consentementSuivi: 'false' },
      appareil: null,
      piece: Buffer.from('GIF89a pas une photo acceptée'),
      selfie: null,
    })
    // L'appareil manquant est repris de la vérification du code : pas d'erreur sur ce champ.
    expect(r.status).toBe(422)
    expect(r.body.erreur.champs).toEqual({
      nom: 'trop_court',
      ville: 'requis',
      gmail: 'non_gmail',
      numeroMomo: 'format_invalide',
      operateurMomo: 'valeur_inconnue',
      consentementSuivi: 'doit_etre_accepte',
      accepteConditions: 'doit_etre_accepte',
      pieceIdentite: 'type_fichier_invalide',
      selfie: 'requis',
    })
  })

  it('refuse une photo de plus de 5 Mo (413)', async () => {
    const lourde = Buffer.concat([JPEG, Buffer.alloc(5 * 1024 * 1024)])
    const r = await inscrire(await jetonInscription(), { piece: lourde })
    expect(r.status).toBe(413)
    expect(r.body.erreur).toMatchObject({ code: 'fichier_trop_lourd', champs: { pieceIdentite: 'fichier_trop_lourd' } })
  })

  it('refuse un Gmail déjà utilisé, même écrit autrement, et un numéro MoMo déjà utilisé (409)', async () => {
    await inscrire(await jetonInscription())
    const r = await inscrire(await jetonInscription('+2290191000000'), {
      champs: { ...FORMULAIRE_TESTEUR, gmail: 'Koffi.Agbo+nakayo@gmail.com' },
    })
    expect(r.status).toBe(409)
    expect(r.body.erreur.champs).toEqual({ gmail: 'deja_utilise', numeroMomo: 'deja_utilise' })
  })

  it('ne laisse aucune photo sur le disque si l’inscription échoue', async () => {
    await pool.query(
      `CREATE OR REPLACE FUNCTION echec_test() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'panne'; END $$ LANGUAGE plpgsql;
       CREATE TRIGGER echec_test BEFORE INSERT ON sessions FOR EACH ROW EXECUTE FUNCTION echec_test();`,
    )
    try {
      const jeton = await jetonInscription()
      const r = await inscrire(jeton)
      expect(r.status).toBe(500)
      const dossiers = existsSync(test.dossierDocuments) ? readdirSync(test.dossierDocuments, { recursive: true }) : []
      expect(dossiers.filter((f) => /\.(jpg|png)$/.test(f))).toEqual([])
      expect((await pool.query('SELECT count(*)::int AS n FROM utilisateurs')).rows[0].n).toBe(0)
    } finally {
      await pool.query('DROP TRIGGER echec_test ON sessions; DROP FUNCTION echec_test();')
    }
  })

  it('exige un formulaire multipart', async () => {
    const r = await request(test.app)
      .post('/api/testeurs/inscription')
      .set('Authorization', `Bearer ${await jetonInscription()}`)
      .send(FORMULAIRE_TESTEUR)
    expect(r.status).toBe(422)
  })
})
