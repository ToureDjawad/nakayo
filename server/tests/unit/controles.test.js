import { describe, expect, it } from 'vitest'
import { estJetable } from '../../src/lib/emailsJetables.js'
import { LIBELLES, verifierFichePlay } from '../../src/services/controles.js'

describe('email jetable', () => {
  it('reconnaît les domaines connus, sans tenir compte de la casse', () => {
    expect(estJetable('awa@YOPMAIL.com')).toBe(true)
    expect(estJetable('awa@studio.bj')).toBe(false)
    expect(estJetable(null)).toBe(false)
  })
})

describe('libellés des contrôles', () => {
  it('décrivent la vérification réussie, pas le risque', () => {
    for (const libelle of Object.values(LIBELLES)) {
      expect(libelle).not.toMatch(/déjà|doublon|manquant|^email jetable/i)
    }
  })
})

describe('fiche Google Play accessible', () => {
  const repondre = (status) => async () => ({ ok: status >= 200 && status < 300, status })

  it('ok si la fiche répond, échec si Google Play répond 404', async () => {
    expect((await verifierFichePlay('https://play.google.com/store/apps/dev?id=1', { fetch: repondre(200) })).resultat).toBe('ok')
    const absente = await verifierFichePlay('https://play.google.com/store/apps/dev?id=1', { fetch: repondre(404) })
    expect(absente).toMatchObject({ resultat: 'echec', libelle: 'Fiche développeur Google Play accessible' })
    expect(absente.detail).toMatch(/n’existe pas/)
  })

  it('indisponible si Google Play bloque ou ne répond pas', async () => {
    expect((await verifierFichePlay('https://x', { fetch: repondre(429) })).resultat).toBe('indisponible')
    const panne = async () => {
      throw new Error('réseau coupé')
    }
    expect((await verifierFichePlay('https://x', { fetch: panne })).resultat).toBe('indisponible')
  })
})
