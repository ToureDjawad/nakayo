import { Router } from 'express'
import { lireApp } from '../lib/apps.js'
import { ErreurHttp, introuvable } from '../lib/erreurs.js'
import { corps, exigerChamps } from '../lib/validation.js'
import { exigerRole } from '../middlewares/authentification.js'
import { creerApp, enregistrerPreparation, lireAppDeveloppeur, listerAppsDeveloppeur, modifierApp, supprimerApp, versAppApi } from '../services/apps.js'
import { normaliserWhatsapp, validerWhatsapp } from '../services/support.js'
import { MOYENS_PAIEMENT } from '../lib/offres.js'
import { ELEMENTS_PREPARATION, lirePreparation } from '../lib/preparation.js'
import { creerPaiement, versPaiementApi } from '../services/paiements.js'
import { demarrerCampagne, lireCampagne, lireCampagneApp, messageNouvelleApp, telephonesTesteurs } from '../services/campagnes.js'
import { lireAvancement } from '../services/avancement.js'
import { transaction } from './auth.js'

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
export function routesApps({ pool, limites, maintenant, config, sms, emails, journal }) {
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

  // §2.2 Paiement de l'offre pour une app en brouillon. Le développeur est ensuite envoyé chez
  // le fournisseur (ou sur la page de simulation en développement).
  routeur.post('/:id/paiements', exigerCompteValide, async (req, res) => {
    const id = idApp(req)
    if (config.paiementMode !== 'simulation') {
      throw new ErreurHttp(503, 'paiement_indisponible', { message: 'Le paiement en ligne n’est pas encore ouvert.' })
    }
    const { moyen, numeroMomo } = corps(req)
    const numero = moyen === 'mobile_money' ? normaliserWhatsapp(numeroMomo) : null
    exigerChamps({
      moyen: !moyen ? 'requis' : MOYENS_PAIEMENT.includes(moyen) ? null : 'valeur_inconnue',
      numeroMomo: moyen === 'mobile_money' ? validerWhatsapp(numero) : null,
    })
    const app = await lireAppDeveloppeur(pool, { id, developpeurId: developpeurId(req) })
    limites.paiements.consommer(String(developpeurId(req)))
    const paiement = await creerPaiement(pool, {
      app,
      developpeurId: developpeurId(req),
      moyen,
      numeroMomo: numero,
      fournisseur: config.paiementMode,
      maintenant: maintenant(),
    })
    res.status(201).json({ paiement: versPaiementApi(paiement), redirection: `/paiement/simulation/${paiement.reference}` })
  })

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

  // Méthode de secours d'US-13 : la liste des Gmail des testeurs, à coller dans la Play Console.
  // docs/api-sprint4.md §1 (US-21) : avancement de la campagne au jour le jour.
  routeur.get('/:id/campagne/avancement', async (req, res) => {
    const id = idApp(req)
    res.json({ avancement: await lireAvancement(pool, { appId: id, developpeurId: developpeurId(req), maintenant: maintenant() }) })
  })

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
