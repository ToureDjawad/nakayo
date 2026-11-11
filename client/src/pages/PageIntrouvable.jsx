import { Link } from 'react-router'
import { PageCompte } from '../components/MiseEnPage.jsx'

export default function PageIntrouvable() {
  return (
    <PageCompte titre="Page introuvable">
      <p className="text-texte">
        Cette adresse ne correspond à aucune page.{' '}
        <Link to="/" className="font-medium text-accent underline underline-offset-2">
          Retour à l’accueil
        </Link>
      </p>
    </PageCompte>
  )
}
