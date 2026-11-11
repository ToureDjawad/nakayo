import { randomBytes } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png' }

// Les pièces d'identité restent hors du dossier public : elles ne sont servies que par la
// route admin (§5.2). Le chemin enregistré est relatif au dossier de stockage.
export async function ecrireDocument(dossier, { utilisateurId, type, typeMime, contenu }) {
  const relatif = path.join(String(utilisateurId), `${type}-${randomBytes(8).toString('hex')}.${EXTENSIONS[typeMime]}`)
  await mkdir(path.join(dossier, String(utilisateurId)), { recursive: true, mode: 0o700 })
  await writeFile(path.join(dossier, relatif), contenu, { mode: 0o600 })
  return relatif
}

export async function supprimerDocuments(dossier, chemins) {
  await Promise.all(chemins.map((c) => rm(path.join(dossier, c), { force: true })))
}

export function cheminAbsolu(dossier, relatif) {
  const absolu = path.resolve(dossier, relatif)
  if (!absolu.startsWith(path.resolve(dossier) + path.sep)) throw new Error('Chemin de document invalide')
  return absolu
}
