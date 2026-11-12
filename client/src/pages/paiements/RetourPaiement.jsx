import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { ErreurApi } from '../../api/client.js'
import { lirePaiement } from '../../api/paiements.js'
import { Alerte } from '../../components/Alerte.jsx'
import { Bouton, Indicateur } from '../../components/Bouton.jsx'
import { montantLisible } from '../../lib/format.js'
import { messageErreurGlobale } from '../../lib/messages.js'
import { BoutonFacture } from './BoutonFacture.jsx'
import { LIEN_BOUTON } from '../../lib/paiements.js'
import { EspaceDeveloppeur, PagePaiement, RetourCompte } from './commun.jsx'

const TITRE = 'Votre paiement'
// Le fournisseur confirme par webhook : la page interroge l'API jusqu'à la réponse, une minute au plus.
const DELAI_SONDAGE_MS = import.meta.env.MODE === 'test' ? 10 : 3000
const ESSAIS_MAX = 20

function usePaiementSuivi(reference, initial) {
  const [etat, setEtat] = useState({ paiement: initial ?? null, erreur: null, essais: 0 })
  const [relance, setRelance] = useState(0)
  const attente = !etat.paiement || etat.paiement.statut === 'en_attente'
  const epuise = etat.essais >= ESSAIS_MAX

  useEffect(() => {
    if (!attente || epuise || etat.erreur) return undefined
    const controleur = new AbortController()
    const delai = etat.essais === 0 && !etat.paiement ? 0 : DELAI_SONDAGE_MS
    const minuterie = setTimeout(() => {
      lirePaiement(reference, { signal: controleur.signal })
        .then(({ paiement }) => setEtat((e) => ({ paiement, erreur: null, essais: e.essais + 1 })))
        .catch((erreur) => {
          if (!controleur.signal.aborted) setEtat((e) => ({ ...e, erreur, essais: e.essais + 1 }))
        })
    }, delai)
    return () => {
      clearTimeout(minuterie)
      controleur.abort()
    }
  }, [reference, attente, epuise, etat.erreur, etat.essais, etat.paiement, relance])

  const reessayer = () => {
    setEtat((e) => ({ ...e, erreur: null, essais: 0 }))
    setRelance((n) => n + 1)
  }
  return { ...etat, attente, epuise, reessayer }
}

function Suivi({ reference, utilisateur, initial }) {
  const { paiement, erreur, attente, epuise, reessayer } = usePaiementSuivi(reference, initial)

  if (erreur && !paiement) {
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
  if (!paiement) {
    return (
      <PagePaiement titre={TITRE} utilisateur={utilisateur}>
        <p role="status" className="flex items-center gap-3 text-texte">
          <Indicateur className="size-5 text-accent" />
          Chargement…
        </p>
      </PagePaiement>
    )
  }

  const montant = montantLisible(paiement.montant, paiement.devise)

  if (attente) {
    return (
      <PagePaiement titre="Paiement en cours" utilisateur={utilisateur}>
        {epuise || erreur ? (
          <>
            <Alerte ton="alerte" titre="Pas encore de confirmation">
              Le prestataire n’a pas encore confirmé votre paiement de {montant}. Vous recevrez le reçu par email dès qu’il sera
              confirmé : inutile de payer une seconde fois.
            </Alerte>
            <Bouton type="button" variante="secondaire" className="mt-4" onClick={reessayer}>
              Vérifier à nouveau
            </Bouton>
          </>
        ) : (
          <p role="status" className="flex items-center gap-3 text-texte">
            <Indicateur className="size-5 text-accent" />
            Nous attendons la confirmation de votre paiement de {montant}…
          </p>
        )}
        <RetourCompte />
      </PagePaiement>
    )
  }

  if (paiement.statut === 'reussi') {
    return (
      <PagePaiement titre="Paiement reçu, merci" utilisateur={utilisateur}>
        <Alerte ton="succes" titre={`${montant} payés pour « ${paiement.appNom} »`}>
          Le reçu vient de partir par email. L’équipe vérifie votre app sous 24 h ouvrées, puis lance la campagne de test.
        </Alerte>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link to="/mon-compte" className={LIEN_BOUTON}>
            Retour à mon compte
          </Link>
          {paiement.facture && <BoutonFacture numero={paiement.facture} />}
        </div>
      </PagePaiement>
    )
  }

  if (paiement.statut === 'echoue') {
    return (
      <PagePaiement titre="Le paiement n’a pas abouti" utilisateur={utilisateur}>
        <Alerte ton="erreur">
          Aucun montant n’a été prélevé. Votre app « {paiement.appNom} » reste en brouillon : vous pouvez réessayer, avec le même moyen de
          paiement ou un autre.
        </Alerte>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link to={`/mon-compte/apps/${paiement.appId}/paiement`} className={LIEN_BOUTON}>
            Réessayer le paiement
          </Link>
        </div>
        <RetourCompte />
      </PagePaiement>
    )
  }

  return (
    <PagePaiement titre={TITRE} utilisateur={utilisateur}>
      <Alerte ton="info">
        {paiement.statut === 'doublon'
          ? `L’offre de « ${paiement.appNom} » était déjà payée. Ce second paiement de ${montant} vous sera remboursé : inutile de nous écrire.`
          : `Ce paiement de ${montant} a été remboursé.`}
      </Alerte>
      <RetourCompte />
    </PagePaiement>
  )
}

// /mon-compte/paiements/:reference : retour du prestataire de paiement (US-12).
export default function RetourPaiement() {
  const { reference } = useParams()
  const { state } = useLocation()
  const initial = state?.paiement?.reference === reference ? state.paiement : null
  return (
    <EspaceDeveloppeur
      titre={TITRE}
      suite={`/mon-compte/paiements/${reference}`}
      raison="pour voir où en est votre paiement."
      contenu={(utilisateur) => <Suivi key={reference} reference={reference} utilisateur={utilisateur} initial={initial} />}
    />
  )
}
