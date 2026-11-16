import { Router } from 'express'
import { lireApp } from '../lib/apps.js'
import { ErreurHttp, introuvable } from '../lib/erreurs.js'
import { GRAVITES } from '../lib/bugs.js'
import { corps, exigerChamps, texte } from '../lib/validation.js'
import { exigerRole } from '../middlewares/authentification.js'
import { creerApp, enregistrerPreparation, lireAppDeveloppeur, listerAppsDeveloppeur, modifierApp, supprimerApp, versAppApi } from '../services/apps.js'
import { normaliserWhatsapp, validerWhatsapp } from '../services/support.js'
import { CODES_OFFRES, MOYENS_PAIEMENT, offre as lireOffre } from '../lib/offres.js'
import { ELEMENTS_PREPARATION, lirePreparation } from '../lib/preparation.js'
import { creerPaiement, enregistrerReferenceFournisseur, marquerPaiementEchoue, versPaiementApi } from '../services/paiements.js'
import { demarrerCampagne, lireCampagne, lireCampagneApp, messageNouvelleApp, telephonesTesteurs } from '../services/campagnes.js'
import { lireAvancement } from '../services/avancement.js'
import { enregistrerDecision, lireRapportFinal, rapportPdf } from '../services/rapportFinal.js'
import { jourBenin } from '../lib/temps.js'
import { bugsEnCsv, cheminCapture, deciderBug, LIBELLES_STATUT_BUG, listerBugsApp, MOTIF_REFUS, resumeBugsApp } from '../services/bugs.js'
import { cheminAbsolu } from '../services/documents.js'
import { transaction } from './auth.js'

const DECISIONS_GOOGLE = ['acceptee', 'refusee']

// Date AAAA-MM-JJ qui existe vraiment (refuse 2026-02-30).
function dateValide(valeur) {
  if (typeof valeur !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valeur)) return false
  const date = new Date(`${valeur}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(valeur)
}

// Seul un compte validé par l'équipe peut soumettre ou modifier une app.
function exigerCompteValide(req, _res, next) {
  if (req.session.utilisateur.statut === 'valide') return next()
  next(new ErreurHttp(403, 'compte_non_valide', { message: 'Votre compte doit être validé pour soumettre une app.' }))
}

// Un identifiant non numérique ne peut correspondre à aucune app.
function idApp(req) {
  if (!/^\d{1,18}$/.test(req.params.id)) throw introuvable('App introuvable.')
  return req.params.id
}

function lireCorps(req) {
  const { valeurs, erreurs } = lireApp(corps(req))
  exigerChamps(erreurs)
  return valeurs
}

// docs/api-sprint2.md §1 : apps du développeur connecté (cookie du site).
export function routesApps(deps) {
  const { pool, limites, maintenant, config, sms, emails, journal } = deps
  const routeur = Router()
  routeur.use(exigerRole('developpeur'))
  const developpeurId = (req) => req.session.utilisateur.id

  routeur.get('/', async (req, res) => {
    res.json({ apps: await listerAppsDeveloppeur(pool, developpeurId(req)) })
  })

  routeur.post('/', exigerCompteValide, async (req, res) => {
    const valeurs = lireCorps(req)
    limites.apps.consommer(String(developpeurId(req)))
    const app = await creerApp(pool, { developpeurId: developpeurId(req), valeurs, maintenant: maintenant() })
    res.status(201).json({ app })
  })

  routeur.get('/:id', async (req, res) => {
    res.json({ app: versAppApi(await lireAppDeveloppeur(pool, { id: idApp(req), developpeurId: developpeurId(req) })) })
  })

  routeur.put('/:id', exigerCompteValide, async (req, res) => {
    const id = idApp(req)
    const valeurs = lireCorps(req)
    res.json({ app: await modifierApp(pool, { id, developpeurId: developpeurId(req), valeurs, maintenant: maintenant() }) })
  })

  // Paiement commun à l'achat de l'offre (§2.2) et à la montée en gamme (docs/api-offres.md §2).
  // Le développeur est ensuite envoyé chez le fournisseur (ou sur la page de simulation).
  async function lancerPaiement(req, res, { nature, verifier }) {
    const id = idApp(req)
    const fedapay = config.paiementMode === 'fedapay' ? deps.fedapay : null
    if (config.paiementMode !== 'simulation' && !fedapay) {
      throw new ErreurHttp(503, 'paiement_indisponible', { message: 'Le paiement en ligne n’est pas encore ouvert.' })
    }
    const { moyen, numeroMomo, offre = nature === 'offre' ? 'standard' : 'pro' } = corps(req)
    const numero = moyen === 'mobile_money' ? normaliserWhatsapp(numeroMomo) : null
    exigerChamps({
      offre: CODES_OFFRES.includes(offre) && (nature === 'offre' || offre !== 'standard') ? null : 'valeur_inconnue',
      moyen: !moyen ? 'requis' : MOYENS_PAIEMENT.includes(moyen) ? null : 'valeur_inconnue',
      numeroMomo: moyen === 'mobile_money' ? validerWhatsapp(numero) : null,
    })
    const app = await lireAppDeveloppeur(pool, { id, developpeurId: developpeurId(req) })
    verifier?.(app, offre)
    limites.paiements.consommer(String(developpeurId(req)))
    const paiement = await creerPaiement(pool, {
      app,
      developpeurId: developpeurId(req),
      offre,
      nature,
      moyen,
      numeroMomo: numero,
      fournisseur: config.paiementMode,
      // FedaPay encaisse en FCFA : la carte est facturée au prix Mobile Money (même valeur, 1 $ = 600 FCFA).
      fcfa: Boolean(fedapay),
      maintenant: maintenant(),
    })
    if (!fedapay) {
      return res.status(201).json({ paiement: versPaiementApi(paiement), redirection: `/paiement/simulation/${paiement.reference}` })
    }
    // docs/fedapay.md §1 Page de paiement FedaPay ; le développeur revient ensuite sur « Mes paiements ».
    let lien
    try {
      lien = await fedapay.creerTransaction({
        reference: paiement.reference,
        montant: paiement.montant,
        devise: paiement.devise,
        description: nature === 'montee_en_gamme' ? `Nakayo · Passage à l’${lireOffre(offre).nom} · ${app.nom}` : `Nakayo · ${lireOffre(offre).nom} · ${app.nom}`,
        urlRetour: `${config.clientUrl}/mon-compte/paiements/${paiement.reference}`,
        client: { nom: req.session.utilisateur.nom, email: req.session.utilisateur.email, numero },
      })
    } catch (erreur) {
      deps.journal.error(erreur)
      await marquerPaiementEchoue(pool, { reference: paiement.reference, maintenant: maintenant() })
      throw new ErreurHttp(502, 'fournisseur_indisponible', { message: 'Le service de paiement ne répond pas. Réessayez dans quelques minutes.' })
    }
    await enregistrerReferenceFournisseur(pool, { reference: paiement.reference, referenceFournisseur: lien.id })
    res.status(201).json({ paiement: versPaiementApi(paiement), redirection: lien.url })
  }

  // §2.2 Paiement de l'offre (Standard ou Pro) pour une app en brouillon.
  routeur.post('/:id/paiements', exigerCompteValide, (req, res) => lancerPaiement(req, res, { nature: 'offre' }))

  // docs/api-offres.md §2 : passage de Standard à Pro d'une app déjà payée, même pendant la
  // campagne. Le développeur paie la différence de prix.
  routeur.post('/:id/montee-en-gamme', exigerCompteValide, (req, res) =>
    lancerPaiement(req, res, {
      nature: 'montee_en_gamme',
      verifier(app, offre) {
        if (app.statut === 'brouillon' || app.statut === 'refusee') {
          throw new ErreurHttp(409, 'statut_incompatible', { message: 'Choisissez l’offre au moment du paiement.', statut: app.statut })
        }
        if (app.offre === offre) throw new ErreurHttp(409, 'deja_dans_cette_offre', { message: 'Cette app est déjà dans cette offre.' })
        if (app.campagne_statut && app.campagne_statut !== 'en_cours') {
          throw new ErreurHttp(409, 'campagne_terminee', { message: 'La campagne de test est terminée.' })
        }
      },
    }),
  )

  // §6 Préparation du lancement (US-42) : la liste des points et le groupe des testeurs (US-13).
  routeur.get('/:id/preparation', async (req, res) => {
    const app = versAppApi(await lireAppDeveloppeur(pool, { id: idApp(req), developpeurId: developpeurId(req) }))
    res.json({ preparation: app.preparation, elements: ELEMENTS_PREPARATION, groupeTesteurs: config.groupeTesteurs })
  })

  routeur.put('/:id/preparation', async (req, res) => {
    const id = idApp(req)
    const { valeurs, erreur } = lirePreparation(corps(req))
    exigerChamps({ elements: erreur })
    const app = await enregistrerPreparation(pool, {
      id,
      developpeurId: developpeurId(req),
      elements: valeurs,
      total: ELEMENTS_PREPARATION.length,
      maintenant: maintenant(),
    })
    res.json({ app })
  })

  // docs/api-sprint3.md §1.3 : campagne de test de l'app (null tant qu'elle n'a pas démarré).
  routeur.get('/:id/campagne', async (req, res) => {
    const id = idApp(req)
    await lireAppDeveloppeur(pool, { id, developpeurId: developpeurId(req) })
    res.json({ campagne: await lireCampagneApp(pool, { appId: id, developpeurId: developpeurId(req), maintenant: maintenant() }) })
  })

  // US-13 : le développeur confirme avoir ajouté les testeurs à son test fermé ; la campagne
  // démarre et 15 testeurs sont affectés (US-16), puis prévenus par SMS.
  routeur.post('/:id/campagne', exigerCompteValide, async (req, res) => {
    const id = idApp(req)
    const instant = maintenant()
    const campagneId = await transaction(pool, (client) =>
      demarrerCampagne(client, { appId: id, developpeurId: developpeurId(req), groupeGoogle: config.groupeTesteurs, maintenant: instant }),
    )
    const campagne = await lireCampagne(pool, campagneId, { maintenant: instant, vue: 'developpeur' })
    try {
      for (const telephone of await telephonesTesteurs(pool, campagneId)) {
        await sms.envoyer({ a: telephone, texte: messageNouvelleApp(campagne.app.nom) })
      }
      await emails.envoyer(messageCampagneDemarree(campagne, { email: req.session.utilisateur.email, clientUrl: config.clientUrl }))
    } catch (erreur) {
      // La campagne est démarrée ; un envoi raté est journalisé pour être refait à la main.
      journal.error(erreur)
    }
    res.status(201).json({ campagne })
  })

  // docs/api-sprint4.md §1 (US-21) : avancement de la campagne au jour le jour.
  routeur.get('/:id/campagne/avancement', async (req, res) => {
    const id = idApp(req)
    res.json({ avancement: await lireAvancement(pool, { appId: id, developpeurId: developpeurId(req), maintenant: maintenant() }) })
  })

  // docs/api-bugs.md §2 (US-34) : bugs signalés par les testeurs, décision et export CSV.
  routeur.get('/:id/bugs', async (req, res) => {
    const app = await lireAppDeveloppeur(pool, { id: idApp(req), developpeurId: developpeurId(req) })
    const gravite = texte(req.query.gravite) || null
    const statut = texte(req.query.statut) || null
    exigerChamps({
      gravite: gravite && !GRAVITES.includes(gravite) ? 'valeur_inconnue' : null,
      statut: statut && !(statut in LIBELLES_STATUT_BUG) ? 'valeur_inconnue' : null,
    })
    const [bugs, resume] = await Promise.all([listerBugsApp(pool, { appId: app.id, gravite, statut }), resumeBugsApp(pool, { appId: app.id })])
    res.json({ bugs, resume, rapportsDeBugs: lireOffre(app.offre).rapportsDeBugs })
  })

  routeur.get('/:id/bugs.csv', async (req, res) => {
    const app = await lireAppDeveloppeur(pool, { id: idApp(req), developpeurId: developpeurId(req) })
    const bugs = await listerBugsApp(pool, { appId: app.id })
    const nom = app.package.replace(/[^a-zA-Z0-9._-]/g, '-')
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="bugs-${nom}.csv"`, 'Cache-Control': 'private, no-store' })
    res.send(bugsEnCsv(bugs))
  })

  routeur.get('/:id/bugs/:bugId/captures/:rang', async (req, res) => {
    const app = await lireAppDeveloppeur(pool, { id: idApp(req), developpeurId: developpeurId(req) })
    const chemin = await cheminCapture(pool, { appId: app.id, bugId: req.params.bugId, rang: req.params.rang })
    res.set({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' })
    res.type(chemin.endsWith('.png') ? 'image/png' : 'image/jpeg')
    res.sendFile(cheminAbsolu(config.dossierDocuments, chemin), (erreur) => {
      if (erreur && !res.headersSent) {
        journal.error(erreur)
        res.status(404).json({ erreur: { code: 'introuvable', message: 'Capture introuvable.' } })
      }
    })
  })

  routeur.post('/:id/bugs/:bugId/decision', async (req, res) => {
    const app = await lireAppDeveloppeur(pool, { id: idApp(req), developpeurId: developpeurId(req) })
    const decision = texte(corps(req).decision)
    const motif = texte(corps(req).motif)
    const [min, max] = MOTIF_REFUS
    exigerChamps({
      decision: !decision ? 'requis' : ['accepte', 'refuse'].includes(decision) ? null : 'valeur_inconnue',
      motif: decision !== 'refuse' ? null : !motif ? 'requis' : motif.length < min ? 'trop_court' : motif.length > max ? 'trop_long' : null,
    })
    res.json({ bug: await deciderBug(pool, { appId: app.id, bugId: req.params.bugId, decision, motif, maintenant: maintenant() }) })
  })

  // §6 (US-36) : rapport de fin, brouillon des réponses au formulaire Google et décision de Google.
  routeur.get('/:id/campagne/rapport', async (req, res) => {
    const id = idApp(req)
    res.json({ rapport: await lireRapportFinal(pool, { appId: id, developpeurId: developpeurId(req), maintenant: maintenant() }) })
  })

  routeur.get('/:id/campagne/rapport.pdf', async (req, res) => {
    const id = idApp(req)
    const instant = maintenant()
    const rapport = await lireRapportFinal(pool, { appId: id, developpeurId: developpeurId(req), maintenant: instant })
    if (!rapport.pret) throw new ErreurHttp(409, 'rapport_pas_pret', { message: 'Le rapport de fin est prêt au 14e jour du test.', disponibleLe: rapport.disponibleLe })
    const nom = rapport.bilan.app.package.replace(/[^a-zA-Z0-9._-]/g, '-')
    res.set('Content-Type', 'application/pdf')
    res.set('Content-Disposition', `attachment; filename="rapport-nakayo-${nom}.pdf"`)
    res.send(rapportPdf(rapport, { maintenant: instant }))
  })

  routeur.put('/:id/campagne/decision-google', async (req, res) => {
    const id = idApp(req)
    const { decision, le } = corps(req)
    const instant = maintenant()
    exigerChamps({
      decision: !DECISIONS_GOOGLE.includes(decision) && (decision === undefined || decision === '' ? 'requis' : 'valeur_inconnue'),
      le: le !== undefined && le !== null && le !== '' && (!dateValide(le) || le > jourBenin(instant)) && 'format_invalide',
    })
    const decisionGoogle = await enregistrerDecision(pool, { appId: id, developpeurId: developpeurId(req), decision, le: le || null, maintenant: instant })
    res.json({ decisionGoogle })
  })

  // Méthode de secours d'US-13 : la liste des Gmail des testeurs, à coller dans la Play Console.
  routeur.get('/:id/campagne/testeurs.csv', async (req, res) => {
    const id = idApp(req)
    const campagne = await lireCampagneApp(pool, { appId: id, developpeurId: developpeurId(req), maintenant: maintenant() })
    if (!campagne) throw introuvable('Campagne introuvable.')
    res.set('Content-Type', 'text/csv; charset=utf-8')
    res.set('Content-Disposition', `attachment; filename="testeurs-${campagne.app.package}.csv"`)
    res.send(['gmail', ...campagne.testeurs.map((t) => t.gmail)].join('\n') + '\n')
  })

  routeur.delete('/:id', async (req, res) => {
    await supprimerApp(pool, { id: idApp(req), developpeurId: developpeurId(req) })
    res.status(204).end()
  })

  return routeur
}

function messageCampagneDemarree(campagne, { email, clientUrl }) {
  return {
    a: email,
    sujet: `La campagne de « ${campagne.app.nom} » a démarré`,
    texte: [
      'Bonjour,',
      '',
      `${campagne.compteurs.affectes} testeurs sont affectés à votre app « ${campagne.app.nom} » et viennent d’être prévenus.`,
      `Ils s’inscrivent à votre test fermé dans les prochaines heures. La campagne dure ${campagne.joursCampagne} jours, dont ${campagne.joursExiges} exigés par Google.`,
      '',
      'Gardez les testeurs inscrits jusqu’au bout : ne retirez ni le groupe ni la liste de votre test fermé.',
      '',
      `Suivre la campagne : ${clientUrl}/mon-compte/apps/${campagne.app.id}/campagne`,
      '',
      'L’équipe Nakayo',
    ].join('\n'),
  }
}
