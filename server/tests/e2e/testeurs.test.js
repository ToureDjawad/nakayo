import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { APPAREIL, FORMULAIRE_TESTEUR, JPEG, PNG } from '../fabriques.js'
import { viderBase } from '../outils.js'
import { demarrerServeur } from './serveur.js'

describe('inscription puis connexion d’un testeur sur le serveur réel', () => {
  let serveur
  const json = (chemin, corps, jeton) =>
    fetch(`${serveur.url}${chemin}`, {
      method: corps ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}) },
      body: corps ? JSON.stringify(corps) : undefined,
    })

  async function codeRecu(dejaVus) {
    for (let i = 0; i < 40; i++) {
      const tous = [...serveur.journal.join('').matchAll(/votre code est (\d{6})/g)]
      if (tous.length > dejaVus) return tous.at(-1)[1]
      await new Promise((r) => setTimeout(r, 50))
    }
    throw new Error('Aucun SMS dans le journal')
  }

  beforeAll(async () => {
    await viderBase()
    serveur = await demarrerServeur({ DOSSIER_DOCUMENTS: mkdtempSync(path.join(tmpdir(), 'nakayo-e2e-')) })
  })
  afterAll(() => serveur?.arreter())

  it('code SMS, formulaire avec photos, profil, déconnexion puis reconnexion par SMS', async () => {
    expect((await json('/api/auth/sms/envoi', { telephone: '01 97 00 00 00' })).status).toBe(202)
    const verification = await json('/api/auth/sms/verification', {
      telephone: '+2290197000000',
      code: await codeRecu(0),
      appareil: APPAREIL,
    })
    const { resultat, jetonInscription } = await verification.json()
    expect(resultat).toBe('inscription')

    const formulaire = new FormData()
    for (const [cle, valeur] of Object.entries(FORMULAIRE_TESTEUR)) formulaire.append(cle, valeur)
    formulaire.append('appareil', JSON.stringify(APPAREIL))
    formulaire.append('pieceIdentite', new Blob([JPEG], { type: 'image/jpeg' }), 'piece.jpg')
    formulaire.append('selfie', new Blob([PNG], { type: 'image/png' }), 'selfie.png')
    const inscription = await fetch(`${serveur.url}/api/testeurs/inscription`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jetonInscription}` },
      body: formulaire,
    })
    expect(inscription.status).toBe(201)
    const { jeton } = await inscription.json()

    const moi = await json('/api/auth/moi', null, jeton)
    expect((await moi.json()).utilisateur).toMatchObject({ role: 'testeur', statut: 'en_attente', ville: 'Cotonou' })

    expect((await json('/api/auth/deconnexion', {}, jeton)).status).toBe(204)
    expect((await json('/api/auth/moi', null, jeton)).status).toBe(401)

    // Un second SMS n'est permis qu'après une minute : on vérifie la limite, puis on redémarre
    // le serveur (compteurs en mémoire) pour tester la reconnexion sans attendre.
    expect((await json('/api/auth/sms/envoi', { telephone: '+2290197000000' })).status).toBe(429)
    await serveur.arreter()
    serveur = await demarrerServeur({ DOSSIER_DOCUMENTS: mkdtempSync(path.join(tmpdir(), 'nakayo-e2e-')) })
    expect((await json('/api/auth/sms/envoi', { telephone: '+2290197000000' })).status).toBe(202)
    const reconnexion = await json('/api/auth/sms/verification', {
      telephone: '+2290197000000',
      code: await codeRecu(0),
      appareil: APPAREIL,
    })
    const corps = await reconnexion.json()
    expect(corps.resultat).toBe('connecte')
    expect(corps.utilisateur.nom).toBe('Koffi Agbo')
  })
})
