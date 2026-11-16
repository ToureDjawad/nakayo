import { once } from 'node:events'
import { Router } from 'express'
import multer from 'multer'
import { ErreurHttp } from '../lib/erreurs.js'
import { CAPTURES_MAX, lireBug } from '../lib/bugs.js'
import { lireRapport, lireUsages, SOURCE_PLAY_STORE } from '../lib/rapports.js'
import { typeImage } from '../lib/testeurs.js'
import { corps, exigerChamps, texte } from '../lib/validation.js'
import { exigerRole } from '../middlewares/authentification.js'
import { ecrireDocument, supprimerDocuments } from '../services/documents.js'
import {
  confirmerInscription,
  confirmerInstallation,
  enregistrerRapport,
  enregistrerSignal,
  enregistrerUsages,
  exigerTesteurValide,
  lireAffectationTesteur,
  listerAppsTesteur,
  versAffectationTesteur,
} from '../services/testeurApps.js'
import { TAILLE_MAX_PHOTO } from './testeurs.js'
import { lirePortefeuille } from '../services/versements.js'
import { enregistrerBug, exigerRapportsDeBugs, listerBugsTesteur, versBugTesteur } from '../services/bugs.js'
import { lireRetourTerrain } from '../lib/terrain.js'
import { enregistrerRetourTerrain } from '../services/terrain.js'
import { jourCampagne } from '../services/campagnes.js'
import { empreinteReseau } from '../lib/reseaux.js'
import { noterReseau } from '../services/reseaux.js'
import { lireIntegrite, signalerIntegrite } from '../services/fraude.js'

// Capture d'écran « Vous êtes testeur » (5 Mo au plus), lue en mémoire.
function lireCapture(req, res) {
  const televersement = multer({ storage: multer.memoryStorage(), limits: { fileSize: TAILLE_MAX_PHOTO, files: 1, fields: 5 } }).single('capture')
  return new Promise((resoudre, rejeter) => {
    televersement(req, res, (erreur) => {
      if (!erreur) return resoudre(req.file)
      if (erreur.code === 'LIMIT_FILE_SIZE') {
        return rejeter(new ErreurHttp(413, 'fichier_trop_lourd', { message: 'Capture trop lourde (5 Mo maximum).', champs: { capture: 'fichier_trop_lourd' } }))
      }
      if (erreur instanceof multer.MulterError) {
        return rejeter(new ErreurHttp(422, 'validation', { message: 'Formulaire invalide.', champs: { capture: 'format_invalide' } }))
      }
      rejeter(erreur)
    })
  })
}

// Captures d'un rapport de bug (US-33) : 5 images de 5 Mo au plus, avec les champs texte.
function lireFormulaireBug(req, res) {
  const televersement = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: TAILLE_MAX_PHOTO, files: CAPTURES_MAX, fields: 10, fieldSize: 4096 },
  }).array('captures', CAPTURES_MAX)
  return new Promise((resoudre, rejeter) => {
    televersement(req, res, (erreur) => {
      if (!erreur) return resoudre(req.files ?? [])
      if (erreur.code === 'LIMIT_FILE_SIZE') {
        return rejeter(new ErreurHttp(413, 'fichier_trop_lourd', { message: 'Capture trop lourde (5 Mo maximum).', champs: { captures: 'fichier_trop_lourd' } }))
      }
      if (['LIMIT_FILE_COUNT', 'LIMIT_UNEXPECTED_FILE'].includes(erreur.code)) {
        return rejeter(new ErreurHttp(422, 'validation', { message: `${CAPTURES_MAX} captures au plus.`, champs: { captures: 'trop_nombreuses' } }))
      }
      if (erreur instanceof multer.MulterError) {
        return rejeter(new ErreurHttp(422, 'validation', { message: 'Formulaire invalide.', champs: { captures: 'format_invalide' } }))
      }
      rejeter(erreur)
    })
  })
}

// docs/api-sprint3.md §2 : le test quotidien, depuis l'app Android du testeur.
export function routesTesteurApps({ pool, config, maintenant }) {
  const routeur = Router()
  routeur.use(exigerRole('testeur'), exigerTesteurValide)
  const testeurId = (req) => req.session.utilisateur.id

  async function repondreAffectation(res, req) {
    const instant = maintenant()
    const ligne = await lireAffectationTesteur(pool, { id: req.params.id, testeurId: testeurId(req), maintenant: instant })
    res.json({ app: versAffectationTesteur(ligne, instant) })
  }

  // §2.1 US-17 : les apps à tester, avec l'état du jour.
  routeur.get('/apps', async (req, res) => {
    res.json({ apps: await listerAppsTesteur(pool, { testeurId: testeurId(req), maintenant: maintenant() }) })
  })

  // Sprint 4 §3 US-23 : gains en attente, total versé et historique des versements.
  routeur.get('/portefeuille', async (req, res) => {
    res.json({ portefeuille: await lirePortefeuille(pool, { testeurId: testeurId(req) }) })
  })

  // §2.2 US-17 et US-43 : inscription au test confirmée par une capture.
  routeur.post('/apps/:id/inscription', async (req, res) => {
    const affectation = await lireAffectationTesteur(pool, { id: req.params.id, testeurId: testeurId(req), maintenant: maintenant() })
    if (!req.is('multipart/form-data')) {
      req.resume()
      if (!req.readableEnded) await once(req, 'end')
      throw new ErreurHttp(422, 'validation', { message: 'Formulaire multipart attendu.', champs: { capture: 'requis' } })
    }
    const fichier = await lireCapture(req, res)
    if (!fichier?.size) exigerChamps({ capture: 'requis' })
    const typeMime = typeImage(fichier.buffer)
    if (!typeMime) exigerChamps({ capture: 'type_fichier_invalide' })
    // US-07 : première campagne, le Gmail déclaré doit être le compte principal du Play Store.
    if (!affectation.gmail_principal_confirme_le && req.body?.gmailPrincipal !== 'true') exigerChamps({ gmailPrincipal: 'doit_etre_confirme' })
    const chemin = await ecrireDocument(config.dossierDocuments, {
      utilisateurId: testeurId(req),
      type: `inscription-${affectation.id}`,
      typeMime,
      contenu: fichier.buffer,
    })
    const ancienne = await confirmerInscription(pool, { affectation, chemin, maintenant: maintenant() })
    if (ancienne) await supprimerDocuments(config.dossierDocuments, [ancienne])
    await repondreAffectation(res, req)
  })

  // §2.3 US-18 : installation depuis le Play Store (source d'installation donnée par Android).
  routeur.post('/apps/:id/installation', async (req, res) => {
    const source = texte(corps(req).sourceInstallation)
    exigerChamps({ sourceInstallation: !source ? 'requis' : source === SOURCE_PLAY_STORE ? null : 'source_non_play_store' })
    const affectation = await lireAffectationTesteur(pool, { id: req.params.id, testeurId: testeurId(req), maintenant: maintenant() })
    await confirmerInstallation(pool, { affectation, maintenant: maintenant() })
    await repondreAffectation(res, req)
  })

  // §2.4 US-19 : rapport du jour.
  routeur.post('/apps/:id/rapports', async (req, res) => {
    const instant = maintenant()
    const affectation = await lireAffectationTesteur(pool, { id: req.params.id, testeurId: testeurId(req), maintenant: instant })
    const { retourDetailleAttendu } = versAffectationTesteur(affectation, instant)
    const { valeurs, erreurs } = lireRapport(corps(req), { fonctionnalites: affectation.fonctionnalites, retourAttendu: retourDetailleAttendu })
    exigerChamps(erreurs)
    await enregistrerRapport(pool, { affectation, testeurId: testeurId(req), valeurs, maintenant: instant })
    // US-16 : empreinte du Wi-Fi du testeur, pour ne pas réunir deux testeurs d'un même réseau.
    if (valeurs.wifi) await noterReseau(pool, { testeurId: testeurId(req), empreinte: empreinteReseau(req.ip, config.secretReseaux), maintenant: instant })
    const ligne = await lireAffectationTesteur(pool, { id: req.params.id, testeurId: testeurId(req), maintenant: instant })
    res.status(201).json({ app: versAffectationTesteur(ligne, instant) })
  })

  // docs/api-bugs.md §1 US-33 : rapport de bug avec captures (offres Pro et Plus).
  routeur.post('/apps/:id/bugs', async (req, res) => {
    const instant = maintenant()
    const affectation = await lireAffectationTesteur(pool, { id: req.params.id, testeurId: testeurId(req), maintenant: instant })
    exigerRapportsDeBugs(affectation)
    if (!req.is('multipart/form-data')) {
      req.resume()
      if (!req.readableEnded) await once(req, 'end')
      throw new ErreurHttp(422, 'validation', { message: 'Formulaire multipart attendu.', champs: { titre: 'requis' } })
    }
    const fichiers = await lireFormulaireBug(req, res)
    const { valeurs, erreurs } = lireBug(req.body ?? {})
    const types = fichiers.map((f) => typeImage(f.buffer))
    erreurs.captures = types.some((t) => !t) ? 'type_fichier_invalide' : null
    exigerChamps(erreurs)

    const captures = []
    try {
      for (const [i, fichier] of fichiers.entries()) {
        captures.push(
          await ecrireDocument(config.dossierDocuments, {
            utilisateurId: testeurId(req),
            type: `bug-${affectation.id}`,
            typeMime: types[i],
            contenu: fichier.buffer,
          }),
        )
      }
      const bug = await enregistrerBug(pool, { affectation, valeurs, captures, maintenant: instant })
      res.status(201).json({ bug: versBugTesteur(bug) })
    } catch (erreur) {
      await supprimerDocuments(config.dossierDocuments, captures)
      throw erreur
    }
  })

  // docs/api-bugs.md §1.2 : les bugs que le testeur a signalés sur cette app, avec la décision du développeur.
  routeur.get('/apps/:id/bugs', async (req, res) => {
    const affectation = await lireAffectationTesteur(pool, { id: req.params.id, testeurId: testeurId(req), maintenant: maintenant() })
    exigerRapportsDeBugs(affectation)
    res.json({ bugs: await listerBugsTesteur(pool, { affectation }) })
  })

  // docs/api-offres.md §4.5 : questionnaire terrain de l'Offre Plus (US-37).
  routeur.post('/apps/:id/terrain', async (req, res) => {
    const instant = maintenant()
    const affectation = await lireAffectationTesteur(pool, { id: req.params.id, testeurId: testeurId(req), maintenant: instant })
    const { valeurs, erreurs } = lireRetourTerrain(corps(req))
    exigerChamps(erreurs)
    await enregistrerRetourTerrain(pool, { affectation, jour: jourCampagne(affectation.demarree_le, instant), valeurs, maintenant: instant })
    await repondreAffectation(res.status(201), req)
  })

  // §2.5 US-18 : ouverture de l'app compagnon.
  routeur.post('/signal', async (req, res) => {
    const instant = maintenant()
    // US-28 : l'app indique si elle tourne sur un émulateur ou un téléphone rooté.
    const { integrite, erreur } = lireIntegrite(req.body)
    exigerChamps({ integrite: erreur })
    await enregistrerSignal(pool, { testeurId: testeurId(req), maintenant: instant })
    await signalerIntegrite(pool, { testeurId: testeurId(req), integrite, maintenant: instant })
    res.json({ recuLe: instant.toISOString() })
  })

  // §2.6 US-18 : temps passé dans les apps testées.
  routeur.post('/usages', async (req, res) => {
    const { usages, erreur } = lireUsages(corps(req))
    exigerChamps({ usages: erreur })
    res.json(await enregistrerUsages(pool, { testeurId: testeurId(req), usages, maintenant: maintenant() }))
  })

  return routeur
}
