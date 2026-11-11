import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { verifierEmail } from '../../api/auth.js'
import { ErreurApi } from '../../api/client.js'
import { Alerte } from '../../components/Alerte.jsx'
import { Bouton, Indicateur } from '../../components/Bouton.jsx'
import { PageCompte } from '../../components/MiseEnPage.jsx'
import { messageErreurGlobale } from '../../lib/messages.js'
import { lireEmailEnAttente } from './emailEnAttente.js'
import { RenvoiEmail } from './RenvoiEmail.jsx'

// Un jeton ne peut servir qu'une fois : on garde la promesse pour ne pas l'envoyer
// deux fois (double exécution des effets en mode strict, retour arrière).
const verifications = new Map()
function verifierUneFois(jeton) {
  if (!verifications.has(jeton)) verifications.set(jeton, verifierEmail(jeton))
  return verifications.get(jeton)
}

export default function VerificationEmail() {
  const [parametres] = useSearchParams()
  const jeton = parametres.get('jeton')
  const navigate = useNavigate()
  const [erreur, setErreur] = useState(null)
  const [essai, setEssai] = useState(0)

  useEffect(() => {
    if (!jeton) return
    let actif = true
    verifierUneFois(jeton)
      .then(() => {
        if (actif) navigate('/compte-en-attente', { replace: true, state: { vientDeVerifier: true } })
      })
      .catch((e) => {
        verifications.delete(jeton)
        if (actif) setErreur(e)
      })
    return () => {
      actif = false
    }
  }, [jeton, navigate, essai])

  if (!jeton || (erreur instanceof ErreurApi && erreur.code === 'jeton_invalide')) {
    return (
      <PageCompte titre="Ce lien n’est pas valide">
        <div className="space-y-4 text-texte">
          <p>Il a peut-être déjà été utilisé, ou il a été mal copié.</p>
          <p>
            Si vous avez déjà confirmé votre adresse,{' '}
            <Link to="/connexion" className="font-medium text-accent underline underline-offset-2">
              connectez-vous
            </Link>
            . Sinon, demandez un nouveau lien :
          </p>
          <RenvoiEmail email={lireEmailEnAttente()} />
        </div>
      </PageCompte>
    )
  }

  if (erreur instanceof ErreurApi && erreur.code === 'jeton_expire') {
    return (
      <PageCompte titre="Ce lien a expiré" intro={<p>Les liens de confirmation restent valables 24 heures. Demandez-en un nouveau.</p>}>
        <RenvoiEmail email={lireEmailEnAttente()} />
      </PageCompte>
    )
  }

  if (erreur) {
    return (
      <PageCompte titre="Vérification impossible pour le moment">
        <Alerte ton="erreur">{messageErreurGlobale(erreur)}</Alerte>
        <Bouton
          type="button"
          className="mt-6 w-full"
          onClick={() => {
            setErreur(null)
            setEssai((n) => n + 1)
          }}
        >
          Réessayer
        </Bouton>
      </PageCompte>
    )
  }

  return (
    <PageCompte titre="Confirmation de votre adresse email">
      <p role="status" className="flex items-center gap-3 text-texte">
        <Indicateur className="size-5 text-accent" />
        Vérification en cours…
      </p>
    </PageCompte>
  )
}
