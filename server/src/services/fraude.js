import { createHash } from 'node:crypto'
import { ErreurHttp, introuvable } from '../lib/erreurs.js'

// US-28 : détection des comportements suspects (docs/anti-fraude.md). Chaque règle crée des
// alertes que l'admin confirme ou écarte ; rien n'est sanctionné automatiquement.

export const LIBELLES_ALERTES = {
  meme_appareil: 'Même téléphone pour plusieurs comptes',
  meme_position: 'Rapports envoyés du même endroit',
  usage_nul: 'Rapport envoyé sans temps d’utilisation',
  rapports_copies: 'Rapport copié d’une app à l’autre',
  meme_reseau: 'Même Wi-Fi dans une campagne',
  appareil_suspect: 'Émulateur ou téléphone rooté',
}
export const STATUTS_ALERTES = ['ouverte', 'confirmee', 'ecartee']
// Même position (arrondie à 1 km) au moins 3 jours : deux voisins ne suffisent pas.
export const JOURS_MEME_POSITION = 3

const empreinte = (texte) => createHash('sha256').update(texte).digest('hex').slice(0, 16)
const ids = (liste) => [...new Set(liste.map(String))].sort((a, b) => Number(a) - Number(b))

// Texte réduit à ses lettres et chiffres : un rapport recopié avec d'autres espaces ou une autre
// ponctuation reste reconnu.
export const normaliserRapport = (texte) =>
  String(texte ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

export async function signalerAlerte(db, { code, cle, testeurIds, campagneId = null, detail, maintenant }) {
  const { rowCount } = await db.query(
    `INSERT INTO alertes_fraude (code, cle, testeur_ids, campagne_id, detail, creee_le) VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (cle) DO NOTHING`,
    [code, cle, ids(testeurIds), campagneId, detail, maintenant],
  )
  return rowCount === 1
}

// Règles lancées chaque nuit après la vérification du jour `jour` (date du Bénin).
export async function detecterFraudes(db, { jour, maintenant }) {
  const alertes = []
  const signaler = async (a) => {
    if (await signalerAlerte(db, { ...a, maintenant })) alertes.push(a.code)
  }

  // Même identifiant d'app sur plusieurs comptes testeurs (hors comptes refusés).
  const { rows: appareils } = await db.query(
    `SELECT a.identifiant, array_agg(DISTINCT a.utilisateur_id) AS testeurs
       FROM appareils a JOIN utilisateurs u ON u.id = a.utilisateur_id
      WHERE u.role = 'testeur' AND u.statut <> 'refuse'
      GROUP BY a.identifiant HAVING count(DISTINCT a.utilisateur_id) > 1`,
  )
  for (const a of appareils) {
    const testeurs = ids(a.testeurs)
    await signaler({
      code: 'meme_appareil',
      cle: `meme_appareil:${empreinte(a.identifiant)}:${testeurs.join('-')}`,
      testeurIds: testeurs,
      detail: `${testeurs.length} comptes testeurs utilisent le même téléphone.`,
    })
  }

  // Deux testeurs d'une même campagne qui envoient leurs rapports du même endroit plusieurs jours.
  const { rows: positions } = await db.query(
    `SELECT a1.campagne_id, r1.testeur_id AS t1, r2.testeur_id AS t2, count(DISTINCT r1.jour)::int AS jours
       FROM rapports r1
       JOIN affectations a1 ON a1.id = r1.affectation_id
       JOIN affectations a2 ON a2.campagne_id = a1.campagne_id
       JOIN rapports r2 ON r2.affectation_id = a2.id AND r2.jour = r1.jour
        AND r2.latitude = r1.latitude AND r2.longitude = r1.longitude AND r2.testeur_id > r1.testeur_id
       JOIN campagnes c ON c.id = a1.campagne_id
      WHERE c.statut = 'en_cours'
      GROUP BY a1.campagne_id, r1.testeur_id, r2.testeur_id
     HAVING count(DISTINCT r1.jour) >= $1`,
    [JOURS_MEME_POSITION],
  )
  for (const p of positions) {
    await signaler({
      code: 'meme_position',
      cle: `meme_position:${p.campagne_id}:${ids([p.t1, p.t2]).join('-')}`,
      testeurIds: [p.t1, p.t2],
      campagneId: p.campagne_id,
      detail: `Rapports envoyés du même endroit (à 1 km près) ${p.jours} jours de la campagne.`,
    })
  }

  // Rapport du jour envoyé sans aucun temps passé dans l'app.
  const { rows: usagesNuls } = await db.query(
    `SELECT a.id, a.testeur_id, a.campagne_id FROM journees j JOIN affectations a ON a.id = j.affectation_id
      WHERE j.jour = $1 AND j.rapport AND j.usage_secondes = 0`,
    [jour],
  )
  for (const u of usagesNuls) {
    await signaler({
      code: 'usage_nul',
      cle: `usage_nul:${u.id}`,
      testeurIds: [u.testeur_id],
      campagneId: u.campagne_id,
      detail: `Rapport du ${jour} envoyé alors que l’app n’a pas été utilisée ce jour-là.`,
    })
  }

  // Même texte de rapport pour deux apps différentes (le testeur recopie son rapport).
  const { rows: rapports } = await db.query(
    `SELECT r.testeur_id, r.actions, a.app_id, a.campagne_id FROM rapports r JOIN affectations a ON a.id = r.affectation_id
      WHERE r.testeur_id IN (SELECT testeur_id FROM rapports WHERE jour = $1)`,
    [jour],
  )
  const parTexte = new Map()
  for (const r of rapports) {
    const cle = `${r.testeur_id}:${normaliserRapport(r.actions)}`
    if (!parTexte.has(cle)) parTexte.set(cle, { testeur: r.testeur_id, apps: new Set(), campagne: r.campagne_id, texte: normaliserRapport(r.actions) })
    parTexte.get(cle).apps.add(String(r.app_id))
  }
  for (const g of parTexte.values()) {
    if (g.apps.size < 2) continue
    await signaler({
      code: 'rapports_copies',
      cle: `rapports_copies:${g.testeur}:${empreinte(g.texte)}`,
      testeurIds: [g.testeur],
      detail: `Le même rapport a été envoyé pour ${g.apps.size} apps différentes.`,
    })
  }

  // Deux testeurs actifs d'une campagne en cours vus sur le même Wi-Fi depuis son démarrage (US-16).
  const { rows: reseaux } = await db.query(
    `SELECT c.id AS campagne_id, r.empreinte, array_agg(DISTINCT a.testeur_id) AS testeurs
       FROM campagnes c
       JOIN affectations a ON a.campagne_id = c.id AND a.statut = 'active'
       JOIN reseaux_testeurs r ON r.testeur_id = a.testeur_id AND r.dernier_vu_le >= c.demarree_le
      WHERE c.statut = 'en_cours'
      GROUP BY c.id, r.empreinte HAVING count(DISTINCT a.testeur_id) > 1`,
  )
  for (const r of reseaux) {
    const testeurs = ids(r.testeurs)
    await signaler({
      code: 'meme_reseau',
      cle: `meme_reseau:${r.campagne_id}:${r.empreinte}:${testeurs.join('-')}`,
      testeurIds: testeurs,
      campagneId: r.campagne_id,
      detail: `${testeurs.length} testeurs de la campagne envoient leurs rapports depuis le même Wi-Fi.`,
    })
  }
  return alertes
}

// Signal de l'app compagnon : { integrite: { emulateur, root } } (facultatif).
export function lireIntegrite(corps) {
  const integrite = corps?.integrite
  if (integrite === undefined) return { integrite: null }
  if (!integrite || typeof integrite !== 'object') return { erreur: 'format_invalide' }
  const { emulateur = false, root = false } = integrite
  if (typeof emulateur !== 'boolean' || typeof root !== 'boolean') return { erreur: 'format_invalide' }
  return { integrite: { emulateur, root } }
}

export async function signalerIntegrite(db, { testeurId, integrite, maintenant }) {
  if (!integrite) return
  const constats = [integrite.emulateur && ['emulateur', 'un émulateur'], integrite.root && ['root', 'un téléphone rooté']].filter(Boolean)
  for (const [code, texte] of constats) {
    await signalerAlerte(db, {
      code: 'appareil_suspect',
      cle: `appareil_suspect:${testeurId}:${code}`,
      testeurIds: [testeurId],
      detail: `L’app Nakayo tourne sur ${texte}.`,
      maintenant,
    })
  }
}

const PAR_PAGE = 20

export async function listerAlertes(db, { statut, page = 1 }) {
  const { rows } = await db.query(
    `SELECT f.*, count(*) OVER ()::int AS total, ap.nom AS app_nom,
            (SELECT json_agg(json_build_object('id', u.id::text, 'nom', u.nom, 'telephone', u.telephone, 'statut', u.statut) ORDER BY u.id)
               FROM utilisateurs u WHERE u.id = ANY(f.testeur_ids)) AS testeurs
       FROM alertes_fraude f
       LEFT JOIN campagnes c ON c.id = f.campagne_id
       LEFT JOIN apps ap ON ap.id = c.app_id
      WHERE f.statut = $1
      ORDER BY ${statut === 'ouverte' ? 'f.creee_le, f.id' : 'f.traitee_le DESC, f.id DESC'}
      LIMIT $2 OFFSET $3`,
    [statut, PAR_PAGE, (page - 1) * PAR_PAGE],
  )
  return { alertes: rows.map(versAlerte), total: rows[0]?.total ?? 0, page, parPage: PAR_PAGE }
}

function versAlerte(f) {
  return {
    id: String(f.id),
    code: f.code,
    libelle: LIBELLES_ALERTES[f.code],
    detail: f.detail,
    statut: f.statut,
    creeLe: f.creee_le.toISOString(),
    testeurs: f.testeurs ?? [],
    campagne: f.campagne_id ? { id: String(f.campagne_id), appNom: f.app_nom } : null,
    traiteeLe: f.traitee_le?.toISOString() ?? null,
    note: f.note,
  }
}

export async function deciderAlerte(db, { id, decision, note, adminId, maintenant }) {
  if (!/^\d{1,18}$/.test(String(id))) throw introuvable('Alerte introuvable.')
  const { rows } = await db.query(
    `UPDATE alertes_fraude SET statut = $2, note = $3, traitee_le = $4, traitee_par = $5 WHERE id = $1 AND statut = 'ouverte' RETURNING id`,
    [id, decision, note, maintenant, adminId],
  )
  if (!rows.length) {
    const { rows: existe } = await db.query('SELECT statut FROM alertes_fraude WHERE id = $1', [id])
    if (!existe.length) throw introuvable('Alerte introuvable.')
    throw new ErreurHttp(409, 'statut_incompatible', { message: 'Cette alerte a déjà été traitée.', statut: existe[0].statut })
  }
  const { rows: lignes } = await db.query(
    `SELECT f.*, ap.nom AS app_nom,
            (SELECT json_agg(json_build_object('id', u.id::text, 'nom', u.nom, 'telephone', u.telephone, 'statut', u.statut) ORDER BY u.id)
               FROM utilisateurs u WHERE u.id = ANY(f.testeur_ids)) AS testeurs
       FROM alertes_fraude f LEFT JOIN campagnes c ON c.id = f.campagne_id LEFT JOIN apps ap ON ap.id = c.app_id WHERE f.id = $1`,
    [id],
  )
  return versAlerte(lignes[0])
}
