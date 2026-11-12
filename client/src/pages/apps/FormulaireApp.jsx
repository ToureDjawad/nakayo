import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { lireApp, modifierApp, soumettreApp, supprimerApp } from '../../api/apps.js'
import { ErreurApi } from '../../api/client.js'
import { Alerte } from '../../components/Alerte.jsx'
import { Bouton, Indicateur } from '../../components/Bouton.jsx'
import { Champ, ChampTexte, ChoixRadio } from '../../components/Champ.jsx'
import { PageCompte, PanneauEtapes } from '../../components/MiseEnPage.jsx'
import { messageChamp, messageErreurGlobale } from '../../lib/messages.js'
import { useFormulaire } from '../../lib/useFormulaire.js'
import { useSession } from '../../lib/useSession.js'
import {
  LIMITES_APP,
  lienTestAttendu,
  nettoyerFonctionnalites,
  normaliserLienTest,
  validerChoix,
  validerComptePlay,
  validerFonctionnalites,
  validerIdentifiants,
  validerLienTest,
  validerNomApp,
  validerPackage,
  validerTexteApp,
} from '../../lib/validation.js'

const PANNEAU = (
  <PanneauEtapes
    titre="De votre app à 12 testeurs"
    etapes={[
      { titre: 'Brouillon enregistré', detail: 'Vous pouvez le corriger tant que l’offre n’est pas payée.' },
      { titre: 'Paiement de l’offre', detail: 'Par carte ou par Mobile Money en FCFA.' },
      { titre: 'Vérification par l’équipe', detail: 'Lien du test fermé, instructions, compte de test.' },
      { titre: 'Lancement de la campagne', detail: '12 testeurs pendant 14 jours, suivis chaque jour.' },
    ]}
  />
)

const COMPTES = [
  { valeur: 'personnel_recent', libelle: 'Compte personnel créé après le 13 novembre 2023', detail: 'Google exige 12 testeurs pendant 14 jours avant la production.' },
  { valeur: 'personnel_ancien', libelle: 'Compte personnel créé avant le 13 novembre 2023' },
  { valeur: 'organisation', libelle: 'Compte d’organisation (entreprise)' },
]
const OUI_NON = [
  { valeur: 'oui', libelle: 'Oui, il faut un compte pour utiliser l’app' },
  { valeur: 'non', libelle: 'Non' },
]

const VIDE = {
  nom: '',
  package: '',
  lienTestFerme: '',
  description: '',
  instructions: '',
  fonctionnalites: ['', '', ''],
  connexionRequise: '',
  identifiantsTest: '',
  comptePlay: '',
}
const VALIDATEURS = {
  nom: validerNomApp,
  package: validerPackage,
  lienTestFerme: validerLienTest,
  description: validerTexteApp,
  instructions: validerTexteApp,
  fonctionnalites: validerFonctionnalites,
  connexionRequise: validerChoix,
  identifiantsTest: validerIdentifiants,
  comptePlay: validerComptePlay,
}

function versFormulaire(app) {
  const liste = [...app.fonctionnalites]
  while (liste.length < LIMITES_APP.fonctionnalitesMin) liste.push('')
  return {
    nom: app.nom,
    package: app.package,
    lienTestFerme: app.lienTestFerme,
    description: app.description,
    instructions: app.instructions,
    fonctionnalites: liste,
    connexionRequise: app.connexionRequise ? 'oui' : 'non',
    identifiantsTest: app.identifiantsTest ?? '',
    comptePlay: app.comptePlay,
  }
}

function versApi(v) {
  const connexionRequise = v.connexionRequise === 'oui'
  return {
    nom: v.nom.trim(),
    package: v.package.trim(),
    lienTestFerme: normaliserLienTest(v.lienTestFerme),
    description: v.description.trim(),
    instructions: v.instructions.trim(),
    fonctionnalites: nettoyerFonctionnalites(v.fonctionnalites),
    connexionRequise,
    identifiantsTest: connexionRequise ? v.identifiantsTest.trim() : null,
    comptePlay: v.comptePlay,
  }
}

// Liste des fonctionnalités clés : 3 lignes au départ, jusqu'à 10.
function Fonctionnalites({ id, valeur, erreur, onChange, onBlur }) {
  const idErreur = `${id}-erreur`
  const modifier = (i, texte) => onChange(valeur.map((v, j) => (j === i ? texte : v)))
  return (
    <fieldset aria-describedby={`${id}-aide${erreur ? ` ${idErreur}` : ''}`}>
      <legend className="block text-[13px] font-medium text-texte">Fonctionnalités clés à tester</legend>
      <p id={`${id}-aide`} className="mt-0.5 text-sm text-discret">
        De {LIMITES_APP.fonctionnalitesMin} à {LIMITES_APP.fonctionnalitesMax}. Les testeurs les cochent dans leur rapport de chaque jour.
      </p>
      <ol className="mt-1.5 space-y-2">
        {valeur.map((texte, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="w-5 shrink-0 text-right text-sm text-discret tabular-nums" aria-hidden="true">
              {i + 1}.
            </span>
            <input
              id={i === 0 ? id : `${id}-${i}`}
              type="text"
              value={texte}
              maxLength={LIMITES_APP.fonctionnaliteMax + 20}
              aria-label={`Fonctionnalité ${i + 1}`}
              aria-invalid={erreur ? true : undefined}
              placeholder={i === 0 ? 'Exemple : créer un compte' : undefined}
              onChange={(e) => modifier(i, e.target.value)}
              onBlur={onBlur}
              className={`block h-11 w-full min-w-0 rounded-champ border bg-white px-[13px] text-[15px] text-encre placeholder:text-discret focus-visible:border-accent focus-visible:outline-1 focus-visible:outline-offset-0 focus-visible:outline-accent ${
                erreur ? 'border-erreur' : 'border-trait hover:border-discret'
              }`}
            />
            {valeur.length > LIMITES_APP.fonctionnalitesMin && (
              <button
                type="button"
                onClick={() => onChange(valeur.filter((_, j) => j !== i))}
                aria-label={`Retirer la fonctionnalité ${i + 1}`}
                className="h-11 shrink-0 rounded-champ px-2 text-sm font-medium text-texte hover:bg-fond-doux"
              >
                Retirer
              </button>
            )}
          </li>
        ))}
      </ol>
      {valeur.length < LIMITES_APP.fonctionnalitesMax && (
        <button
          type="button"
          onClick={() => onChange([...valeur, ''])}
          className="mt-2 text-sm font-semibold text-accent underline-offset-2 hover:underline"
        >
          Ajouter une fonctionnalité
        </button>
      )}
      {erreur && (
        <p id={idErreur} className="mt-1.5 text-sm text-erreur">
          {messageChamp('fonctionnalites', erreur)}
        </p>
      )}
    </fieldset>
  )
}

function Section({ titre, children }) {
  return (
    <section className="space-y-5 border-t border-trait pt-6 first:border-t-0 first:pt-0">
      <h2 className="text-lg font-semibold text-encre">{titre}</h2>
      {children}
    </section>
  )
}

// Suppression d'un brouillon, confirmée dans la page (pas de fenêtre du navigateur).
function SuppressionBrouillon({ app, onSupprime }) {
  const [confirmation, setConfirmation] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState(null)

  async function supprimer() {
    setEnCours(true)
    setErreur(null)
    try {
      await supprimerApp(app.id)
      onSupprime()
    } catch (err) {
      setErreur(messageErreurGlobale(err))
      setEnCours(false)
    }
  }

  return (
    <section aria-labelledby="titre-suppression" className="mt-10 border-t border-trait pt-6">
      <h2 id="titre-suppression" className="text-base font-semibold text-encre">
        Supprimer ce brouillon
      </h2>
      {erreur && (
        <Alerte ton="erreur" className="mt-3">
          {erreur}
        </Alerte>
      )}
      {confirmation ? (
        <div className="mt-3 rounded-carte border border-erreur bg-white p-4">
          <p className="text-sm text-encre">« {app.nom} » sera supprimée définitivement.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Bouton type="button" variante="danger" chargement={enCours} libelleChargement="Suppression…" onClick={supprimer}>
              Supprimer définitivement
            </Bouton>
            <Bouton type="button" variante="secondaire" disabled={enCours} onClick={() => setConfirmation(false)}>
              Annuler
            </Bouton>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-1 text-sm text-texte">Possible tant que l’offre n’est pas payée.</p>
          <Bouton type="button" variante="secondaire" className="mt-3" onClick={() => setConfirmation(true)}>
            Supprimer ce brouillon
          </Bouton>
        </>
      )}
    </section>
  )
}

function Formulaire({ app }) {
  const navigate = useNavigate()
  const formulaire = useFormulaire(app ? versFormulaire(app) : VIDE, VALIDATEURS)
  const { valeurs, lier } = formulaire
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)
  const alerte = useRef(null)
  const attendu = lienTestAttendu(valeurs.package)

  useEffect(() => {
    if (erreur) alerte.current?.focus()
  }, [erreur])

  async function soumettre(e) {
    e.preventDefault()
    setErreur(null)
    if (!formulaire.validerTout()) return
    setEnvoi(true)
    try {
      const corps = versApi(valeurs)
      const { app: enregistree } = app ? await modifierApp(app.id, corps) : await soumettreApp(corps)
      navigate('/mon-compte', { state: { appEnregistree: enregistree.nom, modification: Boolean(app) } })
    } catch (err) {
      setEnvoi(false)
      if (err instanceof ErreurApi && err.champs) return formulaire.appliquerErreursServeur(err.champs)
      if (err instanceof ErreurApi && err.code === 'compte_non_valide') return setErreur('Votre compte doit être validé par l’équipe avant de soumettre une app.')
      if (err instanceof ErreurApi && err.code === 'statut_incompatible') return setErreur('Cette app n’est plus en brouillon : elle ne peut plus être modifiée ici.')
      if (err instanceof ErreurApi && err.statut === 404) return setErreur('Cette app n’existe plus. Elle a peut-être été supprimée.')
      setErreur(messageErreurGlobale(err))
    }
  }

  return (
    <>
      {erreur && (
        <Alerte ton="erreur" className="mb-6" ref={alerte}>
          {erreur}
        </Alerte>
      )}
      <form onSubmit={soumettre} noValidate className="space-y-8">
        <Section titre="Votre app">
          <Champ {...lier('nom')} nom="nomApp" libelle="Nom de l’app" max={LIMITES_APP.nomMax} autoComplete="off" />
          <Champ
            {...lier('package')}
            libelle="Nom du package"
            aide="L’identifiant de l’app dans la Play Console, par exemple com.exemple.app."
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            inputMode="url"
          />
          <ChampTexte
            {...lier('description')}
            libelle="Description"
            aide="À quoi sert l’app, en quelques phrases. Les testeurs la lisent avant d’accepter la campagne."
            max={LIMITES_APP.texteMax}
            lignes={4}
          />
        </Section>

        <Section titre="Test fermé Google Play">
          <Champ
            {...lier('lienTestFerme')}
            libelle="Lien d’inscription au test fermé"
            aide={
              attendu
                ? `Dans la Play Console : Tests fermés, puis « Rejoindre sur le Web ». Pour votre package : ${attendu}`
                : 'Dans la Play Console : Tests fermés, puis « Rejoindre sur le Web ». Il commence par https://play.google.com/apps/testing/.'
            }
            type="url"
            autoComplete="off"
            spellCheck={false}
            max={LIMITES_APP.lienMax}
          />
          <ChoixRadio
            {...lier('comptePlay')}
            libelle="Votre compte développeur Google Play"
            options={COMPTES}
          />
          {valeurs.comptePlay && valeurs.comptePlay !== 'personnel_recent' && (
            <Alerte ton="info" titre="Le test de 14 jours n’est pas obligatoire pour vous">
              Google ne l’impose qu’aux comptes personnels créés après le 13 novembre 2023. Une campagne Nakayo reste utile pour trouver
              des bugs sur de vrais téléphones avant la sortie.
            </Alerte>
          )}
        </Section>

        <Section titre="Ce que font les testeurs">
          <ChampTexte
            {...lier('instructions')}
            libelle="Instructions de test"
            aide="Ce que chaque testeur doit faire chaque jour, étape par étape."
            max={LIMITES_APP.texteMax}
            lignes={5}
          />
          <Fonctionnalites {...lier('fonctionnalites')} />
          <ChoixRadio
            {...lier('connexionRequise')}
            libelle="L’app demande-t-elle une connexion ?"
            aide="Google refuse l’accès à la production si les testeurs n’ont pas pu se connecter."
            options={OUI_NON}
          />
          {valeurs.connexionRequise === 'oui' && (
            <ChampTexte
              {...lier('identifiantsTest')}
              libelle="Identifiants de test"
              aide="Un compte réservé aux testeurs, jamais votre compte personnel. Seuls l’équipe et les testeurs de la campagne le voient."
              max={LIMITES_APP.identifiantsMax}
              lignes={3}
              spellCheck={false}
            />
          )}
        </Section>

        <div className="flex flex-col gap-3 sm:flex-row-reverse sm:justify-start">
          <Bouton chargement={envoi} libelleChargement="Enregistrement…" className="sm:min-w-56">
            {app ? 'Enregistrer les modifications' : 'Enregistrer le brouillon'}
          </Bouton>
          <Link
            to="/mon-compte"
            className="inline-flex h-11 items-center justify-center rounded-champ border border-trait bg-white px-[18px] text-[15px] font-semibold text-encre hover:bg-fond-doux"
          >
            Annuler
          </Link>
        </div>
      </form>
      {app && <SuppressionBrouillon app={app} onSupprime={() => navigate('/mon-compte', { state: { appSupprimee: app.nom } })} />}
    </>
  )
}

function Chargement({ titre }) {
  return (
    <PageCompte titre={titre} panneau={PANNEAU}>
      <p role="status" className="flex items-center gap-3 text-texte">
        <Indicateur className="size-5 text-accent" />
        Chargement…
      </p>
    </PageCompte>
  )
}

// Modification : charge l'app, puis affiche le même formulaire pré-rempli.
function ModificationApp({ id, utilisateur }) {
  const titre = 'Modifier votre app'
  const [etat, setEtat] = useState({ cle: null, app: null, erreur: null })
  const [essai, setEssai] = useState(0)
  const cle = `${id}:${essai}`

  useEffect(() => {
    const controleur = new AbortController()
    lireApp(id, { signal: controleur.signal })
      .then(({ app }) => setEtat({ cle, app, erreur: null }))
      .catch((erreur) => {
        if (!controleur.signal.aborted) setEtat({ cle, app: null, erreur })
      })
    return () => controleur.abort()
  }, [id, cle])

  if (etat.cle !== cle) return <Chargement titre={titre} />
  if (etat.erreur) {
    const absente = etat.erreur instanceof ErreurApi && etat.erreur.statut === 404
    return (
      <PageCompte titre={titre} utilisateur={utilisateur} panneau={PANNEAU}>
        <Alerte ton="erreur">{absente ? 'Cette app est introuvable. Elle a peut-être été supprimée.' : messageErreurGlobale(etat.erreur)}</Alerte>
        {!absente && (
          <Bouton type="button" variante="secondaire" className="mt-4" onClick={() => setEssai((n) => n + 1)}>
            Réessayer
          </Bouton>
        )}
        <RetourCompte />
      </PageCompte>
    )
  }
  if (etat.app.statut !== 'brouillon') {
    return (
      <PageCompte titre={etat.app.nom} utilisateur={utilisateur} panneau={PANNEAU}>
        <Alerte ton="info">Cette app n’est plus en brouillon : elle ne peut plus être modifiée.</Alerte>
        <RetourCompte />
      </PageCompte>
    )
  }
  return (
    <PageCompte titre={titre} utilisateur={utilisateur} panneau={PANNEAU}>
      <Formulaire app={etat.app} />
    </PageCompte>
  )
}

function RetourCompte() {
  return (
    <p className="mt-8 text-texte">
      <Link to="/mon-compte" className="font-medium text-accent underline underline-offset-2">
        Retour à mon compte
      </Link>
    </p>
  )
}

// /mon-compte/apps/nouvelle et /mon-compte/apps/:id/modifier (US-11).
export default function FormulaireApp() {
  const { id } = useParams()
  const session = useSession()
  const titre = id ? 'Modifier votre app' : 'Soumettre votre app'

  if (session.etat === 'chargement') return <Chargement titre={titre} />
  if (session.etat === 'erreur') {
    return (
      <PageCompte titre={titre} panneau={PANNEAU}>
        <Alerte ton="erreur">{messageErreurGlobale(session.erreur)}</Alerte>
        <Bouton type="button" className="mt-6 w-full" onClick={session.recharger}>
          Réessayer
        </Bouton>
      </PageCompte>
    )
  }
  if (session.etat === 'deconnecte') {
    const suite = encodeURIComponent(id ? `/mon-compte/apps/${id}/modifier` : '/mon-compte/apps/nouvelle')
    return (
      <PageCompte titre={titre} panneau={PANNEAU}>
        <p className="text-texte">
          <Link to={`/connexion?suite=${suite}`} className="font-medium text-accent underline underline-offset-2">
            Connectez-vous
          </Link>{' '}
          pour soumettre votre app.
        </p>
      </PageCompte>
    )
  }
  const { utilisateur } = session
  if (utilisateur.role !== 'developpeur') {
    return (
      <PageCompte titre={titre} utilisateur={utilisateur} panneau={PANNEAU}>
        <p className="text-texte">Cette page est réservée aux comptes développeur.</p>
      </PageCompte>
    )
  }
  if (utilisateur.statut !== 'valide') {
    return (
      <PageCompte titre={titre} utilisateur={utilisateur} panneau={PANNEAU}>
        <Alerte ton="alerte">Votre compte doit être validé par l’équipe avant de soumettre une app.</Alerte>
        <RetourCompte />
      </PageCompte>
    )
  }
  if (id) return <ModificationApp id={id} utilisateur={utilisateur} />
  return (
    <PageCompte
      titre={titre}
      utilisateur={utilisateur}
      panneau={PANNEAU}
      intro={<p>Tout ce dont les testeurs ont besoin. L’app reste en brouillon tant que l’offre n’est pas payée : vous pourrez la corriger.</p>}
    >
      <Formulaire />
    </PageCompte>
  )
}
