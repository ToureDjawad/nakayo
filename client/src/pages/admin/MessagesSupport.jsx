import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { ErreurApi } from '../../api/client.js'
import { listerTicketsAdmin, traiterTicket } from '../../api/tickets.js'
import { Alerte } from '../../components/Alerte.jsx'
import { Bouton, Indicateur } from '../../components/Bouton.jsx'
import { PageAdmin } from '../../components/MiseEnPage.jsx'
import { dateHeure, pluriel, ROLES, telephone } from '../../lib/format.js'
import { messageErreurGlobale } from '../../lib/messages.js'
import { AccesAdmin } from './AccesAdmin.jsx'

const TITRE = 'Messages reçus'
const ONGLETS = [
  { statut: 'ouvert', libelle: 'À traiter' },
  { statut: 'traite', libelle: 'Traités' },
]

function CarteMessage({ ticket, onTraite }) {
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState(null)
  const { auteur } = ticket
  const contact = auteur.email ?? telephone(auteur.telephone)

  async function traiter() {
    setEnCours(true)
    setErreur(null)
    try {
      const { ticket: aJour } = await traiterTicket(ticket.id)
      onTraite(aJour, 'Message marqué comme traité.')
    } catch (err) {
      if (err instanceof ErreurApi && err.code === 'statut_incompatible') onTraite(null, 'Ce message avait déjà été traité par un autre admin.', ticket.id)
      else setErreur(messageErreurGlobale(err))
      setEnCours(false)
    }
  }

  return (
    <article aria-labelledby={`sujet-${ticket.id}`} className="rounded-carte border border-trait bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`sujet-${ticket.id}`} className="text-base font-semibold [overflow-wrap:anywhere] text-encre">
          {ticket.sujet}
        </h3>
        <p className="text-sm text-discret">{dateHeure(ticket.creeLe)}</p>
      </div>
      <p className="mt-1 text-sm text-texte">
        {auteur.nom} · {ROLES[auteur.role] ?? auteur.role} · <span className="[overflow-wrap:anywhere]">{contact}</span>
      </p>
      <p className="mt-3 whitespace-pre-line [overflow-wrap:anywhere] text-encre">{ticket.message}</p>
      {erreur && (
        <Alerte ton="erreur" className="mt-4">
          {erreur}
        </Alerte>
      )}
      {ticket.statut === 'ouvert' ? (
        <Bouton type="button" variante="secondaire" className="mt-4" chargement={enCours} libelleChargement="Enregistrement…" onClick={traiter}>
          Marquer comme traité
        </Bouton>
      ) : (
        <p className="mt-4 text-sm text-succes">Traité le {dateHeure(ticket.traiteLe)}</p>
      )}
    </article>
  )
}

function ListeMessages() {
  const [parametres, setParametres] = useSearchParams()
  const statut = parametres.get('statut') === 'traite' ? 'traite' : 'ouvert'
  const page = Math.max(1, Number.parseInt(parametres.get('page') ?? '1', 10) || 1)
  const [essai, setEssai] = useState(0)
  const [resultat, setResultat] = useState({ cle: null, donnees: null, erreur: null })
  const [annonce, setAnnonce] = useState(null)
  const cle = `${statut}:${page}:${essai}`

  useEffect(() => {
    const controleur = new AbortController()
    listerTicketsAdmin({ statut, page }, { signal: controleur.signal })
      .then((donnees) => setResultat({ cle, donnees, erreur: null }))
      .catch((erreur) => {
        if (!controleur.signal.aborted) setResultat({ cle, donnees: null, erreur })
      })
    return () => controleur.abort()
  }, [statut, page, cle])

  function changer(suivants) {
    setAnnonce(null)
    setParametres(suivants)
  }

  function retirer(_aJour, message, idDejaTraite) {
    setAnnonce(message)
    setResultat((r) => {
      if (!r.donnees) return r
      const id = _aJour?.id ?? idDejaTraite
      return { ...r, donnees: { ...r.donnees, tickets: r.donnees.tickets.filter((t) => t.id !== id), total: r.donnees.total - 1 } }
    })
  }

  const chargement = resultat.cle !== cle
  const { donnees, erreur } = resultat
  const pages = donnees ? Math.max(1, Math.ceil(donnees.total / donnees.parPage)) : 1

  return (
    <div>
      <nav aria-label="Statut des messages" className="flex gap-2">
        {ONGLETS.map((o) => (
          <button
            key={o.statut}
            type="button"
            aria-current={statut === o.statut ? 'page' : undefined}
            onClick={() => changer(o.statut === 'ouvert' ? {} : { statut: o.statut })}
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
        <section aria-labelledby="titre-liste" className={`mt-4 ${chargement ? 'opacity-60' : ''}`}>
          <h2 id="titre-liste" className="text-lg text-encre">
            {donnees.total === 0
              ? statut === 'ouvert'
                ? 'Aucun message à traiter'
                : 'Aucun message traité'
              : statut === 'ouvert'
                ? `${pluriel(donnees.total, 'message')} à traiter`
                : pluriel(donnees.total, 'message traité', 'messages traités')}
          </h2>
          <ul className="mt-4 space-y-4">
            {donnees.tickets.map((t) => (
              <li key={t.id}>
                <CarteMessage ticket={t} onTraite={retirer} />
              </li>
            ))}
          </ul>
          {pages > 1 && (
            <nav aria-label="Pagination" className="mt-6 flex items-center justify-between gap-4">
              <Bouton type="button" variante="secondaire" disabled={page <= 1} onClick={() => changer({ ...(statut === 'traite' ? { statut } : {}), page: String(page - 1) })}>
                Précédent
              </Bouton>
              <p className="text-sm text-texte">
                Page {page} sur {pages}
              </p>
              <Bouton type="button" variante="secondaire" disabled={page >= pages} onClick={() => changer({ ...(statut === 'traite' ? { statut } : {}), page: String(page + 1) })}>
                Suivant
              </Bouton>
            </nav>
          )}
        </section>
      )}
    </div>
  )
}

export default function MessagesSupport() {
  return (
    <AccesAdmin titre={TITRE}>
      {(utilisateur) => (
        <PageAdmin
          titre={TITRE}
          utilisateur={utilisateur}
          intro={<p>Les questions envoyées par les développeurs et les testeurs. Répondez par email, SMS ou WhatsApp, puis marquez le message comme traité.</p>}
        >
          <ListeMessages />
        </PageAdmin>
      )}
    </AccesAdmin>
  )
}
