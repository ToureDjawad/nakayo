import { Link, useLocation } from 'react-router'
import { Alerte } from '../../components/Alerte.jsx'
import { Bouton, Indicateur } from '../../components/Bouton.jsx'
import { PageCompte } from '../../components/MiseEnPage.jsx'
import { messageErreurGlobale } from '../../lib/messages.js'
import { nomPays } from '../../lib/pays.js'
import { useSession } from '../../lib/useSession.js'

function Recapitulatif({ utilisateur }) {
  const lignes = [
    ['Nom de développeur', utilisateur.nom],
    ['Adresse email', utilisateur.email],
    ['Pays', nomPays(utilisateur.pays)],
    ['Fiche Google Play', utilisateur.lienFicheDeveloppeur],
  ].filter(([, valeur]) => valeur)

  return (
    <section aria-labelledby="recap" className="mt-8">
      <h2 id="recap" className="text-lg font-semibold text-encre">
        Informations envoyées
      </h2>
      <dl className="mt-3 divide-y divide-trait border-y border-trait">
        {lignes.map(([terme, valeur]) => (
          <div key={terme} className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm text-discret">{terme}</dt>
            <dd className="mt-0.5 [overflow-wrap:anywhere] text-encre sm:col-span-2 sm:mt-0">{valeur}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export default function CompteEnAttente() {
  const session = useSession()
  const { state } = useLocation()

  if (session.etat === 'chargement') {
    return (
      <PageCompte titre="État de votre compte">
        <p role="status" className="flex items-center gap-3 text-texte">
          <Indicateur className="size-5 text-accent" />
          Chargement…
        </p>
      </PageCompte>
    )
  }

  if (session.etat === 'erreur') {
    return (
      <PageCompte titre="État de votre compte">
        <Alerte ton="erreur">{messageErreurGlobale(session.erreur)}</Alerte>
        <Bouton type="button" className="mt-6 w-full" onClick={session.recharger}>
          Réessayer
        </Bouton>
      </PageCompte>
    )
  }

  if (session.etat === 'deconnecte') {
    return (
      <PageCompte titre="État de votre compte">
        <p className="text-texte">
          <Link to="/connexion" className="font-medium text-accent underline underline-offset-2">
            Connectez-vous
          </Link>{' '}
          pour voir où en est la vérification de votre compte.
        </p>
      </PageCompte>
    )
  }

  const { utilisateur } = session

  if (utilisateur.statut === 'refuse') {
    return (
      <PageCompte titre="Votre compte n’a pas été validé">
        <Alerte ton="erreur" titre="Motif indiqué par notre équipe">
          <p className="whitespace-pre-line">{utilisateur.motifRefus || 'Aucun motif précisé.'}</p>
        </Alerte>
        <p className="mt-6 text-texte">
          Si vous pensez qu’il s’agit d’une erreur, répondez à l’email de décision que vous avez reçu.
        </p>
        <Recapitulatif utilisateur={utilisateur} />
      </PageCompte>
    )
  }

  if (utilisateur.statut === 'valide') {
    return (
      <PageCompte titre="Votre compte est validé">
        <Alerte ton="succes">Vous pouvez soumettre votre première application.</Alerte>
        <Recapitulatif utilisateur={utilisateur} />
      </PageCompte>
    )
  }

  if (utilisateur.statut === 'suspendu') {
    return (
      <PageCompte titre="Votre compte est suspendu">
        <p className="text-texte">Contactez notre équipe en répondant à l’email de suspension que vous avez reçu.</p>
      </PageCompte>
    )
  }

  return (
    <PageCompte titre="Votre compte est en attente de validation">
      {state?.vientDeVerifier && (
        <Alerte ton="succes" className="mb-6">
          Votre adresse email est confirmée.
        </Alerte>
      )}
      <div className="space-y-3 text-texte">
        <p>
          Notre équipe vérifie votre fiche développeur Google Play. Vous recevrez un email à{' '}
          <strong className="font-semibold [overflow-wrap:anywhere] text-encre">{utilisateur.email}</strong> dès qu’une décision sera prise.
        </p>
        <p>En attendant, vous ne pouvez pas encore soumettre d’application.</p>
      </div>
      <Recapitulatif utilisateur={utilisateur} />
    </PageCompte>
  )
}
