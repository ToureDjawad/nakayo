import { useState } from 'react'
import { Link } from 'react-router'
import { demanderReinitialisation } from '../../api/auth.js'
import { ErreurApi } from '../../api/client.js'
import { Alerte } from '../../components/Alerte.jsx'
import { Bouton } from '../../components/Bouton.jsx'
import { Champ } from '../../components/Champ.jsx'
import { PageCompte } from '../../components/MiseEnPage.jsx'
import { messageErreurGlobale } from '../../lib/messages.js'
import { useCompteARebours } from '../../lib/useCompteARebours.js'
import { useFormulaire } from '../../lib/useFormulaire.js'
import { LIMITES, validerEmail } from '../../lib/validation.js'

const DELAI_RENVOI = 60

export default function MotDePasseOublie() {
  const formulaire = useFormulaire({ email: '' }, { email: validerEmail })
  const [envoi, setEnvoi] = useState(false)
  const [envoyeA, setEnvoyeA] = useState(null)
  const [erreur, setErreur] = useState(null)
  const [restant, setRestant] = useCompteARebours()

  async function soumettre(e) {
    e.preventDefault()
    setErreur(null)
    if (!formulaire.validerTout()) return
    const email = formulaire.valeurs.email.trim().toLowerCase()
    setEnvoi(true)
    try {
      await demanderReinitialisation(email)
      setEnvoyeA(email)
      setRestant(DELAI_RENVOI)
    } catch (err) {
      if (err instanceof ErreurApi && err.champs) formulaire.appliquerErreursServeur(err.champs)
      else {
        setErreur(messageErreurGlobale(err))
        if (err instanceof ErreurApi && err.statut === 429) setRestant(err.retryAfter ?? DELAI_RENVOI)
      }
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <PageCompte
      titre="Mot de passe oublié"
      intro={<p>Indiquez l’adresse email de votre compte. Nous vous enverrons un lien pour choisir un nouveau mot de passe.</p>}
    >
      {envoyeA && (
        <Alerte ton="succes" className="mb-6" titre="Vérifiez votre boîte de réception">
          Si un compte existe pour <strong className="font-semibold [overflow-wrap:anywhere]">{envoyeA}</strong>, un lien valable
          1 heure vient d’y être envoyé. Pensez à regarder dans les courriers indésirables.
        </Alerte>
      )}
      {erreur && (
        <Alerte ton="erreur" className="mb-6">
          {erreur}
        </Alerte>
      )}
      <form onSubmit={soumettre} noValidate className="space-y-6">
        <Champ
          {...formulaire.lier('email')}
          libelle="Adresse email"
          type="email"
          autoComplete="email"
          inputMode="email"
          spellCheck={false}
          max={LIMITES.email}
        />
        <Bouton chargement={envoi} libelleChargement="Envoi…" disabled={restant > 0} className="w-full">
          {restant > 0 ? `Renvoyer le lien (possible dans ${restant} s)` : envoyeA ? 'Renvoyer le lien' : 'Envoyer le lien'}
        </Bouton>
      </form>
      <p className="mt-6 text-texte">
        <Link to="/connexion" className="font-medium text-accent underline underline-offset-2">
          Retour à la connexion
        </Link>
      </p>
    </PageCompte>
  )
}
