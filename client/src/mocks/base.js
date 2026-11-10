// « Base de données » de l'API simulée, gardée dans le localStorage du navigateur
// pour survivre aux rechargements. Réinitialiser : nakayoMocks.reinitialiser() dans la console.
import { comptesDemo } from './comptesDemo.js'

const CLE = 'nakayo:mocks:v2'

function maintenant(decalageJours = 0) {
  return new Date(Date.now() + decalageJours * 86400000).toISOString()
}

function donneesInitiales() {
  return {
    prochainId: 100,
    sessionId: null,
    jetons: {},
    utilisateurs: [
      {
        id: '1',
        role: 'admin',
        statut: 'valide',
        emailVerifie: true,
        email: 'admin@nakayo.test',
        motDePasse: 'admin-nakayo-2026',
        nom: 'Équipe Nakayo',
        pays: 'BJ',
        lienFicheDeveloppeur: null,
        motifRefus: null,
        creeLe: maintenant(-30),
      },
      {
        id: '2',
        role: 'developpeur',
        statut: 'valide',
        emailVerifie: true,
        email: 'valide@exemple.com',
        motDePasse: 'motdepasse-valide',
        nom: 'Studio Exemple',
        pays: 'SN',
        lienFicheDeveloppeur: 'https://play.google.com/store/apps/dev?id=5550000000000000001',
        motifRefus: null,
        creeLe: maintenant(-12),
      },
      {
        id: '3',
        role: 'developpeur',
        statut: 'refuse',
        emailVerifie: true,
        email: 'refuse@exemple.com',
        motDePasse: 'motdepasse-refuse',
        nom: 'Exemple Refusé',
        pays: 'FR',
        lienFicheDeveloppeur: 'https://play.google.com/store/apps/dev?id=5550000000000000002',
        motifRefus: 'La fiche Google Play indiquée ne correspond pas au nom de développeur saisi.',
        creeLe: maintenant(-5),
      },
      ...comptesDemo(),
    ],
  }
}

let cache = null

export function base() {
  if (cache) return cache
  try {
    cache = JSON.parse(localStorage.getItem(CLE)) ?? donneesInitiales()
  } catch {
    cache = donneesInitiales()
  }
  return cache
}

export function sauver() {
  try {
    localStorage.setItem(CLE, JSON.stringify(cache))
  } catch {
    // stockage indisponible : les données restent en mémoire
  }
}

export function reinitialiser() {
  cache = donneesInitiales()
  sauver()
}

export function nouvelId() {
  const b = base()
  b.prochainId += 1
  return String(b.prochainId)
}

export function horodatage() {
  return maintenant()
}

// Ouvre une session simulée (en attendant l'écran de connexion de US-09).
export function connecter(email) {
  const b = base()
  const utilisateur = b.utilisateurs.find((u) => u.email === email)
  if (!utilisateur) return `Aucun compte simulé pour ${email}`
  b.sessionId = utilisateur.id
  sauver()
  return `Session ouverte pour ${email} (${utilisateur.role})`
}
