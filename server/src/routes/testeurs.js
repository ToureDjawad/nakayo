import { once } from 'node:events'
import { Router } from 'express'
import multer from 'multer'
import { ErreurHttp, nonAuthentifie } from '../lib/erreurs.js'
import { hacherJeton } from '../lib/jetons.js'
import { exigerRole } from '../middlewares/authentification.js'
import {
  lireAppareil,
  lireLangues,
  normaliserGmail,
  normaliserTelephone,
  typeImage,
  validerAncienneteGmail, validerGmail,
  validerOperateur,
  validerTelephone,
  validerMotifMomo,
  validerVille,
} from '../lib/testeurs.js'
import { lireCodeParrainage } from '../lib/parrainage.js'
import { corps, exigerChamps, texte, validerNom } from '../lib/validation.js'
import { ecrireDocument, supprimerDocuments } from '../services/documents.js'
import { lireParrainage, trouverParrain } from '../services/parrainage.js'
import { ouvrirSession } from '../services/sessions.js'
import { enregistrerAppareil, lireProfilTesteur, versDemandeApi } from '../services/testeurs.js'
import { transaction } from './auth.js'

export const TAILLE_MAX_PHOTO = 5 * 1024 * 1024
const PHOTOS = { pieceIdentite: 'piece_identite', selfie: 'selfie' }

const conflit = (champs) => new ErreurHttp(409, 'conflit', { message: 'Valeur déjà utilisée.', champs })
const CONTRAINTES = {
  profils_gmail_unique: 'gmail',
  profils_momo_unique: 'numeroMomo',
  utilisateurs_telephone_unique: 'telephone',
}

// Lecture du formulaire multipart en mémoire (2 photos de 5 Mo au plus).
function lireFormulaire(req, res) {
  const televersement = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: TAILLE_MAX_PHOTO, files: 2, fields: 20, fieldSize: 10 * 1024 },
  }).fields([
    { name: 'pieceIdentite', maxCount: 1 },
    { name: 'selfie', maxCount: 1 },
  ])
  return new Promise((resoudre, rejeter) => {
    televersement(req, res, (erreur) => {
      if (!erreur) return resoudre()
      if (erreur.code === 'LIMIT_FILE_SIZE') {
        return rejeter(
          new ErreurHttp(413, 'fichier_trop_lourd', {
            message: 'Photo trop lourde (5 Mo maximum).',
            champs: { [erreur.field]: 'fichier_trop_lourd' },
          }),
        )
      }
      if (erreur instanceof multer.MulterError) {
        return rejeter(new ErreurHttp(422, 'validation', { message: 'Formulaire invalide.', champs: { [erreur.field ?? 'formulaire']: 'format_invalide' } }))
      }
      rejeter(erreur)
    })
  })
}

export function routesTesteurs(deps) {
  const { pool, config, maintenant } = deps
  const routeur = Router()

  // §4.3 Inscription d'un testeur, avec le jeton remis après le code SMS.
  routeur.post('/inscription', async (req, res) => {
    const autorisation = req.headers.authorization ?? ''
    const jetonInscription = autorisation.startsWith('Bearer ') ? autorisation.slice(7).trim() : ''
    const instant = maintenant()
    const { rows: jetons } = jetonInscription
      ? await pool.query(
          `SELECT id, telephone, appareil FROM jetons_inscription
            WHERE jeton_hash = $1 AND utilise_le IS NULL AND expire_le > $2`,
          [hacherJeton(jetonInscription), instant],
        )
      : { rows: [] }
    if (!jetons.length) {
      // Lire la fin de l'envoi avant de répondre : sinon l'app reçoit une connexion coupée
      // au lieu du 401 qui lui dit de repartir à l'étape du numéro.
      req.resume()
      if (!req.readableEnded) await once(req, 'end')
      throw nonAuthentifie()
    }

    if (!req.is('multipart/form-data')) {
      throw new ErreurHttp(422, 'validation', { message: 'Formulaire multipart attendu.', champs: { formulaire: 'format_invalide' } })
    }
    await lireFormulaire(req, res)
    const champs = req.body ?? {}
    const fichiers = req.files ?? {}

    const nom = texte(champs.nom)
    const ville = texte(champs.ville)
    const gmail = texte(champs.gmail).toLowerCase()
    const ancienneteGmail = texte(champs.ancienneteGmail)
    const numeroMomo = normaliserTelephone(champs.numeroMomo)
    const operateurMomo = texte(champs.operateurMomo).toLowerCase()
    const { appareil, erreur: erreurAppareil } = lireAppareil(champs.appareil ?? jetons[0].appareil)
    // US-39 : code de parrainage facultatif.
    const parrainage = lireCodeParrainage(champs.codeParrainage)
    const parrainId = parrainage.code ? await trouverParrain(pool, parrainage.code) : null

    const photos = {}
    const erreursPhotos = {}
    for (const champ of Object.keys(PHOTOS)) {
      const fichier = fichiers[champ]?.[0]
      if (!fichier || !fichier.size) {
        erreursPhotos[champ] = 'requis'
        continue
      }
      const typeMime = typeImage(fichier.buffer)
      if (!typeMime) erreursPhotos[champ] = 'type_fichier_invalide'
      else photos[champ] = { typeMime, contenu: fichier.buffer, taille: fichier.size }
    }

    exigerChamps({
      nom: validerNom(nom),
      ville: validerVille(ville),
      gmail: validerGmail(gmail),
      ancienneteGmail: validerAncienneteGmail(ancienneteGmail),
      numeroMomo: validerTelephone(numeroMomo),
      operateurMomo: validerOperateur(operateurMomo),
      consentementSuivi: champs.consentementSuivi === 'true' ? null : 'doit_etre_accepte',
      accepteConditions: champs.accepteConditions === 'true' ? null : 'doit_etre_accepte',
      appareil: erreurAppareil,
      codeParrainage: parrainage.erreur ?? (parrainage.code && !parrainId ? 'inconnu' : null),
      ...erreursPhotos,
    })

    const gmailNormalise = normaliserGmail(gmail)
    const { rows: doublons } = await pool.query(
      `SELECT gmail_normalise = $1 AS gmail, numero_momo = $2 AS momo FROM profils_testeurs
        WHERE gmail_normalise = $1 OR numero_momo = $2`,
      [gmailNormalise, numeroMomo],
    )
    const champsConflit = {}
    if (doublons.some((d) => d.gmail)) champsConflit.gmail = 'deja_utilise'
    if (doublons.some((d) => d.momo)) champsConflit.numeroMomo = 'deja_utilise'
    if (Object.keys(champsConflit).length) throw conflit(champsConflit)

    const ecrits = []
    let resultat
    try {
      resultat = await transaction(pool, async (client) => {
        const { rows: verrou } = await client.query(
          'SELECT id, telephone, cree_le FROM jetons_inscription WHERE id = $1 AND utilise_le IS NULL FOR UPDATE',
          [jetons[0].id],
        )
        if (!verrou.length) throw nonAuthentifie()
        await client.query('UPDATE jetons_inscription SET utilise_le = $2 WHERE id = $1', [verrou[0].id, instant])

        const { rows } = await client.query(
          `INSERT INTO utilisateurs (role, statut, nom, telephone, telephone_verifie_le, cree_le, modifie_le)
           VALUES ('testeur', 'en_attente', $1, $2, $3, $4, $4) RETURNING id`,
          [nom, verrou[0].telephone, verrou[0].cree_le, instant],
        )
        const utilisateurId = rows[0].id
        await client.query(
          `INSERT INTO profils_testeurs (utilisateur_id, ville, gmail, gmail_normalise, numero_momo, operateur_momo,
                                         consentement_suivi_le, conditions_acceptees_le, parrain_id, anciennete_gmail)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9)`,
          [utilisateurId, ville, gmail, gmailNormalise, numeroMomo, operateurMomo, instant, parrainId, ancienneteGmail],
        )
        await enregistrerAppareil(client, { utilisateurId, appareil, maintenant: instant })

        for (const [champ, photo] of Object.entries(photos)) {
          const chemin = await ecrireDocument(config.dossierDocuments, {
            utilisateurId,
            type: PHOTOS[champ],
            typeMime: photo.typeMime,
            contenu: photo.contenu,
          })
          ecrits.push(chemin)
          await client.query(
            `INSERT INTO documents_identite (utilisateur_id, type, chemin, type_mime, taille_octets, cree_le)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [utilisateurId, PHOTOS[champ], chemin, photo.typeMime, photo.taille, instant],
          )
        }

        const { jeton } = await ouvrirSession(client, { utilisateurId, client: 'android', maintenant: instant })
        return { utilisateurId, jeton }
      })
    } catch (erreur) {
      await supprimerDocuments(config.dossierDocuments, ecrits)
      if (erreur.code === '23505' && CONTRAINTES[erreur.constraint]) {
        throw conflit({ [CONTRAINTES[erreur.constraint]]: 'deja_utilise' })
      }
      throw erreur
    }

    deps.apresInscription?.(resultat.utilisateurId)
    const utilisateur = await lireProfilTesteur(pool, resultat.utilisateurId)
    res.status(201).json({ jeton: resultat.jeton, utilisateur })
  })

  const testeur = exigerRole('testeur')
  const NON_MODIFIABLES = ['numeroMomo', 'operateurMomo', 'gmail', 'telephone']

  // §4.4 Profil du testeur connecté.
  routeur.get('/moi', testeur, async (req, res) => {
    res.json({ utilisateur: await lireProfilTesteur(pool, req.session.utilisateur.id) })
  })

  // US-39 : code de parrainage, prime et filleuls (docs/api-parrainage.md §2).
  routeur.get('/moi/parrainage', testeur, async (req, res) => {
    res.json({ parrainage: await lireParrainage(pool, req.session.utilisateur.id) })
  })

  // §4.4 Langues et appareil. Le numéro MoMo, le Gmail et le téléphone ne changent pas ici.
  routeur.patch('/moi', testeur, async (req, res) => {
    const donnees = corps(req)
    const regles = Object.fromEntries(
      NON_MODIFIABLES.filter((champ) => champ in donnees).map((champ) => [champ, 'non_modifiable']),
    )
    const langues = 'langues' in donnees ? lireLangues(donnees.langues) : null
    const appareil = 'appareil' in donnees ? lireAppareil(donnees.appareil) : null
    exigerChamps({ ...regles, langues: langues?.erreur, appareil: appareil?.erreur })

    const id = req.session.utilisateur.id
    const instant = maintenant()
    await transaction(pool, async (client) => {
      if (langues) await client.query('UPDATE profils_testeurs SET langues = $2 WHERE utilisateur_id = $1', [id, langues.langues])
      if (appareil) await enregistrerAppareil(client, { utilisateurId: id, appareil: appareil.appareil, maintenant: instant })
      await client.query('UPDATE utilisateurs SET modifie_le = $2 WHERE id = $1', [id, instant])
    })
    res.json({ utilisateur: await lireProfilTesteur(pool, id) })
  })

  // §4.4 Demande de changement de numéro Mobile Money, traitée plus tard par un admin.
  routeur.post('/moi/demande-changement-momo', testeur, async (req, res) => {
    const donnees = corps(req)
    const numeroMomo = normaliserTelephone(donnees.numeroMomo)
    const operateurMomo = texte(donnees.operateurMomo).toLowerCase()
    const motif = texte(donnees.motif)
    exigerChamps({
      numeroMomo: validerTelephone(numeroMomo),
      operateurMomo: validerOperateur(operateurMomo),
      motif: validerMotifMomo(motif),
    })

    const id = req.session.utilisateur.id
    const { rows: profil } = await pool.query(
      'SELECT numero_momo, operateur_momo FROM profils_testeurs WHERE utilisateur_id = $1',
      [id],
    )
    if (profil[0].numero_momo === numeroMomo && profil[0].operateur_momo === operateurMomo) {
      exigerChamps({ numeroMomo: 'identique' })
    }
    const { rows: autres } = await pool.query(
      'SELECT 1 FROM profils_testeurs WHERE numero_momo = $1 AND utilisateur_id <> $2',
      [numeroMomo, id],
    )
    if (autres.length) throw conflit({ numeroMomo: 'deja_utilise' })

    const statutIncompatible = () =>
      new ErreurHttp(409, 'statut_incompatible', { message: 'Une demande est déjà en attente.' })
    try {
      const { rows } = await pool.query(
        `INSERT INTO demandes_changement_momo (utilisateur_id, numero_momo, operateur_momo, motif, cree_le)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [id, numeroMomo, operateurMomo, motif, maintenant()],
      )
      res.status(201).json({ demande: versDemandeApi(rows[0]) })
    } catch (erreur) {
      if (erreur.code === '23505' && erreur.constraint === 'demande_momo_unique_en_cours') throw statutIncompatible()
      throw erreur
    }
  })

  return routeur
}
