import { createHash, randomBytes } from 'node:crypto'

// Jeton envoyé au client (cookie, Bearer, lien d'email). Seule son empreinte SHA-256 est
// stockée : une fuite de la base ne donne accès à aucune session ni à aucun lien.
export function genererJeton() {
  return randomBytes(32).toString('base64url')
}

export function hacherJeton(jeton) {
  return createHash('sha256').update(String(jeton)).digest()
}
