import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { ErreurApi } from '../../api/client.js'
import { lirePaiement, simulerPaiement } from '../../api/paiements.js'
import { Alerte } from '../../components/Alerte.jsx'
import { Bouton } from '../../components/Bouton.jsx'
import { montantLisible } from '../../lib/format.js'
import { messageErreurGlobale } from '../../lib/messages.js'
import { MOYENS } from '../../lib/paiements.js'
import { useChargement } from '../../lib/useChargement.js'
import { Chargement, EspaceDeveloppeur, PagePaiement, RetourCompte } from './commun.jsx'

const TITRE = 'Paiement simulé'

// Remplace la page du prestataire tant que les comptes marchands ne sont pas ouverts (docs/api-sprint2.md §2.3).
function Simulation({ reference, utilisateur }) {
  const navigate = useNavigate()
  const { chargement, donnees, erreur, reessayer } = useChargement((signal) => lirePaiement(reference, { signal }), reference)
  const [envoi, setEnvoi] = useState(null)
  const [erreurEnvoi, setErreurEnvoi] = useState(null)

  if (chargement) return <Chargement titre={TITRE} />
  if (erreur) {
    const absent = erreur instanceof ErreurApi && erreur.statut === 404
    return (
      <PagePaiement titre={TITRE} utilisateur={utilisateur}>
        <Alerte ton="erreur">{absent ? 'Ce paiement est introuvable.' : messageErreurGlobale(erreur)}</Alerte>
        {!absent && (
          <Bouton type="button" variante="secondaire" className="mt-4" onClick={reessayer}>
            Réessayer
          </Bouton>
        )}
        <RetourCompte />
      </PagePaiement>
    )
  }
  const { paiement } = donnees
  if (paiement.statut !== 'en_attente') return <Navigate to={`/mon-compte/paiements/${paiement.reference}`} replace />

  async function choisir(resultat) {
    setEnvoi(resultat)
    setErreurEnvoi(null)
    try {
      const { paiement: suivant } = await simulerPaiement(paiement.reference, resultat)
      navigate(`/mon-compte/paiements/${suivant.reference}`, { replace: true, state: { paiement: suivant } })
    } catch (err) {
      setEnvoi(null)
      setErreurEnvoi(
        err instanceof ErreurApi && err.statut === 404
          ? 'La simulation n’est pas disponible sur ce serveur.'
          : messageErreurGlobale(err),
      )
    }
  }

  const lignes = [
    ['App', paiement.appNom],
    ['Montant', montantLisible(paiement.montant, paiement.devise)],
    ['Moyen', MOYENS[paiement.moyen] ?? paiement.moyen],
    ['Référence', paiement.reference],
  ]

  return (
    <PagePaiement titre={TITRE} utilisateur={utilisateur}>
      <Alerte ton="alerte" titre="Environnement de test">
        Aucun argent n’est débité. Cette page remplace celle du prestataire de paiement : choisissez l’issue du paiement pour vérifier
        la suite du parcours.
      </Alerte>
      <dl className="mt-6 divide-y divide-trait border-y border-trait">
        {lignes.map(([terme, valeur]) => (
          <div key={terme} className="py-3 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm text-discret">{terme}</dt>
            <dd className="mt-0.5 [overflow-wrap:anywhere] text-encre sm:col-span-2 sm:mt-0">{valeur}</dd>
          </div>
        ))}
      </dl>
      {erreurEnvoi && (
        <Alerte ton="erreur" className="mt-6">
          {erreurEnvoi}
        </Alerte>
      )}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Bouton
          type="button"
          chargement={envoi === 'reussi'}
          libelleChargement="Confirmation…"
          disabled={envoi !== null}
          onClick={() => choisir('reussi')}
        >
          Confirmer le paiement
        </Bouton>
        <Bouton
          type="button"
          variante="secondaire"
          chargement={envoi === 'echoue'}
          libelleChargement="Refus…"
          disabled={envoi !== null}
          onClick={() => choisir('echoue')}
        >
          Refuser le paiement
        </Bouton>
      </div>
    </PagePaiement>
  )
}

// /paiement/simulation/:reference
export default function SimulationPaiement() {
  const { reference } = useParams()
  return (
    <EspaceDeveloppeur
      titre={TITRE}
      suite={`/paiement/simulation/${reference}`}
      raison="pour terminer votre paiement."
      contenu={(utilisateur) => <Simulation reference={reference} utilisateur={utilisateur} />}
    />
  )
}
