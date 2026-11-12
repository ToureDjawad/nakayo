import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { lireApp } from '../../api/apps.js'
import { ErreurApi } from '../../api/client.js'
import { lireOffres, payerApp } from '../../api/paiements.js'
import { Alerte } from '../../components/Alerte.jsx'
import { Bouton } from '../../components/Bouton.jsx'
import { Champ, ChoixRadio } from '../../components/Champ.jsx'
import { montantLisible } from '../../lib/format.js'
import { messageErreurGlobale } from '../../lib/messages.js'
import { useFormulaire } from '../../lib/useFormulaire.js'
import { normaliserWhatsapp, validerWhatsapp } from '../../lib/validation.js'
import { useChargement } from '../../lib/useChargement.js'
import { Chargement, EspaceDeveloppeur, PagePaiement, RetourCompte } from './commun.jsx'

const TITRE = 'Payer l’offre Standard'

const VALIDATEURS = {
  moyen: (v) => (v ? null : 'requis'),
  numeroMomo: (v, valeurs) => (valeurs.moyen === 'mobile_money' ? validerWhatsapp(v) : null),
}

function Formulaire({ app, offre }) {
  const navigate = useNavigate()
  const formulaire = useFormulaire({ moyen: '', numeroMomo: '' }, VALIDATEURS)
  const { valeurs, lier } = formulaire
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)
  const alerte = useRef(null)
  const prix = valeurs.moyen ? offre.prix[valeurs.moyen] : null

  useEffect(() => {
    if (erreur) alerte.current?.focus()
  }, [erreur])

  const options = [
    {
      valeur: 'carte',
      libelle: `Carte bancaire : ${montantLisible(offre.prix.carte.montant, offre.prix.carte.devise)}`,
      detail: 'Visa ou Mastercard, débitée en dollars américains.',
    },
    {
      valeur: 'mobile_money',
      libelle: `Mobile Money : ${montantLisible(offre.prix.mobile_money.montant, offre.prix.mobile_money.devise)}`,
      detail: 'MTN ou Moov. Vous validez le paiement sur votre téléphone.',
    },
  ]

  async function soumettre(e) {
    e.preventDefault()
    setErreur(null)
    if (!formulaire.validerTout()) return
    setEnvoi(true)
    try {
      const { redirection } = await payerApp(app.id, {
        moyen: valeurs.moyen,
        numeroMomo: valeurs.moyen === 'mobile_money' ? normaliserWhatsapp(valeurs.numeroMomo) : undefined,
      })
      navigate(redirection)
    } catch (err) {
      setEnvoi(false)
      if (err instanceof ErreurApi && err.champs) return formulaire.appliquerErreursServeur(err.champs)
      if (err instanceof ErreurApi && err.code === 'paiement_indisponible') {
        return setErreur('Le paiement en ligne n’est pas encore ouvert. Votre brouillon est conservé : nous vous prévenons par email dès l’ouverture.')
      }
      if (err instanceof ErreurApi && err.code === 'statut_incompatible') return setErreur('Cette app n’est plus en brouillon : son offre est déjà payée.')
      if (err instanceof ErreurApi && err.code === 'compte_non_valide') return setErreur('Votre compte doit être validé par l’équipe avant de payer une offre.')
      if (err instanceof ErreurApi && err.statut === 404) return setErreur('Cette app n’existe plus. Elle a peut-être été supprimée.')
      setErreur(messageErreurGlobale(err))
    }
  }

  return (
    <>
      <section aria-labelledby="titre-offre" className="rounded-carte border border-trait bg-white p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="titre-offre" className="text-lg font-semibold text-encre">
            {offre.nom}
          </h2>
          <p className="text-sm text-texte">
            pour <span className="font-semibold [overflow-wrap:anywhere] text-encre">{app.nom}</span>
          </p>
        </div>
        <p className="mt-1 text-texte">{offre.description}</p>
        <div className="mt-4 rounded-champ bg-succes-clair p-3 text-sm text-[#14522F]">
          <p className="font-semibold">Notre garantie</p>
          <p className="mt-0.5">{offre.garantie}</p>
        </div>
      </section>

      {erreur && (
        <Alerte ton="erreur" className="mt-6" ref={alerte}>
          {erreur}
        </Alerte>
      )}

      <form onSubmit={soumettre} noValidate className="mt-6 space-y-5">
        <ChoixRadio {...lier('moyen')} libelle="Moyen de paiement" options={options} />
        {valeurs.moyen === 'mobile_money' && (
          <Champ
            {...lier('numeroMomo')}
            libelle="Numéro Mobile Money"
            aide="Le numéro qui va payer, avec l’indicatif. Vous recevrez la demande de validation sur ce téléphone."
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="+229 01 97 00 00 00"
          />
        )}
        <div className="flex flex-col gap-3 sm:flex-row-reverse sm:justify-start">
          <Bouton chargement={envoi} libelleChargement="Redirection vers le paiement…" className="sm:min-w-56">
            {prix ? `Payer ${montantLisible(prix.montant, prix.devise)}` : 'Payer'}
          </Bouton>
          <Link
            to="/mon-compte"
            className="inline-flex h-11 items-center justify-center rounded-champ border border-trait bg-white px-[18px] text-[15px] font-semibold text-encre hover:bg-fond-doux"
          >
            Annuler
          </Link>
        </div>
        <p className="text-sm text-discret">
          Le paiement se fait chez notre prestataire de paiement : Nakayo ne voit jamais votre numéro de carte. Le reçu part par email et
          la facture reste disponible dans votre espace.
        </p>
      </form>
    </>
  )
}

function Paiement({ id, utilisateur }) {
  const { chargement, donnees, erreur, reessayer } = useChargement(
    async (signal) => {
      const [{ app }, { offres }] = await Promise.all([lireApp(id, { signal }), lireOffres({ signal })])
      return { app, offre: offres.find((o) => o.code === 'standard') ?? offres[0] }
    },
    id,
  )

  if (chargement) return <Chargement titre={TITRE} />
  if (erreur) {
    const absente = erreur instanceof ErreurApi && erreur.statut === 404
    return (
      <PagePaiement titre={TITRE} utilisateur={utilisateur}>
        <Alerte ton="erreur">{absente ? 'Cette app est introuvable. Elle a peut-être été supprimée.' : messageErreurGlobale(erreur)}</Alerte>
        {!absente && (
          <Bouton type="button" variante="secondaire" className="mt-4" onClick={reessayer}>
            Réessayer
          </Bouton>
        )}
        <RetourCompte />
      </PagePaiement>
    )
  }
  const { app, offre } = donnees
  if (app.statut !== 'brouillon') {
    return (
      <PagePaiement titre={app.nom} utilisateur={utilisateur}>
        <Alerte ton="info">L’offre de cette app est déjà payée.</Alerte>
        <p className="mt-6 text-texte">
          <Link to="/mon-compte/paiements" className="font-medium text-accent underline underline-offset-2">
            Voir vos paiements et factures
          </Link>
        </p>
        <RetourCompte className="mt-3" />
      </PagePaiement>
    )
  }
  return (
    <PagePaiement
      titre={TITRE}
      utilisateur={utilisateur}
     
      intro={<p>Une fois l’offre payée, l’app passe en vérification et ne peut plus être modifiée.</p>}
    >
      <Formulaire app={app} offre={offre} />
    </PagePaiement>
  )
}

// /mon-compte/apps/:id/paiement (US-12).
export default function PayerApp() {
  const { id } = useParams()
  return (
    <EspaceDeveloppeur
      titre={TITRE}
      suite={`/mon-compte/apps/${id}/paiement`}
      raison="pour payer l’offre de votre app."
      contenu={(utilisateur) =>
        utilisateur.statut === 'valide' ? (
          <Paiement id={id} utilisateur={utilisateur} />
        ) : (
          <PagePaiement titre={TITRE} utilisateur={utilisateur}>
            <Alerte ton="alerte">Votre compte doit être validé par l’équipe avant de payer une offre.</Alerte>
            <RetourCompte />
          </PagePaiement>
        )
      }
    />
  )
}
