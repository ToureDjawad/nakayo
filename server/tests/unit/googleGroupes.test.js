import { createVerify, generateKeyPairSync } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { assertionJwt, creerClientGroupes, PORTEES, URL_DIRECTORY, URL_REGLAGES } from '../../src/services/googleGroupes.js'

// US-43 : client de l'API Admin SDK (docs/groupes-google.md).
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const COMPTE = {
  client_email: 'nakayo@projet.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  token_uri: 'https://oauth2.googleapis.com/token',
}
const MAINTENANT = new Date('2026-11-16T10:00:00Z')

function fauxFetch(reponses = {}) {
  const appels = []
  const fetch = async (url, options) => {
    appels.push({ url, ...options })
    if (url === COMPTE.token_uri) return { ok: true, status: 200, json: async () => ({ access_token: 'jeton-google', expires_in: 3600 }) }
    const statut = reponses[`${options.method} ${url}`] ?? 200
    return { ok: statut < 300, status: statut, json: async () => ({}) }
  }
  return { fetch, appels }
}

describe('client Groupes Google', () => {
  it('signe une assertion JWT RS256 au nom de l’administrateur délégué', () => {
    const jwt = assertionJwt({ compte: COMPTE, administrateur: 'admin@nakayo.bj', maintenant: MAINTENANT })
    const [entete, charge, signature] = jwt.split('.')
    expect(JSON.parse(Buffer.from(entete, 'base64url'))).toEqual({ alg: 'RS256', typ: 'JWT' })
    expect(JSON.parse(Buffer.from(charge, 'base64url'))).toEqual({
      iss: COMPTE.client_email,
      sub: 'admin@nakayo.bj',
      scope: PORTEES.join(' '),
      aud: COMPTE.token_uri,
      iat: 1794823200,
      exp: 1794826800,
    })
    expect(createVerify('RSA-SHA256').update(`${entete}.${charge}`).verify(publicKey, signature, 'base64url')).toBe(true)
  })

  it('crée le groupe ouvert aux Gmail, ajoute et retire des membres, avec un seul jeton', async () => {
    const adresse = 'nakayo-app-12@groupes.nakayo.bj'
    const cle = encodeURIComponent(adresse)
    const { fetch, appels } = fauxFetch({
      [`POST ${URL_DIRECTORY}/groups`]: 409,
      [`DELETE ${URL_DIRECTORY}/groups/${cle}/members/${encodeURIComponent('parti@gmail.com')}`]: 404,
    })
    const client = creerClientGroupes({ compte: COMPTE, administrateur: 'admin@nakayo.bj', domaine: 'groupes.nakayo.bj' }, { fetch, maintenant: () => MAINTENANT })

    await client.creerGroupe({ adresse, nom: 'Testeurs Nakayo · Marché Facile', description: 'Testeurs' })
    await client.ajouterMembre(adresse, 'afi@gmail.com')
    await client.retirerMembre(adresse, 'parti@gmail.com')

    expect(appels.filter((a) => a.url === COMPTE.token_uri)).toHaveLength(1)
    expect(new URLSearchParams(appels[0].body).get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer')
    const api = appels.slice(1)
    expect(api.map((a) => `${a.method} ${a.url}`)).toEqual([
      `POST ${URL_DIRECTORY}/groups`,
      `PATCH ${URL_REGLAGES}/${cle}`,
      `POST ${URL_DIRECTORY}/groups/${cle}/members`,
      `DELETE ${URL_DIRECTORY}/groups/${cle}/members/${encodeURIComponent('parti@gmail.com')}`,
    ])
    expect(api.every((a) => a.headers.Authorization === 'Bearer jeton-google')).toBe(true)
    expect(JSON.parse(api[1].body)).toMatchObject({ allowExternalMembers: 'true' })
    expect(JSON.parse(api[2].body)).toEqual({ email: 'afi@gmail.com', role: 'MEMBER' })
  })

  it('remonte une erreur Google', async () => {
    const { fetch } = fauxFetch({ [`POST ${URL_DIRECTORY}/groups/x%40d/members`]: 403 })
    const client = creerClientGroupes({ compte: COMPTE, administrateur: 'a@d', domaine: 'd' }, { fetch, maintenant: () => MAINTENANT })
    await expect(client.ajouterMembre('x@d', 'afi@gmail.com')).rejects.toMatchObject({ name: 'ErreurGoogle', statut: 403 })
  })
})
