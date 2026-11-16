import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { deciderGarantie, listerGaranties } from '../../api/admin.js'
import { ErreurApi } from '../../api/client.js'
import { Alerte } from '../../components/Alerte.jsx'
import { Bouton, Indicateur } from '../../components/Bouton.jsx'
import { PageAdmin } from '../../components/MiseEnPage.jsx'
import { dateHeure, pluriel } from '../../lib/format.js'
import { messageErreurGlobale } from '../../lib/messages.js'
import { validerMotifRefus } from '../../lib/validation.js'
import { AccesAdmin } from './AccesAdmin.jsx'

// US-30 : demandes de garantie après un refus de Google (docs/garantie.md).
const TITRE = 'Garanties'
const ONGLETS = [
  { statut: 'en_attente', libelle: 'À examiner' },
  { statut: 'acceptee', libelle: 'Acceptées' },
  { statut: 'refusee', libelle: 'Refusées' },
]
const MOTIFS = { engagement_insuffisant: 'Engagement des testeurs insuffisant', testeurs_insuffisants: 'Nombre de testeurs insuffisant' }
const CHOIX = { nouvelle_campagne: 'Nouvelle campagne offerte', remboursement: 'Remboursement' }

function CarteGarantie({ garantie: g, onDecidee }) {
  const [refus, setRefus] = useState(false)
  const [motif, setMotif] = useState('')
  const [erreurMotif, setErreurMotif] = useState(null)
  const [enCours, setEnCours] = useState(null)
  const [erreur, setErreur] = useState(null)

  async function decider(decision) {
    if (decision === 'refusee') {
      const probleme = validerMotifRefus(motif.trim())
      setErreurMotif(probleme)
      if (probleme) return
    }
    setEnCours(decision)
    setErreur(null)
    try {
      await deciderGarantie(g.id, { decision, motif: motif.trim() })
      onDecidee(g.id, decision === 'acceptee' ? `Garantie acceptée pour « ${g.app.nom} ». Le développeur est prévenu par email.` : `Garantie refusée pour « ${g.app.nom} ».`)
    } catch (err) {
      if (err instanceof ErreurApi && err.code === 'statut_incompatible') onDecidee(g.id, 'Cette demande avait déjà été traitée par un autre admin.')
      else setErreur(messageErreurGlobale(err))
      setEnCours(null)
    }
  }

  return (
    <article aria-labelledby={`garantie-${g.id}`} className="rounded-carte border border-trait bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`garantie-${g.id}`} className="text-base font-semibold text-encre [overflow-wrap:anywhere]">
          {g.app.nom}
        </h3>
        <p className="text-sm text-discret">{dateHeure(g.creeLe)}</p>
      </div>
      <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[12rem_1fr]">
        <dt className="text-discret">Développeur</dt>
        <dd className="text-encre [overflow-wrap:anywhere]">
          {g.developpeur.nom} · {g.developpeur.email}
        </dd>
        <dt className="text-discret">Motif de Google</dt>
        <dd className="text-encre">{MOTIFS[g.motifGoogle]}</dd>
        <dt className="text-discret">Demande</dt>
        <dd className="text-encre">{CHOIX[g.choix]}</dd>
        <dt className="text-discret">Test</dt>
        <dd className="text-encre">
          fini le {dateHeure(g.campagne.termineeLe)}, {pluriel(g.campagne.testeursAuBout, 'testeur', 'testeurs')} au bout des 14 jours
        </dd>
        <dt className="text-discret">Liste de vérification</dt>
        <dd className="text-encre">{g.campagne.preparationComplete ? 'Complète' : 'Incomplète'}</dd>
      </dl>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-semibold text-accent">Email de Google</summary>
        <p className="mt-2 whitespace-pre-line rounded-champ bg-fond-doux p-3 text-sm text-encre">{g.emailGoogle}</p>
      </details>
      {erreur && (
        <Alerte ton="erreur" className="mt-4">
          {erreur}
        </Alerte>
      )}
      {g.statut === 'en_attente' ? (
        <div className="mt-4 space-y-3">
          {refus && (
            <div>
              <label htmlFor={`motif-${g.id}`} className="text-sm font-semibold text-encre">
                Motif du refus
              </label>
              <textarea
                id={`motif-${g.id}`}
                value={motif}
                maxLength={500}
                rows={2}
                aria-invalid={erreurMotif ? true : undefined}
                onChange={(e) => {
                  setMotif(e.target.value)
                  setErreurMotif(null)
                }}
                className="mt-1 w-full rounded-champ border border-trait p-3 text-sm"
              />
              {erreurMotif && <p className="mt-1 text-sm text-erreur">{erreurMotif === 'requis' ? 'Indiquez le motif du refus.' : 'Le motif doit faire au moins 10 caractères.'}</p>}
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            {!refus && (
              <Bouton type="button" chargement={enCours === 'acceptee'} libelleChargement="Enregistrement…" disabled={Boolean(enCours)} onClick={() => decider('acceptee')}>
                Accepter
              </Bouton>
            )}
            <Bouton
              type="button"
              variante={refus ? 'danger' : 'secondaire'}
              chargement={enCours === 'refusee'}
              libelleChargement="Enregistrement…"
              disabled={Boolean(enCours)}
              onClick={() => (refus ? decider('refusee') : setRefus(true))}
            >
              {refus ? 'Confirmer le refus' : 'Refuser'}
            </Bouton>
            {refus && (
              <Bouton type="button" variante="secondaire" disabled={Boolean(enCours)} onClick={() => setRefus(false)}>
                Annuler
              </Bouton>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-texte">
          {g.statut === 'acceptee' ? 'Acceptée' : 'Refusée'} le {dateHeure(g.decideLe)}
          {g.motifRefus && <span className="block text-encre">{g.motifRefus}</span>}
        </p>
      )}
    </article>
  )
}

function ListeGaranties() {
  const [parametres, setParametres] = useSearchParams()
  const statut = ONGLETS.some((o) => o.statut === parametres.get('statut')) ? parametres.get('statut') : 'en_attente'
  const [essai, setEssai] = useState(0)
  const [resultat, setResultat] = useState({ cle: null, donnees: null, erreur: null })
  const [annonce, setAnnonce] = useState(null)
  const cle = `${statut}:${essai}`

  useEffect(() => {
    const controleur = new AbortController()
    listerGaranties({ statut }, { signal: controleur.signal })
      .then((donnees) => setResultat({ cle, donnees, erreur: null }))
      .catch((erreur) => {
        if (!controleur.signal.aborted) setResultat({ cle, donnees: null, erreur })
      })
    return () => controleur.abort()
  }, [statut, cle])

  function retirer(id, message) {
    setAnnonce(message)
    setResultat((r) => (r.donnees ? { ...r, donnees: { ...r.donnees, garanties: r.donnees.garanties.filter((g) => g.id !== id), total: r.donnees.total - 1 } } : r))
  }

  const chargement = resultat.cle !== cle
  const { donnees, erreur } = resultat
  const onglet = ONGLETS.find((o) => o.statut === statut)

  return (
    <div>
      <nav aria-label="Statut des demandes" className="flex flex-wrap gap-2">
        {ONGLETS.map((o) => (
          <button
            key={o.statut}
            type="button"
            aria-current={statut === o.statut ? 'page' : undefined}
            onClick={() => {
              setAnnonce(null)
              setParametres(o.statut === 'en_attente' ? {} : { statut: o.statut })
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
        <section aria-labelledby="titre-garanties" className={`mt-4 ${chargement ? 'opacity-60' : ''}`}>
          <h2 id="titre-garanties" className="text-lg text-encre">
            {donnees.total === 0 ? 'Aucune demande' : `${pluriel(donnees.total, 'demande')} · ${onglet.libelle.toLowerCase()}`}
          </h2>
          <ul className="mt-4 space-y-4">
            {donnees.garanties.map((g) => (
              <li key={g.id}>
                <CarteGarantie garantie={g} onDecidee={retirer} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

export default function Garanties() {
  return (
    <AccesAdmin titre={TITRE}>
      {(utilisateur) => (
        <PageAdmin
          titre={TITRE}
          utilisateur={utilisateur}
          intro={
            <p>
              Demandes des développeurs après un refus de Google. La garantie couvre un refus pour engagement ou nombre de testeurs insuffisant, quand la liste
              de vérification a été respectée.
            </p>
          }
        >
          <ListeGaranties />
        </PageAdmin>
      )}
    </AccesAdmin>
  )
}
