import { createHmac } from 'node:crypto'
import { isIP } from 'node:net'

// US-16 : empreinte du réseau Wi-Fi d'un testeur (docs/api-reseaux.md).

// Un réseau partagé compte s'il a été vu dans les 60 derniers jours.
export const DUREE_RESEAU_JOURS = 60

// Adresse IP ramenée à ce qui identifie la box : l'IPv4 entière, ou le préfixe /64 d'une IPv6
// (chaque appareil d'une même box a sa propre fin d'adresse).
export function reseauDeLAdresse(ip) {
  let adresse = String(ip ?? '').trim()
  if (adresse.startsWith('::ffff:')) adresse = adresse.slice(7)
  if (isIP(adresse) === 4) return adresse
  if (isIP(adresse) !== 6) return null
  const [debut, fin = ''] = adresse.split('::')
  const groupesDebut = debut ? debut.split(':') : []
  const groupesFin = fin ? fin.split(':') : []
  const manquants = adresse.includes('::') ? 8 - groupesDebut.length - groupesFin.length : 0
  const groupes = [...groupesDebut, ...Array(manquants).fill('0'), ...groupesFin]
  return groupes.slice(0, 4).map((g) => g.toLowerCase().replace(/^0+(?=.)/, '')).join(':') + '::/64'
}

// HMAC tronqué à 32 caractères : deux testeurs sur la même box ont la même empreinte,
// et l'adresse ne peut pas être retrouvée sans le secret.
export function empreinteReseau(ip, secret) {
  const reseau = reseauDeLAdresse(ip)
  if (!reseau || !secret) return null
  return createHmac('sha256', secret).update(reseau).digest('hex').slice(0, 32)
}
