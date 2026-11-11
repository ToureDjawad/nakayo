import { describe, expect, it } from 'vitest'
import { empreinteFactice, hacherMotDePasse, verifierMotDePasse } from '../../src/lib/motsDePasse.js'

const RAPIDE = { N: 2 ** 10, r: 8, p: 1 }

describe('mots de passe (scrypt)', () => {
  it('stocke les paramètres, un sel et une empreinte, jamais le mot de passe', async () => {
    const stocke = await hacherMotDePasse('une phrase assez longue', RAPIDE)
    expect(stocke).toMatch(/^scrypt\$1024\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/)
    expect(stocke).not.toContain('phrase')
  })

  it('utilise un sel différent à chaque fois', async () => {
    const a = await hacherMotDePasse('meme mot de passe', RAPIDE)
    const b = await hacherMotDePasse('meme mot de passe', RAPIDE)
    expect(a).not.toBe(b)
  })

  it('reconnaît le bon mot de passe et refuse les autres', async () => {
    const stocke = await hacherMotDePasse('une phrase assez longue', RAPIDE)
    expect(await verifierMotDePasse('une phrase assez longue', stocke)).toBe(true)
    expect(await verifierMotDePasse('une phrase assez longuE', stocke)).toBe(false)
    expect(await verifierMotDePasse('', stocke)).toBe(false)
  })

  it('compare les accents de la même façon quelle que soit leur saisie (NFC)', async () => {
    const stocke = await hacherMotDePasse('café au lait chaud', RAPIDE)
    expect(await verifierMotDePasse('café au lait chaud', stocke)).toBe(true)
  })

  it('refuse une empreinte absente ou mal formée sans planter', async () => {
    expect(await verifierMotDePasse('x', null)).toBe(false)
    expect(await verifierMotDePasse('x', 'bcrypt$abc')).toBe(false)
  })

  it('fournit une empreinte factice stable que rien ne valide', async () => {
    const factice = await empreinteFactice()
    expect(await empreinteFactice()).toBe(factice)
    expect(await verifierMotDePasse('motdepasse-valide', factice)).toBe(false)
  })
})
