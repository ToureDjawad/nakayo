import { ErreurHttp } from '../lib/erreurs.js'
import { offre } from '../lib/offres.js'

// Rapports de bugs des testeurs (US-33, docs/api-bugs.md).

export const offreSansRapportsDeBugs = () =>
  new ErreurHttp(403, 'offre_sans_rapports_de_bugs', {
    message: 'Les rapports de bugs avec captures sont réservés aux apps en Offre Pro ou Lancement Afrique.',
  })

// `affectation` : ligne de lireAffectationTesteur (avec l'offre de l'app).
export function exigerRapportsDeBugs(affectation) {
  if (!offre(affectation.offre).rapportsDeBugs) throw offreSansRapportsDeBugs()
}

export function versBugTesteur(b) {
  return {
    id: String(b.id),
    titre: b.titre,
    etapes: b.etapes,
    resultatAttendu: b.resultat_attendu,
    resultatObtenu: b.resultat_obtenu,
    gravite: b.gravite,
    versionApp: b.version_app,
    captures: b.captures.length,
    statut: b.statut,
    motifRefus: b.motif_refus,
    signaleLe: b.signale_le.toISOString(),
    decideLe: b.decide_le?.toISOString() ?? null,
  }
}

export async function enregistrerBug(db, { affectation, valeurs, captures, maintenant }) {
  const { rows } = await db.query(
    `INSERT INTO bugs (affectation_id, campagne_id, app_id, testeur_id, titre, etapes, resultat_attendu, resultat_obtenu,
                       gravite, version_app, captures, signale_le)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
    [
      affectation.id,
      affectation.campagne_id,
      affectation.app_id,
      affectation.testeur_id,
      valeurs.titre,
      valeurs.etapes,
      valeurs.resultatAttendu,
      valeurs.resultatObtenu,
      valeurs.gravite,
      valeurs.versionApp,
      captures,
      maintenant,
    ],
  )
  return rows[0]
}

export async function listerBugsTesteur(db, { affectation }) {
  const { rows } = await db.query('SELECT * FROM bugs WHERE affectation_id = $1 ORDER BY signale_le DESC, id DESC', [affectation.id])
  return rows.map(versBugTesteur)
}

// --- Développeur (US-34, docs/api-bugs.md §2) ---

export const LIBELLES_GRAVITE = { mineure: 'Mineure', genante: 'Gênante', bloquante: 'Bloquante' }
export const LIBELLES_STATUT_BUG = { nouveau: 'À examiner', accepte: 'Accepté', refuse: 'Refusé' }
export const MOTIF_REFUS = [5, 500]

// Même numérotation des testeurs que l'avancement (hors testeurs remplacés), et le dernier
// appareil connu du testeur. Aucun nom ni numéro de téléphone : le développeur ne les voit jamais.
const SELECT_BUGS_APP = `SELECT b.*, n.numero, ap.modele, ap.version_android, c.statut AS campagne_statut
  FROM bugs b
  JOIN campagnes c ON c.id = b.campagne_id
  LEFT JOIN (
    SELECT id, row_number() OVER (PARTITION BY campagne_id ORDER BY id) AS numero FROM affectations WHERE statut <> 'remplacee'
  ) n ON n.id = b.affectation_id
  LEFT JOIN LATERAL (
    SELECT modele, version_android FROM appareils WHERE utilisateur_id = b.testeur_id ORDER BY derniere_vue_le DESC, id DESC LIMIT 1
  ) ap ON true`

export function versBugDeveloppeur(b) {
  return {
    id: String(b.id),
    titre: b.titre,
    etapes: b.etapes,
    resultatAttendu: b.resultat_attendu,
    resultatObtenu: b.resultat_obtenu,
    gravite: b.gravite,
    versionApp: b.version_app,
    captures: b.captures.map((_, i) => `/api/apps/${b.app_id}/bugs/${b.id}/captures/${i + 1}`),
    statut: b.statut,
    motifRefus: b.motif_refus,
    signaleLe: b.signale_le.toISOString(),
    decideLe: b.decide_le?.toISOString() ?? null,
    testeur: { numero: b.numero == null ? null : Number(b.numero), modele: b.modele ?? null, versionAndroid: b.version_android ?? null },
    // Une décision n'est possible que tant que la campagne est en cours (le bonus est versé à la clôture).
    decidable: b.statut === 'nouveau' && b.campagne_statut === 'en_cours',
  }
}

// Filtres optionnels : ?gravite=bloquante&statut=nouveau. Les bugs de toutes les campagnes de l'app.
export async function listerBugsApp(db, { appId, gravite = null, statut = null }) {
  const { rows } = await db.query(
    `${SELECT_BUGS_APP}
      WHERE b.app_id = $1 AND ($2::text IS NULL OR b.gravite = $2) AND ($3::text IS NULL OR b.statut = $3)
      ORDER BY CASE b.gravite WHEN 'bloquante' THEN 0 WHEN 'genante' THEN 1 ELSE 2 END, b.signale_le DESC, b.id DESC`,
    [appId, gravite, statut],
  )
  return rows.map(versBugDeveloppeur)
}

// Compteurs pour l'en-tête de la liste, sans filtre.
export async function resumeBugsApp(db, { appId }) {
  const { rows } = await db.query(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE statut = 'nouveau')::int AS nouveaux,
            count(*) FILTER (WHERE statut = 'accepte')::int AS acceptes,
            count(*) FILTER (WHERE statut = 'refuse')::int AS refuses,
            count(*) FILTER (WHERE gravite = 'bloquante')::int AS bloquants,
            count(*) FILTER (WHERE gravite = 'genante')::int AS genants,
            count(*) FILTER (WHERE gravite = 'mineure')::int AS mineurs
       FROM bugs WHERE app_id = $1`,
    [appId],
  )
  return rows[0]
}

async function lireBugApp(db, { appId, bugId }) {
  if (!/^\d{1,18}$/.test(String(bugId))) throw new ErreurHttp(404, 'introuvable', { message: 'Bug introuvable.' })
  const { rows } = await db.query(`${SELECT_BUGS_APP} WHERE b.app_id = $1 AND b.id = $2`, [appId, bugId])
  if (!rows.length) throw new ErreurHttp(404, 'introuvable', { message: 'Bug introuvable.' })
  return rows[0]
}

export async function cheminCapture(db, { appId, bugId, rang }) {
  const bug = await lireBugApp(db, { appId, bugId })
  const chemin = bug.captures[Number(rang) - 1]
  if (!/^\d{1,2}$/.test(String(rang)) || !chemin) throw new ErreurHttp(404, 'introuvable', { message: 'Capture introuvable.' })
  return chemin
}

// Accepter ou refuser un bug (motif obligatoire pour un refus). Une décision est définitive.
export async function deciderBug(db, { appId, bugId, decision, motif, maintenant }) {
  const bug = await lireBugApp(db, { appId, bugId })
  if (bug.statut !== 'nouveau') {
    throw new ErreurHttp(409, 'deja_decide', { message: 'Ce bug a déjà été examiné.', statut: bug.statut })
  }
  if (bug.campagne_statut !== 'en_cours') {
    throw new ErreurHttp(409, 'campagne_terminee', { message: 'La campagne est terminée : les bugs ne peuvent plus être examinés.' })
  }
  const { rowCount } = await db.query(
    `UPDATE bugs SET statut = $3, motif_refus = $4, decide_le = $5 WHERE id = $1 AND app_id = $2 AND statut = 'nouveau'`,
    [bugId, appId, decision, decision === 'refuse' ? motif : null, maintenant],
  )
  if (!rowCount) throw new ErreurHttp(409, 'deja_decide', { message: 'Ce bug a déjà été examiné.' })
  return versBugDeveloppeur(await lireBugApp(db, { appId, bugId }))
}

// Export CSV (séparateur « ; » et BOM pour Excel en français). Une cellule qui commence par
// = + - @ est préfixée d'une apostrophe, pour qu'un tableur ne l'exécute pas comme une formule.
export function bugsEnCsv(bugs) {
  const cellule = (v) => {
    let t = v == null ? '' : String(v)
    if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`
    return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
  }
  const entetes = ['Titre', 'Gravité', 'Statut', 'Étapes', 'Résultat attendu', 'Résultat obtenu', 'Version de l’app', 'Testeur', 'Appareil', 'Android', 'Signalé le', 'Captures', 'Motif du refus']
  const lignes = bugs.map((b) => [
    b.titre,
    LIBELLES_GRAVITE[b.gravite],
    LIBELLES_STATUT_BUG[b.statut],
    b.etapes,
    b.resultatAttendu,
    b.resultatObtenu,
    b.versionApp,
    b.testeur.numero == null ? 'Testeur remplacé' : `Testeur ${b.testeur.numero}`,
    b.testeur.modele,
    b.testeur.versionAndroid,
    b.signaleLe,
    b.captures.length,
    b.motifRefus,
  ])
  return `﻿${[entetes, ...lignes].map((l) => l.map(cellule).join(';')).join('\r\n')}\r\n`
}
