import { Link } from 'react-router'
import { listerMesPaiements } from '../../api/paiements.js'
import { Alerte } from '../../components/Alerte.jsx'
import { Bouton } from '../../components/Bouton.jsx'
import { dateHeure, montantLisible } from '../../lib/format.js'
import { messageErreurGlobale } from '../../lib/messages.js'
import { BoutonFacture } from './BoutonFacture.jsx'
import { MOYENS } from '../../lib/paiements.js'
import { useChargement } from '../../lib/useChargement.js'
import { Chargement, EspaceDeveloppeur, PagePaiement, PastilleStatut, RetourCompte } from './commun.jsx'

const TITRE = 'Paiements et factures'

function Historique({ utilisateur }) {
  const { chargement, donnees, erreur, reessayer } = useChargement((signal) => listerMesPaiements({ signal }), 'paiements')

  if (chargement) return <Chargement titre={TITRE} />
  if (erreur) {
    return (
      <PagePaiement titre={TITRE} utilisateur={utilisateur}>
        <Alerte ton="erreur">{messageErreurGlobale(erreur)}</Alerte>
        <Bouton type="button" variante="secondaire" className="mt-4" onClick={reessayer}>
          Réessayer
        </Bouton>
        <RetourCompte />
      </PagePaiement>
    )
  }
  const { paiements } = donnees
  const reussis = paiements.filter((p) => p.statut === 'reussi')

  return (
    <PagePaiement
      titre={TITRE}
      utilisateur={utilisateur}
     
      intro={<p>Chaque paiement réussi a sa facture. Le reçu a aussi été envoyé par email au moment du paiement.</p>}
    >
      {paiements.length === 0 ? (
        <p className="text-texte">Vous n’avez encore effectué aucun paiement.</p>
      ) : (
        <>
          <p className="text-sm text-texte">
            {reussis.length === 0
              ? 'Aucun paiement réussi pour le moment.'
              : `${reussis.length} ${reussis.length > 1 ? 'paiements réussis' : 'paiement réussi'}.`}
          </p>
          <ul className="mt-3 space-y-3">
            {paiements.map((p) => (
              <li key={p.reference} className="rounded-carte border border-trait bg-white p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold [overflow-wrap:anywhere] text-encre">{p.appNom}</p>
                  <PastilleStatut statut={p.statut} />
                </div>
                <p className="mt-1 text-encre">
                  <span className="font-semibold tabular-nums">{montantLisible(p.montant, p.devise)}</span>
                  <span className="text-texte"> · {MOYENS[p.moyen] ?? p.moyen}</span>
                </p>
                <p className="mt-0.5 text-sm text-discret">
                  {dateHeure(p.confirmeLe ?? p.creeLe)} · <span className="font-mono [overflow-wrap:anywhere]">{p.reference}</span>
                </p>
                {p.facture && (
                  <div className="mt-3">
                    <BoutonFacture numero={p.facture} compact />
                  </div>
                )}
                {p.statut === 'en_attente' && (
                  <Link
                    to={`/mon-compte/paiements/${p.reference}`}
                    aria-label={`Suivre le paiement ${p.reference}`}
                    className="mt-2 inline-block text-sm font-semibold text-accent underline underline-offset-2"
                  >
                    Suivre le paiement
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      <RetourCompte />
    </PagePaiement>
  )
}

// /mon-compte/paiements : historique et factures (US-15).
export default function MesPaiements() {
  return (
    <EspaceDeveloppeur
      titre={TITRE}
      suite="/mon-compte/paiements"
      raison="pour voir vos paiements et vos factures."
      contenu={(utilisateur) => <Historique utilisateur={utilisateur} />}
    />
  )
}
