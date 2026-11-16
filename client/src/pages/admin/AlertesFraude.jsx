import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ErreurApi } from '../../api/client.js'
import { deciderAlerte, listerAlertes } from '../../api/admin.js'
import { Alerte } from '../../components/Alerte.jsx'
import { Bouton, Indicateur } from '../../components/Bouton.jsx'
import { PageAdmin } from '../../components/MiseEnPage.jsx'
import { dateHeure, pluriel, telephone } from '../../lib/format.js'
import { messageErreurGlobale } from '../../lib/messages.js'
import { AccesAdmin } from './AccesAdmin.jsx'

// US-28 : alertes de comportements suspects (docs/anti-fraude.md).
const TITRE = 'Alertes de fraude'
const ONGLETS = [
  { statut: 'ouverte', libelle: 'À examiner' },
  { statut: 'confirmee', libelle: 'Confirmées' },
  { statut: 'ecartee', libelle: 'Écartées' },
]
const DECISIONS = { confirmee: 'Fraude confirmée', ecartee: 'Alerte écartée' }

function CarteAlerte({ alerte, onDecidee }) {
  const [note, setNote] = useState('')
  const [enCours, setEnCours] = useState(null)
  const [erreur, setErreur] = useState(null)

  async function decider(decision) {
    setEnCours(decision)
    setErreur(null)
    try {
      const { alerte: aJour } = await deciderAlerte(alerte.id, { decision, note: note.trim() })
      onDecidee(aJour.id, decision === 'confirmee' ? 'Fraude confirmée. Suspendez le compte depuis « Comptes » si besoin.' : 'Alerte écartée.')
    } catch (err) {
      if (err instanceof ErreurApi && err.code === 'statut_incompatible') onDecidee(alerte.id, 'Cette alerte avait déjà été traitée par un autre admin.')
      else setErreur(messageErreurGlobale(err))
      setEnCours(null)
    }
  }

  return (
    <article aria-labelledby={`alerte-${alerte.id}`} className="rounded-carte border border-trait bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`alerte-${alerte.id}`} className="text-base font-semibold text-encre">
          {alerte.libelle}
        </h3>
        <p className="text-sm text-discret">{dateHeure(alerte.creeLe)}</p>
      </div>
      <p className="mt-1 text-encre">{alerte.detail}</p>
      {alerte.campagne && <p className="mt-1 text-sm text-texte">Campagne : {alerte.campagne.appNom}</p>}
      <ul className="mt-3 space-y-1 text-sm text-texte">
        {alerte.testeurs.map((t) => (
          <li key={t.id}>
            <Link to={`/admin/testeurs/${t.id}`} className="font-medium text-accent underline underline-offset-2">
              {t.nom}
            </Link>{' '}
            · {telephone(t.telephone)}
            {t.statut !== 'valide' && <span className="text-discret"> · compte {t.statut.replace('_', ' ')}</span>}
          </li>
        ))}
      </ul>
      {erreur && (
        <Alerte ton="erreur" className="mt-4">
          {erreur}
        </Alerte>
      )}
      {alerte.statut === 'ouverte' ? (
        <div className="mt-4">
          <label htmlFor={`note-${alerte.id}`} className="text-sm font-semibold text-encre">
            Note (facultative)
          </label>
          <textarea
            id={`note-${alerte.id}`}
            value={note}
            maxLength={500}
            rows={2}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1 w-full rounded-champ border border-trait p-3 text-sm"
          />
          <div className="mt-3 flex flex-wrap gap-3">
            <Bouton type="button" chargement={enCours === 'confirmee'} libelleChargement="Enregistrement…" disabled={Boolean(enCours)} onClick={() => decider('confirmee')}>
              Confirmer la fraude
            </Bouton>
            <Bouton type="button" variante="secondaire" chargement={enCours === 'ecartee'} libelleChargement="Enregistrement…" disabled={Boolean(enCours)} onClick={() => decider('ecartee')}>
              Écarter
            </Bouton>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-texte">
          {DECISIONS[alerte.statut]} le {dateHeure(alerte.traiteeLe)}
          {alerte.note && <span className="block whitespace-pre-line text-encre">{alerte.note}</span>}
        </p>
      )}
    </article>
  )
}

function ListeAlertes() {
  const [parametres, setParametres] = useSearchParams()
  const statut = ONGLETS.some((o) => o.statut === parametres.get('statut')) ? parametres.get('statut') : 'ouverte'
  const [essai, setEssai] = useState(0)
  const [resultat, setResultat] = useState({ cle: null, donnees: null, erreur: null })
  const [annonce, setAnnonce] = useState(null)
  const cle = `${statut}:${essai}`

  useEffect(() => {
    const controleur = new AbortController()
    listerAlertes({ statut }, { signal: controleur.signal })
      .then((donnees) => setResultat({ cle, donnees, erreur: null }))
      .catch((erreur) => {
        if (!controleur.signal.aborted) setResultat({ cle, donnees: null, erreur })
      })
    return () => controleur.abort()
  }, [statut, cle])

  function retirer(id, message) {
    setAnnonce(message)
    setResultat((r) => (r.donnees ? { ...r, donnees: { ...r.donnees, alertes: r.donnees.alertes.filter((a) => a.id !== id), total: r.donnees.total - 1 } } : r))
  }

  const chargement = resultat.cle !== cle
  const { donnees, erreur } = resultat
  const titreListe = donnees
    ? donnees.total === 0
      ? 'Aucune alerte'
      : statut === 'ouverte'
        ? `${pluriel(donnees.total, 'alerte')} à examiner`
        : pluriel(donnees.total, statut === 'confirmee' ? 'alerte confirmée' : 'alerte écartée', statut === 'confirmee' ? 'alertes confirmées' : 'alertes écartées')
    : ''

  return (
    <div>
      <nav aria-label="Statut des alertes" className="flex flex-wrap gap-2">
        {ONGLETS.map((o) => (
          <button
            key={o.statut}
            type="button"
            aria-current={statut === o.statut ? 'page' : undefined}
            onClick={() => {
              setAnnonce(null)
              setParametres(o.statut === 'ouverte' ? {} : { statut: o.statut })
            }}
            className={`h-10 rounded-champ border px-4 text-sm font-semibold ${
              statut === o.statut ? 'border-encre bg-encre text-white' : 'border-trait bg-white text-encre hover:bg-fond-doux'
            }`}
          >
            {o.libelle}
          </button>
        ))}
      </nav>

      <div aria-live="polite" className="mt-4">
        {annonce && <Alerte ton="succes">{annonce}</Alerte>}
      </div>

      {erreur && !chargement && (
        <div className="mt-4">
          <Alerte ton="erreur">{messageErreurGlobale(erreur)}</Alerte>
          <Bouton type="button" variante="secondaire" className="mt-3" onClick={() => setEssai((n) => n + 1)}>
            Réessayer
          </Bouton>
        </div>
      )}

      {chargement && !donnees && (
        <p role="status" className="mt-4 flex items-center gap-3 text-texte">
          <Indicateur className="size-5 text-accent" />
          Chargement…
        </p>
      )}

      {donnees && (
        <section aria-labelledby="titre-alertes" className={`mt-4 ${chargement ? 'opacity-60' : ''}`}>
          <h2 id="titre-alertes" className="text-lg text-encre">
            {titreListe}
          </h2>
          <ul className="mt-4 space-y-4">
            {donnees.alertes.map((a) => (
              <li key={a.id}>
                <CarteAlerte alerte={a} onDecidee={retirer} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

export default function AlertesFraude() {
  return (
    <AccesAdmin titre={TITRE}>
      {(utilisateur) => (
        <PageAdmin
          titre={TITRE}
          utilisateur={utilisateur}
          intro={
            <p>
              Comportements suspects repérés chaque nuit et signalés par l’app : même téléphone ou même Wi-Fi, rapports copiés, émulateur. Rien n’est sanctionné
              automatiquement : confirmez ou écartez chaque alerte.
            </p>
          }
        >
          <ListeAlertes />
        </PageAdmin>
      )}
    </AccesAdmin>
  )
}
