import { Link, useLocation } from 'react-router'
import { PageCompte } from '../../components/MiseEnPage.jsx'
import { lireEmailEnAttente } from './emailEnAttente.js'
import { RenvoiEmail } from './RenvoiEmail.jsx'

export default function VerifiezVotreEmail() {
  const { state } = useLocation()
  const email = state?.email ?? lireEmailEnAttente()

  return (
    <PageCompte
      titre="Vérifiez votre adresse email"
      intro={
        email ? (
          <p>
            Nous avons envoyé un lien de confirmation à <strong className="font-semibold text-encre [overflow-wrap:anywhere]">{email}</strong>.
            Ouvrez-le pour activer votre compte. Il reste valable 24 heures.
          </p>
        ) : (
          <p>Nous avons envoyé un lien de confirmation à l’adresse indiquée. Il reste valable 24 heures.</p>
        )
      }
    >
      <div className="space-y-8">
        <section aria-labelledby="pas-recu">
          <h2 id="pas-recu" className="text-lg font-semibold text-encre">
            Vous ne trouvez pas l’email ?
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-texte">
            <li>Regardez dans le dossier des courriers indésirables.</li>
            <li>L’envoi peut prendre quelques minutes.</li>
          </ul>
          <div className="mt-4">
            <RenvoiEmail email={email} />
          </div>
        </section>

        <p className="text-texte">
          Adresse incorrecte ?{' '}
          <Link to="/inscription" className="font-medium text-accent underline underline-offset-2">
            Recommencer l’inscription
          </Link>
        </p>
      </div>
    </PageCompte>
  )
}
