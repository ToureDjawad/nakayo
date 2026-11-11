import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { reinitialiserMotDePasse } from '../../api/auth.js'
import { ErreurApi } from '../../api/client.js'
import { Alerte } from '../../components/Alerte.jsx'
import { Bouton } from '../../components/Bouton.jsx'
import { ChampMotDePasse } from '../../components/Champ.jsx'
import { PageCompte } from '../../components/MiseEnPage.jsx'
import { messageErreurGlobale } from '../../lib/messages.js'
import { useFormulaire } from '../../lib/useFormulaire.js'
import { LIMITES, validerConfirmation, validerMotDePasse } from '../../lib/validation.js'

const lien = 'font-medium text-accent underline underline-offset-2'

function LienPerime({ titre, texte }) {
  return (
    <PageCompte titre={titre}>
      <p className="text-texte">{texte}</p>
      <p className="mt-6">
        <Link to="/mot-de-passe-oublie" className={lien}>
          Demander un nouveau lien
        </Link>
      </p>
    </PageCompte>
  )
}

export default function ReinitialiserMotDePasse() {
  const [parametres] = useSearchParams()
  const jeton = parametres.get('jeton')
  const navigate = useNavigate()
  const formulaire = useFormulaire(
    { motDePasse: '', confirmation: '' },
    { motDePasse: validerMotDePasse, confirmation: validerConfirmation },
  )
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)

  if (!jeton || erreur?.code === 'jeton_invalide') {
    return (
      <LienPerime
        titre="Ce lien n’est pas valide"
        texte="Il a peut-être déjà servi, ou il a été mal copié. Les liens de réinitialisation ne fonctionnent qu’une fois."
      />
    )
  }
  if (erreur?.code === 'jeton_expire') {
    return <LienPerime titre="Ce lien a expiré" texte="Les liens de réinitialisation restent valables 1 heure." />
  }

  async function soumettre(e) {
    e.preventDefault()
    setErreur(null)
    if (!formulaire.validerTout()) return
    setEnvoi(true)
    try {
      await reinitialiserMotDePasse(jeton, formulaire.valeurs.motDePasse)
      navigate('/connexion', {
        replace: true,
        state: { message: 'Votre mot de passe a été modifié. Connectez-vous avec le nouveau mot de passe.' },
      })
    } catch (err) {
      setEnvoi(false)
      if (err instanceof ErreurApi && err.champs) formulaire.appliquerErreursServeur(err.champs)
      else if (err instanceof ErreurApi && (err.code === 'jeton_invalide' || err.code === 'jeton_expire')) setErreur(err)
      else setErreur({ texte: messageErreurGlobale(err) })
    }
  }

  return (
    <PageCompte
      titre="Choisir un nouveau mot de passe"
      intro={<p>Toutes vos sessions ouvertes seront fermées, sur tous vos appareils.</p>}
    >
      {erreur?.texte && (
        <Alerte ton="erreur" className="mb-6">
          {erreur.texte}
        </Alerte>
      )}
      <form onSubmit={soumettre} noValidate className="space-y-6">
        <ChampMotDePasse
          {...formulaire.lier('motDePasse')}
          libelle="Nouveau mot de passe"
          aide={`${LIMITES.motDePasseMin} caractères minimum. Une phrase de plusieurs mots est plus sûre.`}
          autoComplete="new-password"
        />
        <ChampMotDePasse {...formulaire.lier('confirmation')} libelle="Confirmer le mot de passe" autoComplete="new-password" />
        <Bouton chargement={envoi} libelleChargement="Enregistrement…" className="w-full">
          Enregistrer le mot de passe
        </Bouton>
      </form>
    </PageCompte>
  )
}
