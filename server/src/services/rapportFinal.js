import { ErreurHttp } from '../lib/erreurs.js'
import { creerRedaction } from '../lib/pdf.js'
import { ajouterJours, jourBenin } from '../lib/temps.js'
import { offre } from '../lib/offres.js'
import { lireAvancement } from './avancement.js'
import { lireTerrain } from './terrain.js'
import { jourCampagne } from './campagnes.js'

// US-36 : rapport de fin et brouillon des réponses au formulaire Google d'accès à la production
// (docs/api-sprint4.md §6). Tout vient des données de la campagne ; ce que Nakayo ne peut pas
// savoir reste entre crochets, à compléter par le développeur : aucune réponse n'est inventée.

export const A_COMPLETER = /\[À compléter[^\]]*\]/
const PROBLEMES_DANS_LE_BROUILLON = 5

const dateLongue = (jour) =>
  new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${jour}T00:00:00Z`))

// 9120 s -> « 2 h 32 min » ; 95 -> « 1 min ».
export function duree(secondes) {
  const minutes = Math.floor(secondes / 60)
  if (minutes < 60) return `${minutes} min`
  const reste = minutes % 60
  return `${Math.floor(minutes / 60)} h${reste ? ` ${String(reste).padStart(2, '0')} min` : ''}`
}

const note = (n) => String(n).replace('.', ',')
const pourcent = (part) => `${Math.round(part * 100)} %`
const liste = (elements) => (elements.length < 2 ? elements.join('') : `${elements.slice(0, -1).join(', ')} et ${elements.at(-1)}`)
const versionsTriees = (versions) => [...versions].sort((a, b) => Number(a) - Number(b) || String(a).localeCompare(String(b)))

// Le rapport est prêt au 14e jour de la campagne, ou dès qu'elle est terminée.
export function rapportPret(c, maintenant) {
  return c.statut === 'terminee' || jourCampagne(c.demarree_le, maintenant) >= c.jours_exiges
}

export function disponibleLe(c) {
  return ajouterJours(jourBenin(c.demarree_le), c.jours_exiges - 1)
}

// Chiffres réels de la campagne, à partir de l'avancement (US-21).
export function construireBilan(app, a) {
  const installes = a.testeurs.filter((t) => t.installationConfirmee)
  const joursUsage = a.parJour.reduce((s, j) => s + j.testeursAvecUsage, 0)
  const rapports = [...a.rapports].reverse() // du plus ancien au plus récent

  const versions = new Map()
  for (const r of rapports) {
    const v = versions.get(r.versionApp) ?? { version: r.versionApp, rapports: 0, premierJour: r.jourCampagne, dernierJour: r.jourCampagne }
    v.rapports++
    v.dernierJour = r.jourCampagne
    versions.set(r.versionApp, v)
  }

  const problemes = rapports
    .filter((r) => r.bug)
    .map((r) => ({ jourCampagne: r.jourCampagne, versionApp: r.versionApp, fonctionnalites: r.fonctionnalites, commentaire: r.commentaireBug }))

  // Retours regroupés par fonctionnalité (les thèmes déclarés par le développeur).
  const themes = a.couverture.map((c) => {
    const lies = rapports.filter((r) => r.fonctionnalites.includes(c.fonctionnalite))
    return {
      fonctionnalite: c.fonctionnalite,
      testeurs: c.testeurs,
      part: c.part,
      rapports: lies.length,
      noteMoyenne: lies.length ? Math.round((lies.reduce((s, r) => s + r.note, 0) / lies.length) * 10) / 10 : null,
      problemes: problemes.filter((p) => p.fonctionnalites.includes(c.fonctionnalite)),
      avis: lies.filter((r) => r.retourDetaille).map((r) => ({ jourCampagne: r.jourCampagne, texte: r.retourDetaille })),
    }
  })

  return {
    app: { nom: app.nom, package: app.package, description: app.description },
    campagne: {
      id: a.campagneId,
      statut: a.statut,
      demarreeLe: app.demarree_le.toISOString(),
      jour: a.jour,
      jours: a.parJour.length,
      joursExiges: a.joursExiges,
    },
    testeurs: {
      affectes: a.testeurs.length,
      installes: installes.length,
      joursExigesAtteints: a.objectif.testeursAtteints,
      objectifAtteint: a.objectif.atteint,
      villes: [...new Set(a.testeurs.map((t) => t.ville))].sort((x, y) => x.localeCompare(y, 'fr')),
    },
    usage: {
      tempsTotalSecondes: a.resume.tempsTotalSecondes,
      joursTesteurAvecUsage: joursUsage,
      // Moyenne par testeur et par jour d'utilisation.
      moyenneSecondes: joursUsage ? Math.round(a.resume.tempsTotalSecondes / joursUsage) : 0,
    },
    rapports: {
      total: a.resume.rapports,
      noteMoyenne: a.resume.noteMoyenne,
      problemes: a.resume.bugs,
      avisDetailles: rapports.filter((r) => r.retourDetaille).length,
    },
    appareils: {
      modeles: new Set(a.appareils.filter((x) => x.modele).map((x) => x.modele)).size,
      versionsAndroid: versionsTriees(new Set(a.appareils.filter((x) => x.versionAndroid).map((x) => x.versionAndroid))),
      // US-35 : testeurs sur un téléphone de 3 Go de RAM ou moins.
      entreeDeGamme: a.resume.appareilsEntreeDeGamme,
      liste: a.appareils,
    },
    versionsApp: [...versions.values()],
    couverture: a.couverture,
    themes,
    problemes,
  }
}

// Brouillon des 3 parties du formulaire de la Play Console (formulation proche de celle de Google).
export function construireBrouillon(b) {
  const plusUtilisees = [...b.couverture]
    .filter((c) => c.testeurs > 0)
    .sort((x, y) => y.part - x.part)
    .slice(0, 3)
    .map((c) => `${c.fonctionnalite} (${pourcent(c.part)} des testeurs)`)
  const versionsApp = b.versionsApp.map((v) => v.version)
  const problemes = b.problemes.slice(0, PROBLEMES_DANS_LE_BROUILLON).map((p) => `- Jour ${p.jourCampagne}, version ${p.versionApp} : « ${p.commentaire} »`)
  const themes = b.themes
    .filter((t) => t.rapports > 0)
    .sort((x, y) => y.rapports - x.rapports)
    .map((t) => `${t.fonctionnalite} (${t.rapports} rapports${t.problemes.length ? `, ${t.problemes.length} problème${t.problemes.length > 1 ? 's' : ''}` : ''})`)
  const repereDescription = `Repère, votre description sur Nakayo : « ${b.app.description} »`

  const recrutement = [
    `Les testeurs ont été recrutés par Nakayo, un service de testeurs vérifiés (identité et numéro de téléphone contrôlés) basés au Bénin${b.testeurs.villes.length ? ` (${liste(b.testeurs.villes)})` : ''}.`,
    `${b.testeurs.affectes} testeurs ont rejoint le test fermé, ${b.testeurs.installes} ont installé l'app depuis le Play Store et ${b.testeurs.joursExigesAtteints} l'ont testée au moins ${b.campagne.joursExiges} jours.`,
  ].join(' ')

  const engagement = [
    `Sur ${b.campagne.jours} jours de test, les testeurs ont utilisé l'app ${duree(b.usage.tempsTotalSecondes)} au total, soit ${duree(b.usage.moyenneSecondes)} en moyenne par testeur et par jour d'utilisation.`,
    `Ils ont envoyé ${b.rapports.total} rapports quotidiens${b.rapports.noteMoyenne !== null ? ` (note moyenne ${note(b.rapports.noteMoyenne)} sur 5)` : ''}.`,
    plusUtilisees.length ? `Fonctionnalités les plus utilisées : ${liste(plusUtilisees)}.` : null,
    b.appareils.modeles
      ? `Appareils : ${b.appareils.modeles} modèles de téléphones, Android ${liste(b.appareils.versionsAndroid)}${
          b.appareils.entreeDeGamme ? `, dont ${b.appareils.entreeDeGamme} téléphones d'entrée de gamme (3 Go de RAM ou moins)` : ''
        }.`
      : null,
    versionsApp.length ? `Version${versionsApp.length > 1 ? 's' : ''} de l'app testée${versionsApp.length > 1 ? 's' : ''} : ${liste(versionsApp)}.` : null,
  ]
    .filter(Boolean)
    .join(' ')

  const retours = [
    `Les retours ont été recueillis chaque jour dans l'app Nakayo : ce que le testeur a fait, une note sur 5 et les problèmes rencontrés, avec un avis détaillé les jours 3, 7 et 12 (${b.rapports.avisDetailles} avis reçus).`,
    themes.length ? `Thèmes abordés : ${liste(themes)}.` : null,
    b.rapports.problemes
      ? `${b.rapports.problemes} problème${b.rapports.problemes > 1 ? 's' : ''} signalé${b.rapports.problemes > 1 ? 's' : ''}, dont :\n${problemes.join('\n')}`
      : 'Aucun problème signalé par les testeurs.',
  ]
    .filter(Boolean)
    .join('\n')

  const changements = [
    '[À compléter : pour chaque problème signalé, indiquez la correction apportée et la version qui la contient.]',
    versionsApp.length > 1
      ? `Versions publiées pendant le test : ${b.versionsApp.map((v) => `${v.version} (à partir du jour ${v.premierJour})`).join(', puis ')}.`
      : versionsApp.length
        ? `Une seule version a été testée : ${versionsApp[0]}.`
        : null,
    problemes.length ? `Problèmes signalés pendant le test :\n${problemes.join('\n')}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const pret = [
    `${b.testeurs.joursExigesAtteints} testeurs ont utilisé l'app pendant au moins ${b.campagne.joursExiges} jours${b.rapports.noteMoyenne !== null ? `, avec une note moyenne de ${note(b.rapports.noteMoyenne)} sur 5` : ''}.`,
    b.rapports.problemes
      ? `[À compléter : indiquez quels problèmes signalés sont corrigés et ce qui vous permet de juger l'app prête.]`
      : `[À compléter : indiquez ce qui vous permet de juger l'app prête, par exemple les derniers tests réalisés.]`,
  ].join(' ')

  return {
    parties: [
      {
        titre: 'À propos de votre test fermé',
        questions: [
          { id: 'recrutement', question: 'Dans quelle mesure a-t-il été facile de recruter des testeurs pour votre application ?', reponse: recrutement },
          { id: 'engagement', question: 'Décrivez l’engagement des testeurs pendant votre test fermé.', reponse: engagement },
          { id: 'retours', question: 'Résumez les commentaires reçus des testeurs et la façon dont vous les avez recueillis.', reponse: retours },
        ],
      },
      {
        titre: 'À propos de votre application',
        questions: [
          { id: 'public', question: 'Qui est le public cible de votre application ?', reponse: `[À compléter : décrivez les personnes à qui s'adresse l'app (pays, âge, besoins).]\n${repereDescription}` },
          { id: 'valeur', question: 'Décrivez en quoi votre application est utile à ses utilisateurs.', reponse: `[À compléter : expliquez le service rendu et ce qui distingue l'app.]\n${repereDescription}` },
          { id: 'installations', question: 'Combien d’installations prévoyez-vous la première année ?', reponse: '[À compléter : choisissez une estimation dans la liste proposée par Google.]' },
        ],
      },
      {
        titre: 'Préparation pour la production',
        questions: [
          { id: 'changements', question: 'Quelles modifications avez-vous apportées à l’application suite au test fermé ?', reponse: changements },
          { id: 'pret', question: 'Comment avez-vous déterminé que votre application est prête pour la production ?', reponse: pret },
        ],
      },
    ],
  }
}

async function lireCampagneDeveloppeur(db, { appId, developpeurId }) {
  const { rows } = await db.query(
    `SELECT c.*, ap.nom, ap.package, ap.description, ap.offre FROM campagnes c JOIN apps ap ON ap.id = c.app_id
      WHERE c.app_id = $1 AND c.developpeur_id = $2 ORDER BY c.demarree_le DESC, c.id DESC LIMIT 1`,
    [appId, developpeurId],
  )
  return rows[0] ?? null
}

const versDecision = (c) =>
  c.decision_google ? { decision: c.decision_google, le: c.decision_google_le ? jourBenin(c.decision_google_le) : null, saisieLe: c.decision_saisie_le.toISOString() } : null

// §6.1 Rapport de fin : `pret` false avant le 14e jour (avec la date), sinon bilan et brouillon.
export async function lireRapportFinal(db, { appId, developpeurId, maintenant }) {
  const c = await lireCampagneDeveloppeur(db, { appId, developpeurId })
  if (!c) throw new ErreurHttp(404, 'introuvable', { message: 'Campagne introuvable.' })
  if (c.statut === 'annulee' || !rapportPret(c, maintenant)) {
    return { pret: false, disponibleLe: c.statut === 'annulee' ? null : disponibleLe(c), bilan: null, brouillon: null, decisionGoogle: null }
  }
  const avancement = await lireAvancement(db, { appId, developpeurId, maintenant })
  const bilan = construireBilan(c, avancement)
  // US-37 : test terrain de l'Offre Plus (réseau, petits téléphones, langue).
  bilan.terrain = offre(c.offre).questionnaireTerrain ? await lireTerrain(db, c.id) : null
  return { pret: true, disponibleLe: disponibleLe(c), bilan, brouillon: construireBrouillon(bilan), decisionGoogle: versDecision(c) }
}

// §6.3 Décision de Google indiquée par le développeur (sert à mesurer le taux de réussite).
export async function enregistrerDecision(db, { appId, developpeurId, decision, le, maintenant }) {
  const c = await lireCampagneDeveloppeur(db, { appId, developpeurId })
  if (!c) throw new ErreurHttp(404, 'introuvable', { message: 'Campagne introuvable.' })
  if (!rapportPret(c, maintenant)) {
    throw new ErreurHttp(409, 'rapport_pas_pret', { message: 'La décision de Google se saisit après le 14e jour du test.' })
  }
  await db.query('UPDATE campagnes SET decision_google = $2, decision_google_le = $3, decision_saisie_le = $4 WHERE id = $1', [c.id, decision, le, maintenant])
  return versDecision({ decision_google: decision, decision_google_le: le ? new Date(`${le}T12:00:00Z`) : null, decision_saisie_le: maintenant })
}

// Rapport PDF : bilan chiffré, retours par thème, puis le brouillon des réponses.
export function rapportPdf({ bilan: b, brouillon }, { maintenant }) {
  const r = creerRedaction({ piedDePage: `Nakayo · rapport de fin de test de « ${b.app.nom} » · édité le ${dateLongue(jourBenin(maintenant))}` })
  r.page.rectangle(0, 806, 595, 36)
  r.page.texte(56, 818, 'nakayo', { taille: 16, gras: true, blanc: true })
  r.descendre(30)
  r.paragraphe('Rapport de fin de test fermé', { taille: 22, gras: true })
  r.paragraphe(`${b.app.nom} · ${b.app.package}`, { taille: 11, gris: true })
  r.paragraphe(
    `Test démarré le ${dateLongue(jourBenin(new Date(b.campagne.demarreeLe)))}, ${b.campagne.jours} jours de test ${b.campagne.statut === 'terminee' ? '(campagne terminée)' : `(jour ${b.campagne.jour})`}.`,
    { taille: 10 },
  )

  r.titre('Chiffres clés')
  r.ligneInfo('Testeurs ayant rejoint le test', String(b.testeurs.affectes))
  r.ligneInfo('Testeurs ayant installé l’app', String(b.testeurs.installes))
  r.ligneInfo(`Testeurs avec ${b.campagne.joursExiges} jours de test ou plus`, String(b.testeurs.joursExigesAtteints))
  r.ligneInfo('Temps d’utilisation total', duree(b.usage.tempsTotalSecondes))
  r.ligneInfo('Moyenne par testeur et par jour d’utilisation', duree(b.usage.moyenneSecondes))
  r.ligneInfo('Rapports quotidiens reçus', String(b.rapports.total))
  r.ligneInfo('Note moyenne', b.rapports.noteMoyenne !== null ? `${note(b.rapports.noteMoyenne)} sur 5` : '-')
  r.ligneInfo('Problèmes signalés', String(b.rapports.problemes))
  r.ligneInfo('Modèles de téléphones', String(b.appareils.modeles))
  r.ligneInfo('Versions d’Android', liste(b.appareils.versionsAndroid) || '-')
  r.ligneInfo('Téléphones d’entrée de gamme (3 Go de RAM ou moins)', String(b.appareils.entreeDeGamme))
  r.ligneInfo('Versions de l’app testées', liste(b.versionsApp.map((v) => v.version)) || '-')

  r.titre('Téléphones des testeurs')
  for (const x of b.appareils.liste) {
    const libelle = `${x.modele ?? 'Modèle inconnu'} · Android ${x.versionAndroid ?? '?'}${x.entreeDeGamme ? ' · entrée de gamme' : ''}`
    r.ligneInfo(libelle, `${x.testeurs} testeur${x.testeurs > 1 ? 's' : ''}`)
  }

  if (b.terrain) pdfTerrain(r, b.terrain)

  r.titre('Retours par fonctionnalité')
  for (const t of b.themes) {
    r.paragraphe(`${t.fonctionnalite} : ${pourcent(t.part)} des testeurs, ${t.rapports} rapports${t.noteMoyenne !== null ? `, note ${note(t.noteMoyenne)} sur 5` : ''}`, { gras: true })
    for (const p of t.problemes) r.paragraphe(`Problème (jour ${p.jourCampagne}, version ${p.versionApp}) : ${p.commentaire}`, { retrait: 12, taille: 9 })
    for (const a of t.avis.slice(0, 3)) r.paragraphe(`Avis (jour ${a.jourCampagne}) : ${a.texte}`, { retrait: 12, taille: 9, gris: true })
  }

  r.titre('Brouillon des réponses au formulaire Google')
  r.paragraphe('Relisez chaque réponse et complétez les passages entre crochets avec vos propres informations avant de les envoyer à Google.', { gris: true })
  for (const partie of brouillon.parties) {
    r.titre(partie.titre, { taille: 12 })
    for (const q of partie.questions) {
      r.paragraphe(q.question, { gras: true })
      r.paragraphe(q.reponse, { retrait: 12 })
    }
  }
  return r.terminer(`Rapport de fin · ${b.app.nom}`)
}

const CONNEXIONS_LISIBLES = { wifi: 'Wi-Fi', '4g': '4G', '3g': '3G', '2g': '2G' }
const LANGUES_LISIBLES = { fr: 'français', en: 'anglais' }
const tenue = (t) => `${t.fluide} fluide, ${t.lent} lent, ${t.inutilisable} inutilisable`

// US-37 : section « Test terrain » de l'Offre Plus.
function pdfTerrain(r, t) {
  r.titre('Test terrain')
  if (!t.reponses) {
    r.paragraphe('Aucun testeur n’a encore répondu au questionnaire terrain.', { gris: true })
    return
  }
  r.paragraphe(`${t.reponses} testeur${t.reponses > 1 ? 's ont' : ' a'} répondu au questionnaire terrain.`, { taille: 10 })
  r.ligneInfo('Tenue de l’app sur le réseau', tenue(t.reseau))
  for (const c of t.parConnexion) r.ligneInfo(`En ${CONNEXIONS_LISIBLES[c.connexion]} (${c.reponses})`, tenue(c))
  r.ligneInfo('Tenue de l’app sur le téléphone', tenue(t.telephone))
  r.ligneInfo(`Sur les petits téléphones (${t.petitsTelephones.reponses})`, t.petitsTelephones.reponses ? tenue(t.petitsTelephones) : '-')
  r.ligneInfo('Compréhension de l’app', t.comprehensionMoyenne !== null ? `${note(t.comprehensionMoyenne)} sur 5` : '-')
  for (const l of t.langues) r.ligneInfo(`En ${LANGUES_LISIBLES[l.langue]} (${l.reponses})`, `${note(l.comprehensionMoyenne)} sur 5`)
  for (const c of t.commentaires.slice(0, 5)) r.paragraphe(`Avis : ${c}`, { retrait: 12, taille: 9, gris: true })
}

// Email du 14e jour : le rapport et le brouillon sont prêts.
export function messageRapportPret({ email, appNom, appId, clientUrl }) {
  return {
    a: email,
    sujet: `Votre rapport de fin de test est prêt : « ${appNom} »`,
    texte: [
      'Bonjour,',
      '',
      `Votre test fermé de « ${appNom} » atteint son 14e jour. Le rapport de fin et le brouillon des réponses au formulaire Google d’accès à la production sont prêts.`,
      '',
      'Relisez le brouillon et complétez les passages entre crochets : seules vos propres informations doivent y figurer.',
      `${clientUrl}/mon-compte/apps/${appId}/campagne`,
      '',
      'Gardez vos testeurs inscrits jusqu’à votre demande d’accès à la production.',
      '',
      'L’équipe Nakayo',
    ].join('\n'),
  }
}

// Après la vérification de la nuit : prévient les développeurs dont le rapport vient d'être prêt.
export async function prevenirRapportsPrets({ pool, emails, config, journal }, { maintenant }) {
  // Sans messagerie (script lancé à la main), rien n'est marqué : le serveur préviendra lui-même.
  if (!emails) return 0
  const { rows } = await pool.query(
    `SELECT c.id, c.app_id, c.statut, c.demarree_le, c.jours_exiges, ap.nom, u.email
       FROM campagnes c JOIN apps ap ON ap.id = c.app_id JOIN utilisateurs u ON u.id = c.developpeur_id
      WHERE c.rapport_pret_le IS NULL AND c.statut IN ('en_cours', 'terminee')`,
  )
  let prevenus = 0
  for (const c of rows.filter((c) => rapportPret(c, maintenant))) {
    const { rowCount } = await pool.query('UPDATE campagnes SET rapport_pret_le = $2 WHERE id = $1 AND rapport_pret_le IS NULL', [c.id, maintenant])
    if (!rowCount) continue
    try {
      await emails.envoyer(messageRapportPret({ email: c.email, appNom: c.nom, appId: c.app_id, clientUrl: config?.clientUrl ?? '' }))
      prevenus++
    } catch (erreur) {
      journal.error(erreur)
    }
  }
  return prevenus
}

