import { useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { connecter } from '../../api/auth.js'
import { ErreurApi } from '../../api/client.js'
import { Alerte } from '../../components/Alerte.jsx'
import { Bouton } from '../../components/Bouton.jsx'
import { Champ, ChampMotDePasse } from '../../components/Champ.jsx'
import { PageCompte, PanneauCitation } from '../../components/MiseEnPage.jsx'
import { messageErreurGlobale } from '../../lib/messages.js'
import { destinationApresConnexion } from '../../lib/redirection.js'
import { useFormulaire } from '../../lib/useFormulaire.js'
import { LIMITES, validerEmail } from '../../lib/validation.js'
import { RenvoiEmail } from '../inscription/RenvoiEmail.jsx'

const lien = 'font-medium text-accent underline underline-offset-2'

// À la connexion, on ne vérifie que la présence du mot de passe : sa longueur
// minimale ne doit pas révéler d'information ni bloquer un ancien mot de passe.
const validateurs = {
  email: validerEmail,
  motDePasse: (v) => (v ? null : 'requis'),
}

const MESSAGES_MOT_DE_PASSE = { requis: 'Saisissez votre mot de passe.' }

export default function Connexion() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const [parametres] = useSearchParams()
  const formulaire = useFormulaire({ email: '', motDePasse: '' }, validateurs)
  const [envoi, setEnvoi] = useState(false)
  const [probleme, setProbleme] = useState(null)
  const refAlerte = useRef(null)

  async function soumettre(e) {
    e.preventDefault()
    setProbleme(null)
    if (!formulaire.validerTout()) return
    const email = formulaire.valeurs.email.trim().toLowerCase()
    setEnvoi(true)
    try {
      const { utilisateur } = await connecter(email, formulaire.valeurs.motDePasse)
      navigate(destinationApresConnexion(utilisateur, parametres.get('suite')), { replace: true })
    } catch (erreur) {
      setEnvoi(false)
      if (erreur instanceof ErreurApi && erreur.champs) {
        formulaire.appliquerErreursServeur(erreur.champs)
        return
      }
      if (erreur instanceof ErreurApi && erreur.code === 'identifiants_invalides') {
        formulaire.vider('motDePasse')
        setProbleme({ type: 'identifiants' })
      } else if (erreur instanceof ErreurApi && erreur.code === 'email_non_verifie') {
        setProbleme({ type: 'email_non_verifie', email })
      } else if (erreur instanceof ErreurApi && erreur.code === 'compte_suspendu') {
        setProbleme({ type: 'suspendu' })
      } else {
        setProbleme({ type: 'autre', texte: messageErreurGlobale(erreur) })
      }
      requestAnimationFrame(() => refAlerte.current?.focus())
    }
  }

  return (
    <PageCompte
      titre="Content de vous revoir"
      intro={
        <p>
          Connectez-vous pour suivre vos campagnes. Pas encore de compte ?{' '}
          <Link to="/inscription" className={lien}>
            Créer un compte
          </Link>
        </p>
      }
      panneau={<PanneauCitation texte="Vos campagnes vous attendent." />}
    >
      {state?.message && !probleme && (
        <Alerte ton="succes" className="mb-6">
          {state.message}
        </Alerte>
      )}

      {probleme?.type === 'identifiants' && (
        <Alerte ton="erreur" ref={refAlerte} className="mb-6">
          Adresse email ou mot de passe incorrect.
        </Alerte>
      )}
      {probleme?.type === 'suspendu' && (
        <Alerte ton="erreur" ref={refAlerte} className="mb-6" titre="Compte suspendu">
          Contactez notre équipe en répondant à l’email de suspension que vous avez reçu.
        </Alerte>
      )}
      {probleme?.type === 'autre' && (
        <Alerte ton="erreur" ref={refAlerte} className="mb-6">
          {probleme.texte}
        </Alerte>
      )}
      {probleme?.type === 'email_non_verifie' && (
        <div className="mb-8 space-y-4">
          <Alerte ton="alerte" ref={refAlerte} titre="Adresse email non confirmée">
            Ouvrez le lien reçu à l’inscription pour confirmer votre adresse, puis connectez-vous.
          </Alerte>
          <RenvoiEmail email={probleme.email} />
        </div>
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
        <div>
          <ChampMotDePasse
            {...formulaire.lier('motDePasse')}
            libelle="Mot de passe"
            autoComplete="current-password"
            messages={MESSAGES_MOT_DE_PASSE}
          />
          <p className="mt-2 text-sm">
            <Link to="/mot-de-passe-oublie" className={lien}>
              Mot de passe oublié ?
            </Link>
          </p>
        </div>
        <Bouton chargement={envoi} libelleChargement="Connexion…" variante="sombre" className="w-full">
          Se connecter
        </Bouton>
      </form>

      <div className="mt-8 flex items-center gap-3 text-sm text-discret" aria-hidden="true">
        <span className="h-px flex-1 bg-trait" />
        Vous êtes testeur ?
        <span className="h-px flex-1 bg-trait" />
      </div>
      <p className="mt-4 text-sm text-texte">
        <span className="sr-only">Vous êtes testeur ? </span>
        Les testeurs se connectent depuis l’app Android Nakayo, avec leur numéro de téléphone.
      </p>
    </PageCompte>
  )
}
