import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { deciderBug, listerBugs, telechargerBugsCsv } from '../../api/apps.js'
import { ErreurApi } from '../../api/client.js'
import { Alerte } from '../../components/Alerte.jsx'
import { Bouton, Indicateur } from '../../components/Bouton.jsx'
import { PageCompte, PanneauEtapes } from '../../components/MiseEnPage.jsx'
import { dateCourte, telechargerTexte } from '../../lib/campagnes.js'
import { messageErreurGlobale } from '../../lib/messages.js'
import { useSession } from '../../lib/useSession.js'

const TITRE = 'Bugs signalés'
const MOTIF_MIN = 5
const MOTIF_MAX = 500

const PANNEAU = (
  <PanneauEtapes
    titre="Des bugs reproductibles"
    etapes={[
      { titre: 'Les testeurs signalent', detail: 'Étapes, résultat attendu et obtenu, gravité et jusqu’à 5 captures.' },
      { titre: 'Vous examinez', detail: 'Acceptez les vrais bugs, refusez les autres avec un motif.' },
      { titre: 'Vous exportez', detail: 'Le fichier CSV s’ouvre dans un tableur ou s’importe dans votre outil de suivi.' },
    ]}
  />
)

const GRAVITES = {
  bloquante: ['Bloquante', 'bg-erreur-clair text-erreur'],
  genante: ['Gênante', 'bg-ocre-clair text-alerte'],
  mineure: ['Mineure', 'bg-fond-doux text-encre'],
}
const STATUTS = {
  nouveau: ['À examiner', 'bg-indigo-clair text-[#1F3457]'],
  accepte: ['Accepté', 'bg-succes-clair text-succes'],
  refuse: ['Refusé', 'bg-fond-doux text-texte'],
}
const FILTRES_GRAVITE = [
  { id: 'toutes', libelle: 'Toutes' },
  { id: 'bloquante', libelle: 'Bloquantes' },
  { id: 'genante', libelle: 'Gênantes' },
  { id: 'mineure', libelle: 'Mineures' },
]

function Pastille({ valeurs, code }) {
  const [libelle, couleurs] = valeurs[code] ?? [code, 'bg-fond-doux text-encre']
  return <span className={`rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${couleurs}`}>{libelle}</span>
}

function Bloc({ titre, children }) {
  return (
    <div>
      <p className="text-[13px] font-medium text-texte">{titre}</p>
      <p className="mt-0.5 whitespace-pre-line [overflow-wrap:anywhere] text-encre">{children}</p>
    </div>
  )
}

// Accepter, ou refuser avec un motif que le testeur verra.
function Decision({ appId, bug, surDecide }) {
  const [refus, setRefus] = useState(false)
  const [motif, setMotif] = useState('')
  const [envoi, setEnvoi] = useState(null)
  const [erreur, setErreur] = useState(null)
  const champ = useRef(null)

  useEffect(() => {
    if (refus) champ.current?.focus()
  }, [refus])

  async function decider(decision) {
    setErreur(null)
    if (decision === 'refuse') {
      const t = motif.trim()
      if (t.length < MOTIF_MIN) return setErreur(`Expliquez le refus au testeur (${MOTIF_MIN} caractères au moins).`)
      if (t.length > MOTIF_MAX) return setErreur(`${MOTIF_MAX} caractères au plus.`)
    }
    setEnvoi(decision)
    try {
      const r = await deciderBug(appId, bug.id, { decision, motif: decision === 'refuse' ? motif.trim() : undefined })
      surDecide(r.bug)
    } catch (err) {
      setEnvoi(null)
      if (err instanceof ErreurApi && err.code === 'deja_decide') return setErreur('Ce bug a déjà été examiné. Rechargez la page.')
      if (err instanceof ErreurApi && err.code === 'campagne_terminee') return setErreur('La campagne est terminée : ce bug ne peut plus être examiné.')
      setErreur(messageErreurGlobale(err))
    }
  }

  const idMotif = `motif-${bug.id}`
  return (
    <div className="mt-4 border-t border-trait pt-4">
      {refus ? (
        <div>
          <label htmlFor={idMotif} className="block text-[13px] font-medium text-texte">
            Motif du refus, vu par le testeur
          </label>
          <textarea
            id={idMotif}
            ref={champ}
            rows={3}
            value={motif}
            maxLength={MOTIF_MAX + 50}
            onChange={(e) => setMotif(e.target.value)}
            aria-invalid={Boolean(erreur) || undefined}
            aria-describedby={erreur ? `${idMotif}-erreur` : undefined}
            className="mt-1.5 block w-full rounded-champ border border-trait bg-white px-3.5 py-2.5 text-[15px] text-encre focus:border-accent focus:outline-none"
            placeholder="Par exemple : c’est le comportement voulu, l’article sort du panier après 24 h."
          />
          <div className="mt-3 flex flex-wrap gap-3">
            <Bouton type="button" chargement={envoi === 'refuse'} libelleChargement="Envoi…" onClick={() => decider('refuse')}>
              Confirmer le refus
            </Bouton>
            <Bouton type="button" variante="secondaire" onClick={() => setRefus(false)} disabled={Boolean(envoi)}>
              Annuler
            </Bouton>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Bouton type="button" chargement={envoi === 'accepte'} libelleChargement="Envoi…" onClick={() => decider('accepte')} aria-label={`Accepter le bug « ${bug.titre} »`}>
            Accepter
          </Bouton>
          <Bouton type="button" variante="secondaire" onClick={() => setRefus(true)} disabled={Boolean(envoi)} aria-label={`Refuser le bug « ${bug.titre} »`}>
            Refuser
          </Bouton>
          <p className="text-sm text-discret">Un bug accepté rapporte 200 FCFA au testeur.</p>
        </div>
      )}
      {erreur && (
        <p id={`${idMotif}-erreur`} role="alert" className="mt-2 text-sm text-erreur">
          {erreur}
        </p>
      )}
    </div>
  )
}

function CarteBug({ appId, bug, surDecide }) {
  const testeur = bug.testeur.numero == null ? 'Testeur remplacé' : `Testeur ${bug.testeur.numero}`
  const appareil = [bug.testeur.modele, bug.testeur.versionAndroid && `Android ${bug.testeur.versionAndroid}`].filter(Boolean).join(', ')
  return (
    <li className="rounded-carte border border-trait bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold [overflow-wrap:anywhere] text-encre">{bug.titre}</h3>
        <div className="flex flex-wrap gap-1.5">
          <Pastille valeurs={GRAVITES} code={bug.gravite} />
          <Pastille valeurs={STATUTS} code={bug.statut} />
        </div>
      </div>
      <p className="mt-1 text-sm text-discret">
        {testeur}
        {appareil && ` · ${appareil}`} · version {bug.versionApp} · {dateCourte(bug.signaleLe)}
      </p>
      <div className="mt-3 space-y-3 text-sm">
        <Bloc titre="Étapes pour le reproduire">{bug.etapes}</Bloc>
        <Bloc titre="Résultat attendu">{bug.resultatAttendu}</Bloc>
        <Bloc titre="Résultat obtenu">{bug.resultatObtenu}</Bloc>
      </div>
      {bug.captures.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Captures d’écran">
          {bug.captures.map((url, i) => (
            <li key={url}>
              <a href={url} target="_blank" rel="noreferrer" className="block rounded-md focus-visible:outline-2 focus-visible:outline-accent">
                <img src={url} alt={`Capture ${i + 1} du bug « ${bug.titre} »`} loading="lazy" className="h-28 w-auto rounded-md border border-trait object-cover" />
              </a>
            </li>
          ))}
        </ul>
      )}
      {bug.statut === 'refuse' && bug.motifRefus && (
        <p className="mt-3 text-sm text-texte">
          <span className="font-semibold text-encre">Motif du refus :</span> <span className="[overflow-wrap:anywhere]">{bug.motifRefus}</span>
        </p>
      )}
      {bug.decidable && <Decision appId={appId} bug={bug} surDecide={surDecide} />}
    </li>
  )
}

function BoutonExport({ appId, nomFichier }) {
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState(null)
  async function exporter() {
    setEnCours(true)
    setErreur(null)
    try {
      telechargerTexte(await telechargerBugsCsv(appId), nomFichier)
    } catch (err) {
      setErreur(messageErreurGlobale(err))
    } finally {
      setEnCours(false)
    }
  }
  return (
    <div>
      <Bouton type="button" variante="secondaire" chargement={enCours} libelleChargement="Export…" onClick={exporter}>
        Exporter en CSV
      </Bouton>
      {erreur && (
        <p role="alert" className="mt-1.5 text-sm text-erreur">
          {erreur}
        </p>
      )}
    </div>
  )
}

const compter = (bugs) => ({
  total: bugs.length,
  nouveaux: bugs.filter((b) => b.statut === 'nouveau').length,
  acceptes: bugs.filter((b) => b.statut === 'accepte').length,
  refuses: bugs.filter((b) => b.statut === 'refuse').length,
})

function Liste({ id, utilisateur }) {
  const [essai, setEssai] = useState(0)
  const [etat, setEtat] = useState({ cle: null, donnees: null, erreur: null })
  const [filtre, setFiltre] = useState('toutes')
  const [aExaminer, setAExaminer] = useState(false)
  const cle = `${id}:${essai}`

  useEffect(() => {
    const controleur = new AbortController()
    listerBugs(id, { signal: controleur.signal })
      .then((donnees) => setEtat({ cle, donnees, erreur: null }))
      .catch((erreur) => {
        if (!controleur.signal.aborted) setEtat({ cle, donnees: null, erreur })
      })
    return () => controleur.abort()
  }, [id, cle])

  const page = (contenu) => (
    <PageCompte titre={TITRE} utilisateur={utilisateur} panneau={PANNEAU}>
      {contenu}
      <p className="mt-8 text-texte">
        <Link to={`/mon-compte/apps/${id}/campagne`} className="font-medium text-accent underline underline-offset-2">
          Retour au suivi de la campagne
        </Link>
      </p>
    </PageCompte>
  )

  if (etat.cle !== cle) {
    return page(
      <p role="status" className="flex items-center gap-3 text-texte">
        <Indicateur className="size-5 text-accent" />
        Chargement des bugs…
      </p>,
    )
  }
  if (etat.erreur) {
    const absente = etat.erreur instanceof ErreurApi && etat.erreur.statut === 404
    return page(
      <>
        <Alerte ton="erreur">{absente ? 'Cette app est introuvable.' : messageErreurGlobale(etat.erreur)}</Alerte>
        {!absente && (
          <Bouton type="button" variante="secondaire" className="mt-4" onClick={() => setEssai((n) => n + 1)}>
            Réessayer
          </Bouton>
        )}
      </>,
    )
  }

  const { bugs, rapportsDeBugs } = etat.donnees
  const resume = compter(bugs)
  const remplacer = (bug) =>
    setEtat((e) => ({ ...e, donnees: { ...e.donnees, bugs: e.donnees.bugs.map((b) => (b.id === bug.id ? bug : b)) } }))

  if (!bugs.length) {
    return page(
      rapportsDeBugs ? (
        <p className="text-texte">Aucun bug signalé pour l’instant. Les testeurs peuvent en envoyer à tout moment de la campagne.</p>
      ) : (
        <>
          <Alerte ton="info">Les rapports de bugs avec captures font partie de l’Offre Pro.</Alerte>
          <p className="mt-4">
            <Link to={`/mon-compte/apps/${id}/montee-en-gamme`} className="font-medium text-accent underline underline-offset-2">
              Passer à l’Offre Pro
            </Link>
          </p>
        </>
      ),
    )
  }

  const visibles = bugs.filter((b) => (filtre === 'toutes' || b.gravite === filtre) && (!aExaminer || b.statut === 'nouveau'))
  return page(
    <>
      <p className="text-texte" aria-live="polite">
        {resume.total} {resume.total > 1 ? 'bugs signalés' : 'bug signalé'} : {resume.nouveaux} à examiner, {resume.acceptes}{' '}
        {resume.acceptes > 1 ? 'acceptés' : 'accepté'}, {resume.refuses} {resume.refuses > 1 ? 'refusés' : 'refusé'}.
      </p>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par gravité">
          {FILTRES_GRAVITE.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filtre === f.id}
              onClick={() => setFiltre(f.id)}
              className={`rounded-champ border px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                filtre === f.id ? 'border-accent bg-accent-clair text-accent' : 'border-trait bg-white text-texte hover:border-discret'
              }`}
            >
              {f.libelle}
            </button>
          ))}
        </div>
        <BoutonExport appId={id} nomFichier={`bugs-${id}.csv`} />
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm text-texte">
        <input type="checkbox" checked={aExaminer} onChange={(e) => setAExaminer(e.target.checked)} className="size-4 accent-accent" />
        Seulement les bugs à examiner
      </label>
      {visibles.length ? (
        <ul className="mt-4 space-y-3">
          {visibles.map((b) => (
            <CarteBug key={b.id} appId={id} bug={b} surDecide={remplacer} />
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-texte">Aucun bug ne correspond à ces filtres.</p>
      )}
    </>,
  )
}

// /mon-compte/apps/:id/bugs (US-34) : bugs signalés, décision et export.
export default function BugsSignales() {
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
          <Link to={`/connexion?suite=${encodeURIComponent(`/mon-compte/apps/${id}/bugs`)}`} className="font-medium text-accent underline underline-offset-2">
            Connectez-vous
          </Link>{' '}
          pour voir les bugs signalés.
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
  return <Liste id={id} utilisateur={session.utilisateur} />
}
