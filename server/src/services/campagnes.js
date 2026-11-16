import { offre } from '../lib/offres.js'
import {
  choisirTesteurs,
  JOURS_CAMPAGNE,
  JOURS_EXIGES,
  JOURS_REMPLACEMENT_MANUEL,
  SEUIL_ALERTE_INSCRITS,
  TESTEURS_PAR_CAMPAGNE,
} from '../lib/affectation.js'
import { ErreurHttp, introuvable } from '../lib/erreurs.js'
import { ecartJours, jourBenin, JOUR_MS } from '../lib/temps.js'

// Verrou pris pendant une affectation : deux campagnes qui démarrent en même temps ne
// donnent pas une 16e app au même testeur.
const VERROU_AFFECTATION = 160016

const statutIncompatible = (message, statut) => new ErreurHttp(409, 'statut_incompatible', { message, statut })

// Testeurs validés qui n'ont jamais été affectés à cette app, avec de quoi les départager.
async function lireCandidats(db, appId) {
  const { rows } = await db.query(
    `SELECT u.id, p.ville, p.operateur_momo AS operateur, ap.modele,
            count(*) FILTER (WHERE a.statut = 'active')::int AS actives,
            count(*) FILTER (WHERE a.statut = 'terminee')::int AS terminees,
            count(*) FILTER (WHERE a.statut = 'remplacee')::int AS remplacees,
            COALESCE(sum(a.nombre_remises), 0)::int AS remises
       FROM utilisateurs u
       JOIN profils_testeurs p ON p.utilisateur_id = u.id
       LEFT JOIN LATERAL (
         SELECT modele FROM appareils WHERE utilisateur_id = u.id ORDER BY derniere_vue_le DESC, id DESC LIMIT 1
       ) ap ON true
       LEFT JOIN affectations a ON a.testeur_id = u.id
      WHERE u.role = 'testeur' AND u.statut = 'valide'
        AND NOT EXISTS (SELECT 1 FROM affectations d WHERE d.app_id = $1 AND d.testeur_id = u.id)
      GROUP BY u.id, p.ville, p.operateur_momo, ap.modele`,
    [appId],
  )
  return rows.map((r) => ({ ...r, id: String(r.id) }))
}

// Offre Pro (US-32) : les testeurs les mieux notés d'abord.
async function testeursConfirmesExiges(db, appId) {
  const { rows } = await db.query('SELECT offre FROM apps WHERE id = $1', [appId])
  return offre(rows[0]?.offre).testeursConfirmes
}

async function lireMembres(db, campagneId) {
  const { rows } = await db.query(
    `SELECT a.*, u.nom, u.telephone, p.ville, p.gmail, p.operateur_momo AS operateur, ap.modele
       FROM affectations a
       JOIN utilisateurs u ON u.id = a.testeur_id
       JOIN profils_testeurs p ON p.utilisateur_id = a.testeur_id
       LEFT JOIN LATERAL (
         SELECT modele FROM appareils WHERE utilisateur_id = a.testeur_id ORDER BY derniere_vue_le DESC, id DESC LIMIT 1
       ) ap ON true
      WHERE a.campagne_id = $1
      ORDER BY a.id`,
    [campagneId],
  )
  return rows
}

const SELECT_CAMPAGNE = `SELECT c.*, ap.nom AS app_nom, ap.package AS app_package, ap.offre AS app_offre, ap.lien_test_ferme AS app_lien,
    u.nom AS dev_nom, u.email AS dev_email
  FROM campagnes c JOIN apps ap ON ap.id = c.app_id JOIN utilisateurs u ON u.id = c.developpeur_id`

// Jour de la campagne (1 le jour du démarrage), borné à la durée de la campagne.
export function jourCampagne(demarreeLe, maintenant) {
  return Math.min(Math.max(ecartJours(jourBenin(demarreeLe), jourBenin(maintenant)) + 1, 1), JOURS_CAMPAGNE)
}

// Objet `campagne` (docs/api-sprint3.md §1.1). La vue admin ajoute l'identité des testeurs et les remplacés.
export function versCampagneApi(c, membres, { maintenant, vue = 'developpeur' }) {
  const actifs = membres.filter((m) => m.statut !== 'remplacee')
  const inscrits = actifs.filter((m) => m.inscription_confirmee_le).length
  const jour = jourCampagne(c.demarree_le, maintenant)
  const visibles = vue === 'admin' ? membres : actifs
  return {
    id: String(c.id),
    app: { id: String(c.app_id), nom: c.app_nom, package: c.app_package, offre: c.app_offre },
    ...(vue === 'admin' ? { developpeur: { id: String(c.developpeur_id), nom: c.dev_nom, email: c.dev_email } } : {}),
    statut: c.statut,
    jour,
    joursCampagne: JOURS_CAMPAGNE,
    joursExiges: c.jours_exiges,
    testeursVises: c.testeurs_vises,
    groupeGoogle: c.groupe_google,
    demarreeLe: c.demarree_le.toISOString(),
    finPrevueLe: c.fin_prevue_le.toISOString(),
    termineeLe: c.terminee_le?.toISOString() ?? null,
    compteurs: {
      affectes: actifs.length,
      inscritsConfirmes: inscrits,
      installes: actifs.filter((m) => m.installation_confirmee_le).length,
    },
    // Le premier jour laisse aux testeurs le temps de s'inscrire.
    alerteInscrits: c.statut === 'en_cours' && jour >= 2 && inscrits < SEUIL_ALERTE_INSCRITS,
    remplacementPossible: vue === 'admin' && c.statut === 'en_cours' && jour <= JOURS_REMPLACEMENT_MANUEL,
    testeurs: visibles.map((m, i) => versMembreApi(m, i, vue)),
  }
}

function versMembreApi(m, index, vue) {
  const commun = {
    id: String(m.id),
    statut: m.statut,
    ville: m.ville,
    gmail: m.gmail,
    inscriptionConfirmee: Boolean(m.inscription_confirmee_le),
    installationConfirmee: Boolean(m.installation_confirmee_le),
    joursValides: m.jours_valides,
  }
  if (vue !== 'admin') return { ...commun, numero: index + 1 }
  return {
    ...commun,
    testeurId: String(m.testeur_id),
    nom: m.nom,
    telephone: m.telephone,
    modele: m.modele ?? null,
    affecteLe: m.affecte_le.toISOString(),
    inscriptionConfirmeeLe: m.inscription_confirmee_le?.toISOString() ?? null,
    installationConfirmeeLe: m.installation_confirmee_le?.toISOString() ?? null,
    nombreRemises: m.nombre_remises,
    remplaceeLe: m.remplacee_le?.toISOString() ?? null,
    motifRemplacement: m.motif_remplacement ?? null,
  }
}

async function insererAffectations(client, { campagneId, appId, testeurs, maintenant }) {
  const { rows } = await client.query(
    `INSERT INTO affectations (campagne_id, app_id, testeur_id, affecte_le)
     SELECT $1, $2, unnest($3::bigint[]), $4 RETURNING id, testeur_id`,
    [campagneId, appId, testeurs.map((t) => t.id), maintenant],
  )
  return rows
}

// US-13 et US-16 : le développeur confirme que les testeurs sont ajoutés à son test fermé, ce qui
// démarre la campagne et affecte 15 testeurs. À appeler dans une transaction.
export async function demarrerCampagne(client, { appId, developpeurId, groupeGoogle, maintenant }) {
  const { rows: apps } = await client.query('SELECT * FROM apps WHERE id = $1 AND developpeur_id = $2 FOR UPDATE', [appId, developpeurId])
  const app = apps[0]
  if (!app) throw introuvable('App introuvable.')
  if (app.statut !== 'validee') throw statutIncompatible('La campagne démarre une fois l’app validée par l’équipe.', app.statut)
  if (!app.preparation_complete_le) {
    throw new ErreurHttp(409, 'preparation_incomplete', { message: 'Cochez toute la liste de vérification avant de démarrer.' })
  }
  const { rows: existantes } = await client.query(`SELECT 1 FROM campagnes WHERE app_id = $1 AND statut <> 'annulee'`, [appId])
  if (existantes.length) throw new ErreurHttp(409, 'campagne_existante', { message: 'La campagne de cette app a déjà démarré.' })

  await client.query('SELECT pg_advisory_xact_lock($1)', [VERROU_AFFECTATION])
  const testeurs = choisirTesteurs(await lireCandidats(client, appId), {
    nombre: TESTEURS_PAR_CAMPAGNE,
    confirmes: await testeursConfirmesExiges(client, appId),
  })
  if (testeurs.length < TESTEURS_PAR_CAMPAGNE) {
    throw new ErreurHttp(409, 'testeurs_insuffisants', {
      message: 'Pas assez de testeurs disponibles pour le moment. Notre équipe est prévenue et revient vers vous.',
      disponibles: testeurs.length,
    })
  }

  const { rows } = await client.query(
    `INSERT INTO campagnes (app_id, developpeur_id, testeurs_vises, jours_exiges, groupe_google, demarree_le, fin_prevue_le, cree_le)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $6) RETURNING id`,
    [appId, developpeurId, TESTEURS_PAR_CAMPAGNE, JOURS_EXIGES, groupeGoogle, maintenant, new Date(maintenant.getTime() + JOURS_CAMPAGNE * JOUR_MS)],
  )
  await insererAffectations(client, { campagneId: rows[0].id, appId, testeurs, maintenant })
  return rows[0].id
}

export async function lireCampagne(db, id, { maintenant, vue }) {
  const { rows } = await db.query(`${SELECT_CAMPAGNE} WHERE c.id = $1`, [id])
  if (!rows.length) throw introuvable('Campagne introuvable.')
  return versCampagneApi(rows[0], await lireMembres(db, id), { maintenant, vue })
}

// Dernière campagne d'une app du développeur, ou null.
export async function lireCampagneApp(db, { appId, developpeurId, maintenant }) {
  const { rows } = await db.query(
    `${SELECT_CAMPAGNE} WHERE c.app_id = $1 AND c.developpeur_id = $2 ORDER BY c.demarree_le DESC, c.id DESC LIMIT 1`,
    [appId, developpeurId],
  )
  if (!rows.length) return null
  return versCampagneApi(rows[0], await lireMembres(db, rows[0].id), { maintenant, vue: 'developpeur' })
}

// Liste admin : les campagnes en cours, les plus anciennes d'abord (elles finissent en premier).
export async function listerCampagnesAdmin(db, { statut, page, parPage, maintenant }) {
  const ordre = statut === 'en_cours' ? 'c.demarree_le ASC, c.id ASC' : 'c.demarree_le DESC, c.id DESC'
  const { rows } = await db.query(
    `${SELECT_CAMPAGNE.replace('SELECT c.*', 'SELECT c.*, count(*) OVER ()::int AS total')}
      WHERE c.statut = $1 ORDER BY ${ordre} LIMIT $2 OFFSET $3`,
    [statut, parPage, (page - 1) * parPage],
  )
  const campagnes = []
  for (const ligne of rows) {
    const { testeurs: _detail, ...resume } = versCampagneApi(ligne, await lireMembres(db, ligne.id), { maintenant, vue: 'admin' })
    campagnes.push(resume)
  }
  let total = rows[0]?.total ?? 0
  if (!rows.length && page > 1) {
    total = (await db.query('SELECT count(*)::int AS total FROM campagnes WHERE statut = $1', [statut])).rows[0].total
  }
  return { campagnes, total, page, parPage }
}

// US-43 : pendant les 2 premiers jours, l'admin remplace un testeur (inscription non faite,
// testeur injoignable). Le remplaçant est choisi avec les mêmes règles. Dans une transaction.
export async function remplacerTesteur(client, { campagneId, affectationId, motif, maintenant }) {
  const { rows: campagnes } = await client.query('SELECT * FROM campagnes WHERE id = $1 FOR UPDATE', [campagneId])
  const campagne = campagnes[0]
  if (!campagne) throw introuvable('Campagne introuvable.')
  if (campagne.statut !== 'en_cours') throw statutIncompatible('Cette campagne n’est plus en cours.', campagne.statut)
  if (jourCampagne(campagne.demarree_le, maintenant) > JOURS_REMPLACEMENT_MANUEL) {
    throw new ErreurHttp(409, 'delai_depasse', { message: 'Le remplacement manuel n’est possible que pendant les 2 premiers jours.' })
  }
  const membres = await lireMembres(client, campagneId)
  const sortant = membres.find((m) => String(m.id) === String(affectationId))
  if (!sortant) throw introuvable('Testeur introuvable dans cette campagne.')
  if (sortant.statut !== 'active') throw statutIncompatible('Ce testeur a déjà été remplacé.', sortant.statut)

  await client.query('SELECT pg_advisory_xact_lock($1)', [VERROU_AFFECTATION])
  const restants = membres.filter((m) => m.statut === 'active' && m.id !== sortant.id)
  const [remplacant] = choisirTesteurs(await lireCandidats(client, campagne.app_id), {
    nombre: 1,
    deja: restants,
    confirmes: await testeursConfirmesExiges(client, campagne.app_id),
  })
  if (!remplacant) {
    throw new ErreurHttp(409, 'testeurs_insuffisants', { message: 'Aucun testeur disponible pour ce remplacement.', disponibles: 0 })
  }
  const [nouvelle] = await insererAffectations(client, { campagneId, appId: campagne.app_id, testeurs: [remplacant], maintenant })
  await client.query(
    `UPDATE affectations SET statut = 'remplacee', remplacee_le = $2, remplacee_par = $3, motif_remplacement = $4 WHERE id = $1`,
    [sortant.id, maintenant, nouvelle.id, motif],
  )
  return { testeurId: String(nouvelle.testeur_id) }
}

// Téléphones des testeurs actifs d'une campagne, pour les prévenir par SMS.
export async function telephonesTesteurs(db, campagneId, testeurIds = null) {
  const { rows } = await db.query(
    `SELECT u.telephone FROM affectations a JOIN utilisateurs u ON u.id = a.testeur_id
      WHERE a.campagne_id = $1 AND a.statut = 'active' AND ($2::bigint[] IS NULL OR a.testeur_id = ANY($2))`,
    [campagneId, testeurIds],
  )
  return rows.map((r) => r.telephone).filter(Boolean)
}

export function messageNouvelleApp(nomApp) {
  return `Nakayo : une nouvelle app vous attend, « ${nomApp} ». Ouvrez l'app Nakayo pour vous inscrire au test.`
}
