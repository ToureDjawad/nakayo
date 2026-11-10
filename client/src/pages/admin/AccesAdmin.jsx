import { Link } from 'react-router'
import { Alerte } from '../../components/Alerte.jsx'
import { Bouton, Indicateur } from '../../components/Bouton.jsx'
import { PageAdmin } from '../../components/MiseEnPage.jsx'
import { messageErreurGlobale } from '../../lib/messages.js'
import { useSession } from '../../lib/useSession.js'

// Réserve une page aux administrateurs. L'API refuse de toute façon (401 / 403) :
// ce contrôle sert seulement à afficher un message clair.
export function AccesAdmin({ titre, children }) {
  const session = useSession()

  if (session.etat === 'chargement') {
    return (
      <PageAdmin titre={titre}>
        <p role="status" className="flex items-center gap-3 text-texte">
          <Indicateur className="size-5 text-accent" />
          Chargement…
        </p>
      </PageAdmin>
    )
  }

  if (session.etat === 'erreur') {
    return (
      <PageAdmin titre={titre}>
        <Alerte ton="erreur">{messageErreurGlobale(session.erreur)}</Alerte>
        <Bouton type="button" className="mt-6" onClick={session.recharger}>
          Réessayer
        </Bouton>
      </PageAdmin>
    )
  }

  if (session.etat === 'deconnecte') {
    return (
      <PageAdmin titre={titre}>
        <p className="text-texte">
          Cette page est réservée à l’équipe Nakayo.{' '}
          <Link to="/connexion" className="font-medium text-accent underline underline-offset-2">
            Connectez-vous
          </Link>{' '}
          avec un compte administrateur.
        </p>
      </PageAdmin>
    )
  }

  if (session.utilisateur.role !== 'admin') {
    return (
      <PageAdmin titre={titre}>
        <Alerte ton="erreur" titre="Accès réservé aux administrateurs">
          Votre compte n’a pas accès au back-office.
        </Alerte>
      </PageAdmin>
    )
  }

  return children(session.utilisateur)
}
