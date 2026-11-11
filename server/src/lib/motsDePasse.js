import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)

// scrypt est fourni par Node : pas de dépendance native à compiler (question ouverte n° 4
// du contrat). Paramètres recommandés par l'OWASP : N = 2^17, r = 8, p = 1.
const PARAMETRES = { N: 2 ** 17, r: 8, p: 1 }
const LONGUEUR = 64

function options({ N, r, p }) {
  return { N, r, p, maxmem: 256 * N * r }
}

// Format stocké : scrypt$N$r$p$sel$empreinte (sel et empreinte en base64). Les paramètres
// sont gardés avec l'empreinte pour pouvoir les durcir plus tard sans casser les anciens.
export async function hacherMotDePasse(motDePasse, parametres = PARAMETRES) {
  const sel = randomBytes(16)
  const empreinte = await scryptAsync(motDePasse.normalize('NFC'), sel, LONGUEUR, options(parametres))
  const { N, r, p } = parametres
  return ['scrypt', N, r, p, sel.toString('base64'), empreinte.toString('base64')].join('$')
}

export async function verifierMotDePasse(motDePasse, stocke) {
  const morceaux = typeof stocke === 'string' ? stocke.split('$') : []
  if (morceaux.length !== 6 || morceaux[0] !== 'scrypt') return false
  const [, N, r, p, sel, attendu] = morceaux
  const attenduBuffer = Buffer.from(attendu, 'base64')
  const calcule = await scryptAsync(
    motDePasse.normalize('NFC'),
    Buffer.from(sel, 'base64'),
    attenduBuffer.length,
    options({ N: Number(N), r: Number(r), p: Number(p) }),
  )
  return timingSafeEqual(calcule, attenduBuffer)
}

// Empreinte factice : on la vérifie quand l'email est inconnu pour que la réponse prenne
// le même temps qu'avec un vrai compte (ne pas révéler quels emails existent).
let factice
export async function empreinteFactice() {
  factice ??= await hacherMotDePasse(randomBytes(16).toString('hex'))
  return factice
}
