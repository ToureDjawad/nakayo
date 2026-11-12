import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ErreurApi } from '../../api/client.js'
import { envoyerTicket, listerMesTickets } from '../../api/tickets.js'
import { Alerte } from '../../components/Alerte.jsx'
import { Bouton, Indicateur } from '../../components/Bouton.jsx'
import { Champ, ChampTexte } from '../../components/Champ.jsx'
import { ContactWhatsapp } from '../../components/ContactWhatsapp.jsx'
import { PageCompte } from '../../components/MiseEnPage.jsx'
import { dateHeure } from '../../lib/format.js'
import { messageErreurGlobale } from '../../lib/messages.js'
import { useFormulaire } from '../../lib/useFormulaire.js'
import { useSession } from '../../lib/useSession.js'
import { LIMITES, validerMessage, validerSujet } from '../../lib/validation.js'

const TITRE = 'Écrire à l’équipe Nakayo'
const STATUTS = { ouvert: 'Envoyé', traite: 'Traité' }

function Historique({ tickets }) {
  if (!tickets?.length) return null
  return (
    <section aria-labelledby="titre-historique" className="mt-10">
      <h2 id="titre-historique" className="text-lg font-semibold text-encre">
        Vos messages
      </h2>
      <ul className="mt-3 space-y-3">
        {tickets.map((t) => (
          <li key={t.id} className="rounded-carte border border-trait bg-white p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold [overflow-wrap:anywhere] text-encre">{t.sujet}</p>
              <span
                className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                  t.statut === 'traite' ? 'bg-succes-clair text-succes' : 'bg-ocre-clair text-alerte'
                }`}
              >
                {STATUTS[t.statut]}
              </span>
            </div>
            <p className="mt-1 text-sm text-discret">Envoyé le {dateHeure(t.creeLe)}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Formulaire({ utilisateur }) {
  const formulaire = useFormulaire({ sujet: '', message: '' }, { sujet: validerSujet, message: validerMessage })
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [envoye, setEnvoye] = useState(false)
  const [tickets, setTickets] = useState(null)

  useEffect(() => {
    const controleur = new AbortController()
    listerMesTickets({ signal: controleur.signal })
      .then((r) => setTickets(r.tickets))
      .catch(() => {})
    return () => controleur.abort()
  }, [])

  async function soumettre(e) {
    e.preventDefault()
    setErreur(null)
    setEnvoye(false)
    if (!formulaire.validerTout()) return
    setEnvoi(true)
    try {
      const { ticket } = await envoyerTicket({ sujet: formulaire.valeurs.sujet.trim(), message: formulaire.valeurs.message.trim() })
      setTickets((liste) => [ticket, ...(liste ?? [])])
      formulaire.vider('sujet')
      formulaire.vider('message')
      setEnvoye(true)
    } catch (err) {
      if (err instanceof ErreurApi && err.champs) formulaire.appliquerErreursServeur(err.champs)
      else setErreur(messageErreurGlobale(err))
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <>
      <div aria-live="polite">
        {envoye && (
          <Alerte ton="succes" className="mb-6" titre="Message envoyé">
            L’équipe vous répond par email à <strong className="font-semibold [overflow-wrap:anywhere]">{utilisateur.email}</strong>,
            en général sous 24 h ouvrées.
          </Alerte>
        )}
      </div>
      {erreur && (
        <Alerte ton="erreur" className="mb-6">
          {erreur}
        </Alerte>
      )}
      <form onSubmit={soumettre} noValidate className="space-y-6">
        <Champ {...formulaire.lier('sujet')} libelle="Sujet" max={LIMITES.sujetMax} autoComplete="off" />
        <ChampTexte
          {...formulaire.lier('message')}
          libelle="Votre message"
          aide="Décrivez votre question. Pour une app, indiquez son nom."
          max={LIMITES.messageMax}
          lignes={6}
        />
        <Bouton chargement={envoi} libelleChargement="Envoi…" className="w-full">
          Envoyer le message
        </Bouton>
      </form>
      <ContactWhatsapp utilisateur={utilisateur} className="mt-8" />
      <Historique tickets={tickets} />
      <p className="mt-8 text-texte">
        <Link to="/mon-compte" className="font-medium text-accent underline underline-offset-2">
          Retour à mon compte
        </Link>
      </p>
    </>
  )
}

export default function EcrireAuSupport() {
  const session = useSession()

  if (session.etat === 'chargement') {
    return (
      <PageCompte titre={TITRE}>
        <p role="status" className="flex items-center gap-3 text-texte">
          <Indicateur className="size-5 text-accent" />
          Chargement…
        </p>
      </PageCompte>
    )
  }
  if (session.etat === 'erreur') {
    return (
      <PageCompte titre={TITRE}>
        <Alerte ton="erreur">{messageErreurGlobale(session.erreur)}</Alerte>
        <Bouton type="button" className="mt-6 w-full" onClick={session.recharger}>
          Réessayer
        </Bouton>
      </PageCompte>
    )
  }
  if (session.etat === 'deconnecte') {
    return (
      <PageCompte titre={TITRE}>
        <p className="text-texte">
          <Link to="/connexion?suite=%2Fmon-compte%2Fsupport" className="font-medium text-accent underline underline-offset-2">
            Connectez-vous
          </Link>{' '}
          pour écrire à l’équipe Nakayo.
        </p>
      </PageCompte>
    )
  }
  if (session.utilisateur.role !== 'developpeur') {
    return (
      <PageCompte titre={TITRE} utilisateur={session.utilisateur}>
        <p className="text-texte">Cette page est réservée aux comptes développeur.</p>
      </PageCompte>
    )
  }
  return (
    <PageCompte
      titre={TITRE}
      utilisateur={session.utilisateur}
      intro={<p>Une question sur votre compte ou votre campagne ? Écrivez-nous, nous vous répondons par email.</p>}
    >
      <Formulaire utilisateur={session.utilisateur} />
    </PageCompte>
  )
}
