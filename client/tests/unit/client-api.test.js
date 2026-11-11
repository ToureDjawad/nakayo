import { describe, expect, it, vi } from 'vitest'
import { ErreurApi, ErreurReseau, requete } from '../../src/api/client.js'

function reponse(statut, corps, entetes = {}) {
  const texte = corps === undefined ? null : typeof corps === 'string' ? corps : JSON.stringify(corps)
  return new Response(texte, { status: statut, headers: entetes })
}

describe('requete()', () => {
  it('préfixe /api, envoie du JSON en même origine et renvoie le corps', async () => {
    const fetch = vi.fn().mockResolvedValue(reponse(201, { utilisateur: { id: '1' } }))
    vi.stubGlobal('fetch', fetch)

    const donnees = await requete('/auth/inscription', { methode: 'POST', corps: { email: 'a@b.co' } })

    expect(donnees).toEqual({ utilisateur: { id: '1' } })
    const [url, options] = fetch.mock.calls[0]
    expect(url).toBe('/api/auth/inscription')
    expect(options.method).toBe('POST')
    expect(options.credentials).toBe('same-origin')
    expect(options.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(options.body).toBe('{"email":"a@b.co"}')
  })

  it('n’envoie ni corps ni en-tête JSON pour un GET', async () => {
    const fetch = vi.fn().mockResolvedValue(reponse(200, {}))
    vi.stubGlobal('fetch', fetch)
    await requete('/auth/moi')
    expect(fetch.mock.calls[0][1].body).toBeUndefined()
    expect(fetch.mock.calls[0][1].headers).toBeUndefined()
  })

  it('renvoie null pour une réponse 204', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
    expect(await requete('/auth/deconnexion', { methode: 'POST' })).toBeNull()
  })

  it('transforme une erreur du contrat en ErreurApi avec champs et détails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        reponse(400, { erreur: { code: 'code_invalide', message: 'Code faux', tentativesRestantes: 2, champs: { code: 'format_invalide' } } }),
      ),
    )
    const erreur = await requete('/auth/sms/verification', { methode: 'POST', corps: {} }).catch((e) => e)

    expect(erreur).toBeInstanceOf(ErreurApi)
    expect(erreur.statut).toBe(400)
    expect(erreur.code).toBe('code_invalide')
    expect(erreur.champs).toEqual({ code: 'format_invalide' })
    expect(erreur.details).toEqual({ tentativesRestantes: 2 })
  })

  it('lit l’en-tête Retry-After', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse(429, { erreur: { code: 'trop_de_requetes' } }, { 'Retry-After': '120' })))
    const erreur = await requete('/auth/connexion').catch((e) => e)
    expect(erreur.retryAfter).toBe(120)
  })

  it('supporte une erreur dont le corps n’est pas du JSON (proxy, page HTML)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse(502, '<html>Bad Gateway</html>')))
    const erreur = await requete('/auth/moi').catch((e) => e)
    expect(erreur).toBeInstanceOf(ErreurApi)
    expect(erreur.statut).toBe(502)
    expect(erreur.code).toBe('erreur_inconnue')
    expect(erreur.champs).toBeNull()
  })

  it('accepte l’ancien format { erreur: "texte" } de la route 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reponse(404, { erreur: 'Route introuvable' })))
    const erreur = await requete('/inconnue').catch((e) => e)
    expect(erreur.code).toBe('erreur_inconnue')
    expect(erreur.statut).toBe(404)
  })

  it('transforme une coupure réseau en ErreurReseau', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(requete('/auth/moi')).rejects.toBeInstanceOf(ErreurReseau)
  })

  it('laisse passer une annulation (AbortError)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('annulée', 'AbortError')))
    await expect(requete('/auth/moi')).rejects.toMatchObject({ name: 'AbortError' })
  })
})
