import { createSign } from 'node:crypto'
import { readFileSync } from 'node:fs'

// US-43 : Groupes Google des campagnes (docs/groupes-google.md), par l'API Admin SDK de
// Google Workspace. Compte de service avec délégation au niveau du domaine : il agit au nom
// d'un administrateur du domaine. Client HTTP sans dépendance ; `fetch` est injectable.

export const URL_DIRECTORY = 'https://admin.googleapis.com/admin/directory/v1'
export const URL_REGLAGES = 'https://www.googleapis.com/groups/v1/groups'
export const PORTEES = [
  'https://www.googleapis.com/auth/admin.directory.group',
  'https://www.googleapis.com/auth/apps.groups.settings',
]

export class ErreurGoogle extends Error {
  constructor(message, { statut } = {}) {
    super(message)
    this.name = 'ErreurGoogle'
    this.statut = statut
  }
}

const base64url = (valeur) => Buffer.from(valeur).toString('base64url')

// Assertion JWT signée RS256 pour obtenir un jeton d'accès (flux « service account »).
export function assertionJwt({ compte, administrateur, maintenant }) {
  const iat = Math.floor(maintenant.getTime() / 1000)
  const entete = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const charge = base64url(
    JSON.stringify({ iss: compte.client_email, sub: administrateur, scope: PORTEES.join(' '), aud: compte.token_uri, iat, exp: iat + 3600 }),
  )
  const signature = createSign('RSA-SHA256').update(`${entete}.${charge}`).sign(compte.private_key, 'base64url')
  return `${entete}.${charge}.${signature}`
}

// Adresse du groupe d'une app : « nakayo-app-12@groupes.exemple.com ».
export const adresseGroupe = (appId, domaine) => `nakayo-app-${appId}@${domaine}`

export function creerClientGroupes({ compte, administrateur, domaine }, { fetch: appel = fetch, maintenant = () => new Date() } = {}) {
  let jeton = null

  async function jetonAcces() {
    if (jeton && jeton.expire > maintenant().getTime() + 60_000) return jeton.valeur
    const reponse = await appel(compte.token_uri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: assertionJwt({ compte, administrateur, maintenant: maintenant() }),
      }).toString(),
    })
    const corps = await reponse.json().catch(() => ({}))
    if (!reponse.ok || !corps.access_token) throw new ErreurGoogle(`Jeton Google refusé (${reponse.status}).`, { statut: reponse.status })
    jeton = { valeur: corps.access_token, expire: maintenant().getTime() + (corps.expires_in ?? 3600) * 1000 }
    return jeton.valeur
  }

  // `toleres` : statuts acceptés sans erreur (409 déjà existant, 404 déjà retiré).
  async function requete(url, { methode = 'GET', corps, toleres = [] } = {}) {
    const reponse = await appel(url, {
      method: methode,
      headers: { Authorization: `Bearer ${await jetonAcces()}`, ...(corps && { 'Content-Type': 'application/json' }) },
      ...(corps && { body: JSON.stringify(corps) }),
    })
    if (reponse.ok || toleres.includes(reponse.status)) return reponse.status
    throw new ErreurGoogle(`Google a répondu ${reponse.status} (${methode} ${url}).`, { statut: reponse.status })
  }

  const cle = (adresse) => encodeURIComponent(adresse)

  return {
    domaine,
    // Crée le groupe (ou le garde s'il existe), puis l'ouvre aux Gmail extérieurs au domaine.
    async creerGroupe({ adresse, nom, description }) {
      await requete(`${URL_DIRECTORY}/groups`, { methode: 'POST', corps: { email: adresse, name: nom, description }, toleres: [409] })
      await requete(`${URL_REGLAGES}/${cle(adresse)}`, {
        methode: 'PATCH',
        corps: { allowExternalMembers: 'true', whoCanJoin: 'INVITED_CAN_JOIN', whoCanViewMembership: 'ALL_MANAGERS_CAN_VIEW' },
      })
    },
    async ajouterMembre(adresse, email) {
      await requete(`${URL_DIRECTORY}/groups/${cle(adresse)}/members`, { methode: 'POST', corps: { email, role: 'MEMBER' }, toleres: [409] })
    },
    async retirerMembre(adresse, email) {
      await requete(`${URL_DIRECTORY}/groups/${cle(adresse)}/members/${cle(email)}`, { methode: 'DELETE', toleres: [404] })
    },
  }
}

// Client configuré, ou null tant que Google Workspace n'est pas branché.
export function creerGroupesDepuisConfig(config) {
  const { fichierCompteService, administrateur, domaine } = config.googleWorkspace ?? {}
  if (!fichierCompteService || !administrateur || !domaine) return null
  const compte = JSON.parse(readFileSync(fichierCompteService, 'utf8'))
  return creerClientGroupes({ compte: { token_uri: 'https://oauth2.googleapis.com/token', ...compte }, administrateur, domaine })
}

// Groupe de l'app : créé au premier besoin (préparation du lancement). Sans client, ou si
// Google ne répond pas, le groupe unique configuré (GROUPE_GOOGLE_TESTEURS) est utilisé.
export async function groupeDeLApp(deps, app) {
  const { pool, groupes, config, journal, maintenant } = deps
  if (app.groupe_google) return app.groupe_google
  if (!groupes) return config.groupeTesteurs
  const adresse = adresseGroupe(app.id, groupes.domaine)
  try {
    await groupes.creerGroupe({ adresse, nom: `Testeurs Nakayo · ${app.nom}`.slice(0, 120), description: `Testeurs Nakayo de ${app.package}` })
  } catch (erreur) {
    journal.error(erreur)
    return config.groupeTesteurs
  }
  await pool.query('UPDATE apps SET groupe_google = $2, groupe_google_cree_le = $3 WHERE id = $1 AND groupe_google IS NULL', [app.id, adresse, maintenant()])
  return adresse
}

// Ajoute les testeurs actifs à leur groupe et retire les testeurs remplacés. Chaque échec est
// journalisé et repris au passage suivant ; les testeurs restent dans le groupe après la campagne
// (le développeur en a encore besoin pour demander l'accès à la production).
export async function synchroniserGroupes(deps) {
  const { pool, groupes, journal, maintenant } = deps
  const bilan = { ajoutes: 0, retires: 0, echecs: 0 }
  if (!groupes) return bilan
  const { rows } = await pool.query(
    `SELECT a.id, a.statut, a.groupe_ajoute_le, ap.groupe_google AS groupe, p.gmail
       FROM affectations a
       JOIN campagnes c ON c.id = a.campagne_id
       JOIN apps ap ON ap.id = a.app_id
       JOIN profils_testeurs p ON p.utilisateur_id = a.testeur_id
      WHERE ap.groupe_google IS NOT NULL
        AND ((a.groupe_ajoute_le IS NULL AND a.statut = 'active' AND c.statut = 'en_cours')
          OR (a.groupe_ajoute_le IS NOT NULL AND a.groupe_retire_le IS NULL AND a.statut <> 'active'))
      ORDER BY a.id LIMIT 200`,
  )
  for (const a of rows) {
    const ajout = a.statut === 'active'
    try {
      if (ajout) await groupes.ajouterMembre(a.groupe, a.gmail)
      else await groupes.retirerMembre(a.groupe, a.gmail)
    } catch (erreur) {
      journal.error(erreur)
      bilan.echecs++
      continue
    }
    await pool.query(`UPDATE affectations SET ${ajout ? 'groupe_ajoute_le' : 'groupe_retire_le'} = $2 WHERE id = $1`, [a.id, maintenant()])
    if (ajout) bilan.ajoutes++
    else bilan.retires++
  }
  return bilan
}

// Lancé après un démarrage ou un remplacement, sans bloquer la réponse ; un seul à la fois.
export function creerSynchroGroupes(deps) {
  let enCours = null
  return {
    lancer() {
      if (!deps.groupes) return Promise.resolve(null)
      if (enCours) return enCours.then(() => this.lancer())
      enCours = synchroniserGroupes(deps)
        .catch((erreur) => deps.journal.error(erreur))
        .finally(() => {
          enCours = null
        })
      return enCours
    },
  }
}

export function demarrerSynchroGroupes(deps, { intervalleMs = 15 * 60 * 1000 } = {}) {
  if (!deps.groupes) return null
  const minuteur = setInterval(() => deps.synchroGroupes.lancer(), intervalleMs)
  minuteur.unref?.()
  return minuteur
}
