import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { demarrerCampagne, enregistrerPreparation, lireApp, lirePreparation } from '../../api/apps.js'
import { ErreurApi } from '../../api/client.js'
import { Alerte } from '../../components/Alerte.jsx'
import { Bouton, Indicateur } from '../../components/Bouton.jsx'
import { AdresseGroupe } from '../../components/Copier.jsx'
import { PageCompte, PanneauEtapes } from '../../components/MiseEnPage.jsx'
import { messageErreurGlobale } from '../../lib/messages.js'
import { useSession } from '../../lib/useSession.js'

const TITRE = 'Préparer le lancement'

const PANNEAU = (
  <PanneauEtapes
    titre="14 jours de test, sans les perdre"
    etapes={[
      { titre: 'Des testeurs qui comptent', detail: 'Google ne compte que les testeurs du test fermé, inscrits par le lien.' },
      { titre: 'Une app qui s’installe', detail: 'Version publiée, pays cochés, fiche complète.' },
      { titre: 'Une app qui évolue', detail: 'Google attend des mises à jour faites à partir des retours.' },
    ]}
  />
)

// Libellés des points de la liste (codes du contrat, docs/api-sprint2.md §5).
const POINTS = {
  testeurs_ajoutes: {
    titre: 'Le groupe des testeurs Nakayo est ajouté à votre test fermé',
    detail: 'Play Console : Tests, puis Test fermé, onglet Testeurs. Ajoutez le groupe Google ci-dessous, puis enregistrez.',
  },
  fiche_complete: {
    titre: 'La fiche Play Store est complète',
    detail: 'Fiche principale, classification du contenu, section « Sécurité des données » et lien vers votre politique de confidentialité.',
  },
  version_publiee: {
    titre: 'Une version est publiée sur le test fermé',
    detail: 'Son statut doit être « Publié », et le lien d’inscription doit s’ouvrir dans un navigateur.',
  },
  pays_coches: {
    titre: 'Le Bénin est coché dans les pays du test fermé',
    detail: 'Test fermé, onglet Pays/régions. Sans cela, les testeurs ne peuvent pas installer l’app.',
  },
  pas_de_test_interne: {
    titre: 'Les testeurs ne sont pas aussi inscrits au test interne',
    detail: 'Un testeur inscrit aux deux canaux reçoit la version interne et ne compte pas pour le test fermé.',
  },
  mises_a_jour_prevues: {
    titre: 'Vous prévoyez au moins 2 nouvelles versions pendant les 14 jours',
    detail: 'Corrigez ce que remontent les testeurs et décrivez-le dans les notes de version : Google vérifie que l’app a évolué.',
  },
}

function GroupeTesteurs({ adresse }) {
  if (!adresse) {
    return <p className="mt-2 text-sm text-texte">L’équipe vous envoie l’adresse du groupe par email après la vérification de votre app.</p>
  }
  return <AdresseGroupe adresse={adresse} />
}

// US-13 : une fois l'app validée et la liste complète, le développeur démarre la campagne.
function DemarrageCampagne({ app }) {
  const naviguer = useNavigate()
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)
  const suivi = `/mon-compte/apps/${app.id}/campagne`

  async function demarrer() {
    setEnvoi(true)
    setErreur(null)
    try {
      await demarrerCampagne(app.id)
      naviguer(suivi, { state: { demarree: true } })
    } catch (err) {
      setEnvoi(false)
      if (err instanceof ErreurApi && err.code === 'campagne_existante') return naviguer(suivi)
      if (err instanceof ErreurApi && err.code === 'testeurs_insuffisants') {
        return setErreur('Pas assez de testeurs disponibles pour le moment. Notre équipe est prévenue et revient vers vous par email.')
      }
      if (err instanceof ErreurApi && err.code === 'preparation_incomplete') return setErreur('Cochez et enregistrez tous les points avant de démarrer.')
      setErreur(messageErreurGlobale(err))
    }
  }

  return (
    <section aria-labelledby="demarrage" className="mt-8 rounded-carte border border-accent bg-white p-5">
      <h2 id="demarrage" className="text-lg font-semibold text-encre">
        Démarrer la campagne
      </h2>
      <p className="mt-2 text-sm text-texte">
        En démarrant, vous confirmez que le groupe des testeurs est ajouté à votre test fermé. 15 testeurs sont affectés à votre app et prévenus
        aussitôt. La campagne dure 16 jours, dont 14 exigés par Google.
      </p>
      {erreur && (
        <Alerte ton="erreur" className="mt-4">
          {erreur}
        </Alerte>
      )}
      <Bouton type="button" className="mt-4 w-full sm:w-auto" chargement={envoi} libelleChargement="Démarrage…" onClick={demarrer}>
        Démarrer la campagne
      </Bouton>
    </section>
  )
}

function Liste({ app, donnees }) {
  const [coches, setCoches] = useState(() => new Set(donnees.preparation.elements))
  const [etat, setEtat] = useState({ preparation: donnees.preparation, envoi: false, erreur: null, enregistre: false })
  const annonce = useRef(null)
  const total = donnees.elements.length
  const modifie = coches.size !== etat.preparation.elements.length || etat.preparation.elements.some((e) => !coches.has(e))

  useEffect(() => {
    if (etat.enregistre || etat.erreur) annonce.current?.focus()
  }, [etat.enregistre, etat.erreur])

  function basculer(code) {
    setCoches((avant) => {
      const suivant = new Set(avant)
      if (suivant.has(code)) suivant.delete(code)
      else suivant.add(code)
      return suivant
    })
    setEtat((e) => ({ ...e, enregistre: false, erreur: null }))
  }

  async function enregistrer(e) {
    e.preventDefault()
    setEtat((s) => ({ ...s, envoi: true, erreur: null, enregistre: false }))
    try {
      const { app: aJour } = await enregistrerPreparation(app.id, donnees.elements.filter((c) => coches.has(c)))
      setEtat({ preparation: aJour.preparation, envoi: false, erreur: null, enregistre: true })
    } catch (err) {
      const message =
        err instanceof ErreurApi && err.code === 'statut_incompatible'
          ? 'Cette app ne peut plus être préparée : elle a peut-être été refusée par l’équipe.'
          : messageErreurGlobale(err)
      setEtat((s) => ({ ...s, envoi: false, erreur: message }))
    }
  }

  return (
    <form onSubmit={enregistrer} noValidate>
      <p className="text-sm font-semibold text-encre" aria-live="polite">
        {coches.size} sur {total} points vérifiés
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-fond-doux" aria-hidden="true">
        <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${(coches.size / total) * 100}%` }} />
      </div>

      <fieldset className="mt-6">
        <legend className="sr-only">Points à vérifier avant le lancement</legend>
        <ul className="space-y-3">
          {donnees.elements.map((code) => {
            const point = POINTS[code] ?? { titre: code, detail: '' }
            const id = `point-${code}`
            return (
              <li key={code} className={`rounded-carte border bg-white p-4 ${coches.has(code) ? 'border-accent' : 'border-trait'}`}>
                <div className="flex items-start gap-3">
                  <input
                    id={id}
                    type="checkbox"
                    checked={coches.has(code)}
                    onChange={() => basculer(code)}
                    aria-describedby={`${id}-detail`}
                    className="mt-0.5 size-5 shrink-0 rounded-[5px] accent-accent"
                  />
                  <div className="min-w-0">
                    <label htmlFor={id} className="font-semibold text-encre">
                      {point.titre}
                    </label>
                    <p id={`${id}-detail`} className="mt-0.5 text-sm text-texte">
                      {point.detail}
                    </p>
                    {code === 'testeurs_ajoutes' && <GroupeTesteurs adresse={donnees.groupeTesteurs} />}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </fieldset>

      <div className="mt-6" tabIndex={-1} ref={annonce}>
        {etat.erreur && <Alerte ton="erreur">{etat.erreur}</Alerte>}
        {etat.enregistre &&
          (etat.preparation.complete ? (
            <Alerte ton="succes" titre="Tout est prêt">
              {app.statut === 'validee'
                ? 'Votre app est validée : vous pouvez démarrer la campagne ci-dessous.'
                : 'Votre liste est complète. Vous pourrez démarrer la campagne une fois l’app validée par l’équipe.'}
            </Alerte>
          ) : (
            <Alerte ton="info">
              Enregistré. Il reste {total - etat.preparation.elements.length} point{total - etat.preparation.elements.length > 1 ? 's' : ''} à
              vérifier : la campagne ne démarre que lorsque tout est coché.
            </Alerte>
          ))}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse sm:justify-start">
        <Bouton chargement={etat.envoi} libelleChargement="Enregistrement…" disabled={!modifie && !etat.envoi} className="sm:min-w-44">
          Enregistrer
        </Bouton>
        <Link
          to="/mon-compte"
          className="inline-flex h-11 items-center justify-center rounded-champ border border-trait bg-white px-[18px] text-[15px] font-semibold whitespace-nowrap text-encre hover:bg-fond-doux"
        >
          Retour à mon compte
        </Link>
      </div>
      {app.statut === 'validee' && etat.preparation.complete && !modifie && <DemarrageCampagne app={app} />}
      {app.statut === 'en_verification' && etat.preparation.complete && !modifie && !etat.enregistre && (
        <p className="mt-6 text-sm text-texte">Vous pourrez démarrer la campagne dès que l’équipe aura validé votre app, sous 24 h ouvrées.</p>
      )}
    </form>
  )
}

function Preparation({ id, utilisateur }) {
  const [essai, setEssai] = useState(0)
  const [etat, setEtat] = useState({ cle: null, donnees: null, erreur: null })
  const cle = `${id}:${essai}`

  useEffect(() => {
    const controleur = new AbortController()
    const signal = controleur.signal
    Promise.all([lireApp(id, { signal }), lirePreparation(id, { signal })])
      .then(([{ app }, preparation]) => setEtat({ cle, donnees: { app, preparation }, erreur: null }))
      .catch((erreur) => {
        if (!signal.aborted) setEtat({ cle, donnees: null, erreur })
      })
    return () => controleur.abort()
  }, [id, cle])

  if (etat.cle !== cle) {
    return (
      <PageCompte titre={TITRE} utilisateur={utilisateur} panneau={PANNEAU}>
        <p role="status" className="flex items-center gap-3 text-texte">
          <Indicateur className="size-5 text-accent" />
          Chargement…
        </p>
      </PageCompte>
    )
  }
  if (etat.erreur) {
    const absente = etat.erreur instanceof ErreurApi && etat.erreur.statut === 404
    return (
      <PageCompte titre={TITRE} utilisateur={utilisateur} panneau={PANNEAU}>
        <Alerte ton="erreur">{absente ? 'Cette app est introuvable.' : messageErreurGlobale(etat.erreur)}</Alerte>
        {!absente && (
          <Bouton type="button" variante="secondaire" className="mt-4" onClick={() => setEssai((n) => n + 1)}>
            Réessayer
          </Bouton>
        )}
      </PageCompte>
    )
  }
  const { app, preparation } = etat.donnees
  if (!['en_verification', 'validee'].includes(app.statut)) {
    return (
      <PageCompte titre={TITRE} utilisateur={utilisateur} panneau={PANNEAU}>
        <Alerte ton="info">
          {app.statut === 'brouillon'
            ? 'La préparation commence une fois l’offre payée.'
            : 'Cette app a été refusée par l’équipe : elle ne peut pas être lancée.'}
        </Alerte>
        <p className="mt-8">
          <Link to="/mon-compte" className="font-medium text-accent underline underline-offset-2">
            Retour à mon compte
          </Link>
        </p>
      </PageCompte>
    )
  }
  if (app.campagne) {
    return (
      <PageCompte titre={TITRE} utilisateur={utilisateur} panneau={PANNEAU}>
        <Alerte ton="succes" titre="La campagne a démarré">
          La liste de vérification est complète et figée pour « <span className="[overflow-wrap:anywhere]">{app.nom}</span> ».
        </Alerte>
        <p className="mt-6">
          <Link to={`/mon-compte/apps/${app.id}/campagne`} className="font-medium text-accent underline underline-offset-2">
            Suivre la campagne
          </Link>
        </p>
      </PageCompte>
    )
  }
  return (
    <PageCompte
      titre={TITRE}
      utilisateur={utilisateur}
      panneau={PANNEAU}
      intro={
        <p>
          Pour « <span className="[overflow-wrap:anywhere]">{app.nom}</span> ». Ces erreurs de préparation font perdre les 14 jours de test : la
          campagne ne démarre que lorsque tout est coché.
        </p>
      }
    >
      <Liste app={app} donnees={preparation} />
    </PageCompte>
  )
}

// /mon-compte/apps/:id/preparation (US-42, US-13).
export default function PreparationLancement() {
  const { id } = useParams()
  const session = useSession()

  if (session.etat === 'chargement') {
    return (
      <PageCompte titre={TITRE} panneau={PANNEAU}>
        <p role="status" className="flex items-center gap-3 text-texte">
          <Indicateur className="size-5 text-accent" />
          Chargement…
        </p>
      </PageCompte>
    )
  }
  if (session.etat === 'erreur') {
    return (
      <PageCompte titre={TITRE} panneau={PANNEAU}>
        <Alerte ton="erreur">{messageErreurGlobale(session.erreur)}</Alerte>
        <Bouton type="button" className="mt-6 w-full" onClick={session.recharger}>
          Réessayer
        </Bouton>
      </PageCompte>
    )
  }
  if (session.etat === 'deconnecte') {
    return (
      <PageCompte titre={TITRE} panneau={PANNEAU}>
        <p className="text-texte">
          <Link to={`/connexion?suite=${encodeURIComponent(`/mon-compte/apps/${id}/preparation`)}`} className="font-medium text-accent underline underline-offset-2">
            Connectez-vous
          </Link>{' '}
          pour préparer le lancement de votre campagne.
        </p>
      </PageCompte>
    )
  }
  if (session.utilisateur.role !== 'developpeur') {
    return (
      <PageCompte titre={TITRE} utilisateur={session.utilisateur} panneau={PANNEAU}>
        <p className="text-texte">Cette page est réservée aux comptes développeur.</p>
      </PageCompte>
    )
  }
  return <Preparation id={id} utilisateur={session.utilisateur} />
}
