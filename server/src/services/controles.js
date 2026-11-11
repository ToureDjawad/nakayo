import { estJetable } from '../lib/emailsJetables.js'

// Contrôles automatiques des comptes (US-07, contrat §6). Chaque libellé décrit la
// vérification réussie (« Conforme : Gmail unique ») ; le détail explique un problème.
export const LIBELLES = {
  email_jetable: 'Adresse email non jetable',
  fiche_play_accessible: 'Fiche développeur Google Play accessible',
  fiche_play_doublon: 'Fiche liée à aucun autre compte',
  momo_doublon: 'Numéro Mobile Money unique',
  momo_titulaire: 'Titulaire Mobile Money identique au nom saisi',
  gmail_doublon: 'Gmail unique',
  appareil_doublon: 'Appareil utilisé par aucun autre compte',
  photos_presentes: 'Pièce d’identité et selfie reçus',
}

const resultat = (code, valeur, detail = null) => ({ code, libelle: LIBELLES[code], resultat: valeur, detail })
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`

// Vérifie qu'une fiche Google Play répond (200) ; une 404 veut dire qu'elle n'existe pas.
export async function verifierFichePlay(url, { fetch: appel = fetch, delaiMs = 8000 } = {}) {
  try {
    const reponse = await appel(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(delaiMs),
      headers: { 'Accept-Language': 'fr' },
    })
    if (reponse.ok) return resultat('fiche_play_accessible', 'ok')
    if (reponse.status === 404) {
      return resultat('fiche_play_accessible', 'echec', 'Google Play répond que cette fiche n’existe pas.')
    }
    return resultat('fiche_play_accessible', 'indisponible', `Google Play a répondu ${reponse.status}.`)
  } catch {
    return resultat('fiche_play_accessible', 'indisponible', 'Google Play n’a pas répondu.')
  }
}

async function controlesDeveloppeur(db, compte, options) {
  const liste = [
    estJetable(compte.email)
      ? resultat('email_jetable', 'alerte', 'Le domaine de l’adresse est connu pour fournir des emails jetables.')
      : resultat('email_jetable', 'ok'),
  ]

  const { rows: autres } = await db.query(
    `SELECT statut, count(*)::int AS n FROM utilisateurs
      WHERE lien_fiche_developpeur = $1 AND id <> $2 GROUP BY statut`,
    [compte.lien_fiche_developpeur, compte.id],
  )
  const refuses = autres.find((a) => a.statut === 'refuse')?.n ?? 0
  const total = autres.reduce((somme, a) => somme + a.n, 0)
  liste.push(
    total === 0
      ? resultat('fiche_play_doublon', 'ok')
      : resultat(
          'fiche_play_doublon',
          refuses ? 'echec' : 'alerte',
          refuses
            ? `Fiche déjà liée à ${pluriel(refuses, 'compte')} refusé${refuses > 1 ? 's' : ''}.`
            : `Fiche déjà liée à ${pluriel(total, 'autre compte')}.`,
        ),
  )

  liste.push(
    options.reseau
      ? await verifierFichePlay(compte.lien_fiche_developpeur, { fetch: options.fetch })
      : resultat('fiche_play_accessible', 'indisponible', 'Vérification en ligne désactivée sur ce serveur.'),
  )
  return liste
}

async function controlesTesteur(db, compte) {
  const liste = []
  const { rows: momo } = await db.query(
    `SELECT count(*)::int AS n FROM demandes_changement_momo
      WHERE numero_momo = $1 AND utilisateur_id <> $2 AND statut <> 'refusee'`,
    [compte.numero_momo, compte.id],
  )
  liste.push(
    momo[0].n
      ? resultat('momo_doublon', 'alerte', 'Un autre testeur a demandé à utiliser ce numéro.')
      : resultat('momo_doublon', 'ok'),
  )

  // Aucun agrégateur Mobile Money n'est encore branché (question ouverte n° 5).
  liste.push(resultat('momo_titulaire', 'indisponible', 'Vérification du titulaire pas encore disponible.'))

  const { rows: gmail } = await db.query(
    `SELECT count(*)::int AS n FROM utilisateurs u
      WHERE u.id <> $2 AND split_part(lower(u.email), '@', 2) = 'gmail.com'
        AND regexp_replace(split_part(split_part(lower(u.email), '@', 1), '+', 1), '\\.', '', 'g') || '@gmail.com' = $1`,
    [compte.gmail_normalise, compte.id],
  )
  liste.push(
    gmail[0].n
      ? resultat('gmail_doublon', 'alerte', 'Cette adresse sert aussi à un compte développeur.')
      : resultat('gmail_doublon', 'ok'),
  )

  const { rows: appareils } = await db.query(
    `SELECT u.statut, count(DISTINCT u.id)::int AS n
       FROM appareils a JOIN appareils b ON b.identifiant = a.identifiant AND b.utilisateur_id <> a.utilisateur_id
       JOIN utilisateurs u ON u.id = b.utilisateur_id
      WHERE a.utilisateur_id = $1 GROUP BY u.statut`,
    [compte.id],
  )
  const total = appareils.reduce((somme, a) => somme + a.n, 0)
  const refuses = appareils.find((a) => a.statut === 'refuse')?.n ?? 0
  liste.push(
    total === 0
      ? resultat('appareil_doublon', 'ok')
      : resultat(
          'appareil_doublon',
          'echec',
          `Ce téléphone est déjà utilisé par ${pluriel(total, 'autre compte')}${refuses ? `, dont ${refuses} refusé${refuses > 1 ? 's' : ''}` : ''}.`,
        ),
  )

  const { rows: documents } = await db.query('SELECT type FROM documents_identite WHERE utilisateur_id = $1', [
    compte.id,
  ])
  const types = new Set(documents.map((d) => d.type))
  const manquants = [
    !types.has('piece_identite') && 'pièce d’identité',
    !types.has('selfie') && 'selfie',
  ].filter(Boolean)
  liste.push(
    manquants.length
      ? resultat('photos_presentes', 'echec', `Manquant : ${manquants.join(' et ')}.`)
      : resultat('photos_presentes', 'ok'),
  )
  return liste
}

// Exécute tous les contrôles d'un compte, enregistre chaque résultat puis la date de fin.
export async function executerControles(db, utilisateurId, { maintenant = () => new Date(), reseau = false, fetch } = {}) {
  const { rows } = await db.query(
    `SELECT u.id, u.role, u.email, u.lien_fiche_developpeur, p.numero_momo, p.gmail_normalise
       FROM utilisateurs u LEFT JOIN profils_testeurs p ON p.utilisateur_id = u.id WHERE u.id = $1`,
    [utilisateurId],
  )
  const compte = rows[0]
  if (!compte || compte.role === 'admin') return []
  await db.query('UPDATE utilisateurs SET controles_termines_le = NULL WHERE id = $1', [compte.id])

  const liste =
    compte.role === 'developpeur'
      ? await controlesDeveloppeur(db, compte, { reseau, fetch })
      : await controlesTesteur(db, compte)

  for (const c of liste) {
    await db.query(
      `INSERT INTO controles_comptes (utilisateur_id, code, libelle, resultat, detail, verifie_le)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (utilisateur_id, code) DO UPDATE
         SET libelle = EXCLUDED.libelle, resultat = EXCLUDED.resultat, detail = EXCLUDED.detail,
             verifie_le = EXCLUDED.verifie_le`,
      [compte.id, c.code, c.libelle, c.resultat, c.detail, maintenant()],
    )
  }
  await db.query('UPDATE utilisateurs SET controles_termines_le = $2 WHERE id = $1', [compte.id, maintenant()])
  return liste
}

// Objet `controles` de l'API admin (§5.1).
export async function lireControles(db, utilisateurIds) {
  const ids = utilisateurIds.map(String)
  if (!ids.length) return new Map()
  const { rows } = await db.query(
    `SELECT u.id, u.controles_termines_le, c.code, c.libelle, c.resultat, c.detail
       FROM utilisateurs u LEFT JOIN controles_comptes c ON c.utilisateur_id = u.id
      WHERE u.id = ANY($1::bigint[]) ORDER BY u.id, c.id`,
    [ids],
  )
  const parCompte = new Map(ids.map((id) => [id, { etat: 'en_cours', liste: [] }]))
  for (const l of rows) {
    const entree = parCompte.get(String(l.id))
    entree.etat = l.controles_termines_le ? 'termine' : 'en_cours'
    if (l.code) entree.liste.push({ code: l.code, libelle: l.libelle, resultat: l.resultat, detail: l.detail })
  }
  return parCompte
}

// Lance les contrôles en arrière-plan après une inscription, sans bloquer la réponse.
// `attendre()` sert aux tests et à l'arrêt propre du serveur.
export function creerLanceurControles({ pool, maintenant, journal, config, fetch }) {
  const enCours = new Set()
  return {
    lancer(utilisateurId) {
      const tache = executerControles(pool, utilisateurId, { maintenant, reseau: config.controlesReseau, fetch })
        .catch((erreur) => journal.error(erreur))
        .finally(() => enCours.delete(tache))
      enCours.add(tache)
      return tache
    },
    async attendre() {
      await Promise.all(enCours)
    },
  }
}
