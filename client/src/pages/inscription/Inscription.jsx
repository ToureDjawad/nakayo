import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { inscrireDeveloppeur } from '../../api/auth.js'
import { ErreurApi } from '../../api/client.js'
import { Alerte } from '../../components/Alerte.jsx'
import { Bouton } from '../../components/Bouton.jsx'
import { CaseACocher, Champ, ChampMotDePasse, ChampSelection } from '../../components/Champ.jsx'
import { PageCompte } from '../../components/MiseEnPage.jsx'
import { messageErreurGlobale } from '../../lib/messages.js'
import { PAYS } from '../../lib/pays.js'
import { useFormulaire } from '../../lib/useFormulaire.js'
import {
  LIMITES,
  normaliserLienFiche,
  validerCoche,
  validerEmail,
  validerLienFiche,
  validerMotDePasse,
  validerNom,
  validerRequis,
} from '../../lib/validation.js'
import { memoriserEmailEnAttente } from './emailEnAttente.js'

// Les textes juridiques s'ouvrent dans un nouvel onglet pour ne pas perdre la saisie.
function LienNouvelOnglet({ to, children }) {
  return (
    <Link to={to} target="_blank" rel="noopener" className="font-medium text-accent underline underline-offset-2">
      {children}
      <span className="sr-only"> (s’ouvre dans un nouvel onglet)</span>
    </Link>
  )
}

const OPTIONS_PAYS = PAYS.map((p) => ({ valeur: p.code, libelle: p.nom }))

const validateurs = {
  nom: validerNom,
  email: validerEmail,
  motDePasse: validerMotDePasse,
  pays: validerRequis,
  lienFicheDeveloppeur: validerLienFiche,
  accepteConditions: validerCoche,
}

export default function Inscription() {
  const navigate = useNavigate()
  const formulaire = useFormulaire(
    { nom: '', email: '', motDePasse: '', pays: '', lienFicheDeveloppeur: '', accepteConditions: false },
    validateurs,
  )
  const [envoi, setEnvoi] = useState(false)
  const [erreurGlobale, setErreurGlobale] = useState(null)
  const refAlerte = useRef(null)

  async function soumettre(e) {
    e.preventDefault()
    setErreurGlobale(null)
    if (!formulaire.validerTout()) return

    const v = formulaire.valeurs
    const donnees = {
      nom: v.nom.trim(),
      email: v.email.trim().toLowerCase(),
      motDePasse: v.motDePasse,
      pays: v.pays,
      lienFicheDeveloppeur: normaliserLienFiche(v.lienFicheDeveloppeur),
      accepteConditions: true,
    }

    setEnvoi(true)
    try {
      await inscrireDeveloppeur(donnees)
      memoriserEmailEnAttente(donnees.email)
      navigate('/verifiez-votre-email', { state: { email: donnees.email } })
    } catch (erreur) {
      setEnvoi(false)
      if (erreur instanceof ErreurApi && erreur.champs) {
        formulaire.appliquerErreursServeur(erreur.champs)
        return
      }
      setErreurGlobale(messageErreurGlobale(erreur))
      requestAnimationFrame(() => refAlerte.current?.focus())
    }
  }

  const lien = formulaire.lier

  return (
    <PageCompte
      titre="Créer un compte développeur"
      intro={
        <p>
          Votre compte sera vérifié par notre équipe avant de pouvoir soumettre une application.{' '}
          Déjà inscrit ?{' '}
          <Link to="/connexion" className="font-medium text-accent underline underline-offset-2">
            Se connecter
          </Link>
        </p>
      }
    >
      {erreurGlobale && (
        <Alerte ton="erreur" ref={refAlerte} className="mb-6">
          {erreurGlobale}
        </Alerte>
      )}

      <form onSubmit={soumettre} noValidate className="space-y-6">
        <Champ
          {...lien('nom')}
          libelle="Nom de développeur Google Play"
          aide="Tel qu’il apparaît sur votre fiche Google Play."
          autoComplete="organization"
          max={LIMITES.nomMax}
        />
        <Champ
          {...lien('email')}
          libelle="Adresse email"
          type="email"
          autoComplete="email"
          inputMode="email"
          spellCheck={false}
          max={LIMITES.email}
        />
        <ChampMotDePasse
          {...lien('motDePasse')}
          libelle="Mot de passe"
          aide={`${LIMITES.motDePasseMin} caractères minimum. Une phrase de plusieurs mots est plus sûre.`}
          autoComplete="new-password"
        />
        <ChampSelection
          {...lien('pays')}
          libelle="Pays"
          invite="Choisissez un pays"
          options={OPTIONS_PAYS}
          autoComplete="country"
        />
        <Champ
          {...lien('lienFicheDeveloppeur')}
          libelle="Lien de votre fiche développeur Google Play"
          aide="Sur Google Play, ouvrez votre page développeur et copiez son adresse. Exemple : https://play.google.com/store/apps/dev?id=1234567890"
          type="url"
          inputMode="url"
          spellCheck={false}
          autoCapitalize="none"
          max={LIMITES.lienFiche}
        />
        <CaseACocher {...lien('accepteConditions')}>
          J’accepte les{' '}
          <LienNouvelOnglet to="/conditions-utilisation">conditions d’utilisation</LienNouvelOnglet>{' '}
          et la{' '}
          <LienNouvelOnglet to="/confidentialite">politique de confidentialité</LienNouvelOnglet>.
        </CaseACocher>

        <Bouton chargement={envoi} libelleChargement="Création du compte…" className="w-full">
          Créer mon compte
        </Bouton>
      </form>
    </PageCompte>
  )
}
