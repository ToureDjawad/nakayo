import { Link, useLocation } from 'react-router'
import { Alerte } from '../../components/Alerte.jsx'
import { Bouton, Indicateur } from '../../components/Bouton.jsx'
import { ContactWhatsapp } from '../../components/ContactWhatsapp.jsx'
import { BoiteIcone, PageCompte, PanneauEtapes } from '../../components/MiseEnPage.jsx'
import { messageErreurGlobale } from '../../lib/messages.js'
import { nomPays } from '../../lib/pays.js'
import { useSession } from '../../lib/useSession.js'
import { MesApps } from '../apps/MesApps.jsx'

const PANNEAU_VERIFICATION = (
  <PanneauEtapes
    titre="Pourquoi on vérifie"
    etapes={[
      { titre: 'Protéger les testeurs', detail: 'Pas d’apps frauduleuses ou interdites dans leur téléphone.' },
      { titre: 'Protéger votre campagne', detail: 'Un compte réel, une app réelle, un test qui compte pour Google.' },
    ]}
  />
)

function Icone({ d, className = 'size-[18px]' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d.map((chemin) => (
        <path key={chemin} d={chemin} />
      ))}
    </svg>
  )
}

const HORLOGE = ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'M12 6v6l4 2']
const COCHE = ['M20 6 9 17l-5-5']
const CADENAS = ['M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z', 'M7 11V7a5 5 0 0 1 10 0v4']

// Étapes du compte (D04) : faites, en cours, à venir.
function Etapes() {
  const etapes = [
    { texte: 'Email confirmé', etat: 'fait' },
    { texte: 'Vérification de la fiche développeur', etat: 'en_cours' },
    { texte: 'Paiement et lancement de campagne', etat: 'a_venir' },
  ]
  const styles = {
    fait: ['text-succes', COCHE, 'text-encre'],
    en_cours: ['text-alerte', HORLOGE, 'text-encre'],
    a_venir: ['text-discret', CADENAS, 'text-discret'],
  }
  return (
    <ol className="space-y-2.5">
      {etapes.map(({ texte, etat }) => {
        const [teinte, icone, couleurTexte] = styles[etat]
        return (
          <li key={texte} className="flex items-center gap-3 rounded-champ border border-trait bg-white px-4 py-3 text-sm">
            <span className={teinte}>
              <Icone d={icone} />
            </span>
            <span className={couleurTexte}>{texte}</span>
            <span className="sr-only">{etat === 'fait' ? '(fait)' : etat === 'en_cours' ? '(en cours)' : '(à venir)'}</span>
          </li>
        )
      })}
    </ol>
  )
}

// Aide (US-40) : formulaire vers l'équipe, et WhatsApp si un numéro est publié.
function AideSupport({ utilisateur }) {
  return (
    <section aria-labelledby="titre-aide" className="mt-6 rounded-carte border border-trait bg-white p-4">
      <h2 id="titre-aide" className="text-base font-semibold text-encre">
        Une question ?
      </h2>
      <p className="mt-1 text-sm text-texte">Écrivez à l’équipe Nakayo, nous vous répondons par email.</p>
      <Link
        to="/mon-compte/support"
        className="mt-3 inline-flex h-11 items-center rounded-champ border border-trait bg-white px-4 text-[15px] font-semibold text-encre hover:bg-fond-doux"
      >
        Écrire à l’équipe
      </Link>
      <ContactWhatsapp utilisateur={utilisateur} compact className="mt-4 border-t border-trait pt-4" />
    </section>
  )
}

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
          <Link to="/connexion?suite=%2Fmon-compte" className="font-medium text-accent underline underline-offset-2">
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
      <PageCompte titre="Votre compte n’a pas été validé" utilisateur={utilisateur} panneau={PANNEAU_VERIFICATION}>
        <Alerte ton="erreur" titre="Motif indiqué par notre équipe">
          <p className="whitespace-pre-line">{utilisateur.motifRefus || 'Aucun motif précisé.'}</p>
        </Alerte>
        <p className="mt-6 text-texte">
          Si vous pensez qu’il s’agit d’une erreur, répondez à l’email de décision que vous avez reçu.
        </p>
        <AideSupport utilisateur={utilisateur} />
        <Recapitulatif utilisateur={utilisateur} />
      </PageCompte>
    )
  }

  if (utilisateur.statut === 'valide') {
    return (
      <PageCompte
        titre="Votre compte est validé"
        utilisateur={utilisateur}
        icone={
          <BoiteIcone ton="vert">
            <Icone d={COCHE} className="size-6" />
          </BoiteIcone>
        }
      >
        {state?.appEnregistree && (
          <Alerte ton="succes" className="mb-6" titre={state.modification ? 'Modifications enregistrées' : 'Brouillon enregistré'}>
            « {state.appEnregistree} » est enregistrée. Vous pourrez encore la modifier jusqu’au paiement de l’offre.
          </Alerte>
        )}
        {state?.appSupprimee && (
          <Alerte ton="succes" className="mb-6">
            « {state.appSupprimee} » a été supprimée.
          </Alerte>
        )}
        <p className="text-texte">Soumettez votre app : nous lançons la campagne de test une fois l’offre payée et l’app vérifiée.</p>
        <MesApps />
        <AideSupport utilisateur={utilisateur} />
        <Recapitulatif utilisateur={utilisateur} />
      </PageCompte>
    )
  }

  if (utilisateur.statut === 'suspendu') {
    return (
      <PageCompte titre="Votre compte est suspendu" utilisateur={utilisateur}>
        <p className="text-texte">Contactez notre équipe en répondant à l’email de suspension que vous avez reçu.</p>
        <AideSupport utilisateur={utilisateur} />
      </PageCompte>
    )
  }

  return (
    <PageCompte
      titre="Votre compte est en cours de vérification"
      utilisateur={utilisateur}
      icone={
        <BoiteIcone>
          <Icone d={HORLOGE} className="size-6" />
        </BoiteIcone>
      }
      panneau={PANNEAU_VERIFICATION}
    >
      {state?.vientDeVerifier && (
        <Alerte ton="succes" className="mb-6">
          Votre adresse email est confirmée.
        </Alerte>
      )}
      <p className="text-texte">
        Merci. Nous vérifions votre fiche Google Play « {utilisateur.nom} ». Vous recevrez un email à{' '}
        <strong className="font-semibold [overflow-wrap:anywhere] text-encre">{utilisateur.email}</strong> sous 24 h ouvrées.
      </p>
      <div className="mt-6">
        <Etapes />
      </div>
      <AideSupport utilisateur={utilisateur} />
      <Recapitulatif utilisateur={utilisateur} />
    </PageCompte>
  )
}
