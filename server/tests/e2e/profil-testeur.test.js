import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { creerTesteur } from '../fabriques.js'
import { viderBase } from '../outils.js'
import { demarrerServeur } from './serveur.js'

describe('profil testeur sur le serveur réel', () => {
  let serveur
  let jeton
  const appel = (methode, chemin, corps) =>
    fetch(`${serveur.url}${chemin}`, {
      method: methode,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}` },
      body: corps ? JSON.stringify(corps) : undefined,
    })

  beforeAll(async () => {
    await viderBase()
    ;({ jeton } = await creerTesteur())
    serveur = await demarrerServeur()
  })
  afterAll(() => serveur?.arreter())

  it('langues, demande de changement MoMo, puis profil à jour', async () => {
    expect((await appel('PATCH', '/api/testeurs/moi', { langues: ['fr', 'en'] })).status).toBe(200)
    const refus = await appel('PATCH', '/api/testeurs/moi', { numeroMomo: '+2290195000000' })
    expect((await refus.json()).erreur.champs).toEqual({ numeroMomo: 'non_modifiable' })

    const demande = await appel('POST', '/api/testeurs/moi/demande-changement-momo', {
      numeroMomo: '+2290195000000',
      operateurMomo: 'moov',
      motif: 'Je passe chez Moov pour mon nouveau téléphone.',
    })
    expect(demande.status).toBe(201)

    const profil = (await (await appel('GET', '/api/testeurs/moi')).json()).utilisateur
    expect(profil.langues).toEqual(['fr', 'en'])
    expect(profil.numeroMomo).toBe('+2290196000000')
    expect(profil.demandeChangementMomo).toMatchObject({ numeroMomo: '+2290195000000', statut: 'en_attente' })
  })
})
