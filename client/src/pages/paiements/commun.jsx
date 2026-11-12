import { Link } from 'react-router'
import { Alerte } from '../../components/Alerte.jsx'
import { Bouton, Indicateur } from '../../components/Bouton.jsx'
import { PageCompte, PanneauEtapes } from '../../components/MiseEnPage.jsx'
import { messageErreurGlobale } from '../../lib/messages.js'
import { STATUTS_PAIEMENT } from '../../lib/paiements.js'
import { useSession } from '../../lib/useSession.js'


export function PastilleStatut({ statut }) {
  const [libelle, couleurs] = STATUTS_PAIEMENT[statut] ?? [statut, 'bg-fond-doux text-encre']
  return <span className={`rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${couleurs}`}>{libelle}</span>
}

const PANNEAU_PAIEMENT = (
  <PanneauEtapes
    titre="Un paiement, une campagne complète"
    etapes={[
      { titre: 'Paiement de l’offre', detail: 'Par carte en dollars, ou par Mobile Money en FCFA.' },
      { titre: 'Reçu et facture', detail: 'Le reçu part par email, la facture reste dans votre espace.' },
      { titre: 'Vérification par l’équipe', detail: 'Sous 24 h ouvrées, avant le lancement de la campagne.' },
    ]}
  />
)

export function Chargement({ titre, texte = 'Chargement…' }) {
  return (
    <PageCompte titre={titre} panneau={PANNEAU_PAIEMENT}>
      <p role="status" className="flex items-center gap-3 text-texte">
        <Indicateur className="size-5 text-accent" />
        {texte}
      </p>
    </PageCompte>
  )
}

export function RetourCompte({ className = 'mt-8' }) {
  return (
    <p className={`${className} text-texte`}>
      <Link to="/mon-compte" className="font-medium text-accent underline underline-offset-2">
        Retour à mon compte
      </Link>
    </p>
  )
}

// Mise en page commune des pages de paiement, avec le panneau des étapes.
export function PagePaiement(props) {
  return <PageCompte panneau={PANNEAU_PAIEMENT} {...props} />
}

// Garde commune des pages de paiement : session chargée, compte développeur.
// `contenu(utilisateur)` n'est rendu que pour un développeur connecté.
export function EspaceDeveloppeur({ titre, suite, raison, contenu }) {
  const session = useSession()
  if (session.etat === 'chargement') return <Chargement titre={titre} />
  if (session.etat === 'erreur') {
    return (
      <PageCompte titre={titre} panneau={PANNEAU_PAIEMENT}>
        <Alerte ton="erreur">{messageErreurGlobale(session.erreur)}</Alerte>
        <Bouton type="button" className="mt-6 w-full" onClick={session.recharger}>
          Réessayer
        </Bouton>
      </PageCompte>
    )
  }
  if (session.etat === 'deconnecte') {
    return (
      <PageCompte titre={titre} panneau={PANNEAU_PAIEMENT}>
        <p className="text-texte">
          <Link to={`/connexion?suite=${encodeURIComponent(suite)}`} className="font-medium text-accent underline underline-offset-2">
            Connectez-vous
          </Link>{' '}
          {raison}
        </p>
      </PageCompte>
    )
  }
  if (session.utilisateur.role !== 'developpeur') {
    return (
      <PageCompte titre={titre} utilisateur={session.utilisateur} panneau={PANNEAU_PAIEMENT}>
        <p className="text-texte">Cette page est réservée aux comptes développeur.</p>
      </PageCompte>
    )
  }
  return contenu(session.utilisateur)
}
