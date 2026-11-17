import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { lireAbonnement, payerAbonnement } from '../../api/abonnement.js'
import { ErreurApi } from '../../api/client.js'
import { Alerte } from '../../components/Alerte.jsx'
import { Bouton } from '../../components/Bouton.jsx'
import { Champ, ChoixRadio } from '../../components/Champ.jsx'
import { FUSEAU_BENIN, montantLisible } from '../../lib/format.js'
import { messageErreurGlobale } from '../../lib/messages.js'
import { ouvrirPageFournisseur } from '../../lib/paiements.js'
import { useChargement } from '../../lib/useChargement.js'
import { useFormulaire } from '../../lib/useFormulaire.js'
import { normaliserWhatsapp, validerWhatsapp } from '../../lib/validation.js'
import { Chargement, EspaceDeveloppeur, PagePaiement, RetourCompte } from './commun.jsx'

const TITRE = 'Abonnement Agence'

const formatJour = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: FUSEAU_BENIN })
const jour = (iso) => formatJour.format(new Date(iso))

const STATUTS = {
  actif: ['Actif', 'bg-succes-clair text-[#14522F]'],
  en_grace: ['Échéance passée', 'bg-alerte-clair text-encre'],
  suspendu: ['Suspendu', 'bg-erreur-clair text-erreur'],
}

const VALIDATEURS = {
  moyen: (v) => (v ? null : 'requis'),
  numeroMomo: (v, valeurs) => (valeurs.moyen === 'mobile_money' ? validerWhatsapp(v) : null),
  telephoneRappels: (v, valeurs) => (valeurs.moyen === 'carte' && v ? validerWhatsapp(v) : null),
}

const MESSAGES_ERREUR = {
  paiement_indisponible: 'Le paiement en ligne n’est pas encore ouvert.',
  compte_non_valide: 'Votre compte doit être validé par l’équipe avant de vous abonner.',
  renouvellement_trop_tot: 'Le renouvellement s’ouvre 7 jours avant l’échéance.',
  fournisseur_indisponible: 'Le service de paiement ne répond pas pour le moment. Aucun montant n’a été prélevé : réessayez dans quelques minutes.',
}

function Etat({ abonnement }) {
  const [libelle, couleurs] = STATUTS[abonnement.statut]
  return (
    <section aria-labelledby="titre-etat" className="rounded-carte border border-trait bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="titre-etat" className="text-lg font-semibold text-encre">
          Votre abonnement
        </h2>
        <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${couleurs}`}>{libelle}</span>
      </div>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-discret">Prochaine échéance</dt>
          <dd className="font-semibold text-encre">{jour(abonnement.echeance)}</dd>
        </div>
        <div>
          <dt className="text-discret">Campagnes du mois</dt>
          <dd className="font-semibold text-encre">
            {`${abonnement.campagnesRestantes} sur ${abonnement.campagnesIncluses} ${abonnement.campagnesRestantes > 1 ? 'disponibles' : 'disponible'}`}
          </dd>
        </div>
      </dl>
      {abonnement.statut === 'en_grace' && (
        <Alerte ton="alerte" className="mt-4">
          L’échéance est passée. Renouvelez avant le {jour(abonnement.finGrace)} : ensuite, l’abonnement est suspendu. Vos campagnes en
          cours continuent dans tous les cas.
        </Alerte>
      )}
      {abonnement.statut === 'suspendu' && (
        <Alerte ton="erreur" className="mt-4">
          Votre abonnement est suspendu. Vos campagnes en cours continuent ; renouvelez-le pour en lancer de nouvelles.
        </Alerte>
      )}
    </section>
  )
}

function Formulaire({ offre, renouvellement }) {
  const navigate = useNavigate()
  const formulaire = useFormulaire({ moyen: '', numeroMomo: '', telephoneRappels: '' }, VALIDATEURS)
  const { valeurs, lier } = formulaire
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)
  const alerte = useRef(null)

  useEffect(() => {
    if (erreur) alerte.current?.focus()
  }, [erreur])

  const moyens = [
    {
      valeur: 'carte',
      libelle: `Carte bancaire : ${offre.prix.carte.lisible ?? montantLisible(offre.prix.carte.montant, offre.prix.carte.devise)} par mois`,
      detail: 'Visa ou Mastercard. Vous validez chaque mois : aucun prélèvement automatique.',
    },
    {
      valeur: 'mobile_money',
      libelle: `Mobile Money : ${offre.prix.mobile_money.lisible ?? montantLisible(offre.prix.mobile_money.montant, offre.prix.mobile_money.devise)} par mois`,
      detail: 'MTN ou Moov. Vous validez le paiement sur votre téléphone, chaque mois.',
    },
  ]

  async function soumettre(e) {
    e.preventDefault()
    setErreur(null)
    if (!formulaire.validerTout()) return
    setEnvoi(true)
    try {
      const { redirection } = await payerAbonnement({
        moyen: valeurs.moyen,
        numeroMomo: valeurs.moyen === 'mobile_money' ? normaliserWhatsapp(valeurs.numeroMomo) : undefined,
        telephoneRappels: valeurs.moyen === 'carte' && valeurs.telephoneRappels ? normaliserWhatsapp(valeurs.telephoneRappels) : undefined,
      })
      if (/^https?:\/\//.test(redirection)) ouvrirPageFournisseur(redirection)
      else navigate(redirection)
    } catch (err) {
      setEnvoi(false)
      if (err instanceof ErreurApi && err.champs) return formulaire.appliquerErreursServeur(err.champs)
      if (err instanceof ErreurApi && MESSAGES_ERREUR[err.code]) return setErreur(MESSAGES_ERREUR[err.code])
      setErreur(messageErreurGlobale(err))
    }
  }

  return (
    <form onSubmit={soumettre} noValidate className="mt-6 space-y-5" aria-label={renouvellement ? 'Renouveler l’abonnement' : 'S’abonner'}>
      {erreur && (
        <Alerte ton="erreur" ref={alerte}>
          {erreur}
        </Alerte>
      )}
      <ChoixRadio {...lier('moyen')} libelle="Moyen de paiement" options={moyens} />
      {valeurs.moyen === 'mobile_money' && (
        <Champ
          {...lier('numeroMomo')}
          libelle="Numéro Mobile Money"
          aide="Le numéro qui va payer, avec l’indicatif. Les rappels d’échéance arrivent aussi sur ce numéro."
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder="+229 01 97 00 00 00"
        />
      )}
      {valeurs.moyen === 'carte' && (
        <Champ
          {...lier('telephoneRappels')}
          libelle="Numéro pour les rappels par SMS (facultatif)"
          aide="Nous vous prévenons 3 jours avant l’échéance et le jour même, par email et par SMS."
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder="+229 01 97 00 00 00"
        />
      )}
      <Bouton chargement={envoi} libelleChargement="Redirection vers le paiement…" className="w-full sm:w-auto sm:min-w-56">
        {renouvellement ? 'Renouveler pour un mois' : 'Payer le premier mois'}
      </Bouton>
    </form>
  )
}

function Contenu({ utilisateur }) {
  const { chargement, donnees, erreur, reessayer } = useChargement((signal) => lireAbonnement({ signal }), 'abonnement')
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
  const { abonnement, offre } = donnees
  const peutPayer = !abonnement || abonnement.renouvelable
  return (
    <PagePaiement
      titre={TITRE}
      utilisateur={utilisateur}
      intro={
        <p>
          Pour les agences et studios : {offre.campagnes} campagnes Standard par mois sans repayer à chaque app. Les campagnes non
          utilisées ne sont pas reportées ; les offres Pro et Plus restent payées à part.
        </p>
      }
    >
      {abonnement && <Etat abonnement={abonnement} />}
      {utilisateur.statut !== 'valide' ? (
        <Alerte ton="alerte" className="mt-6">
          Votre compte doit être validé par l’équipe avant de vous abonner.
        </Alerte>
      ) : peutPayer ? (
        <Formulaire offre={offre} renouvellement={Boolean(abonnement)} />
      ) : (
        <p className="mt-6 text-sm text-texte">Le renouvellement s’ouvre 7 jours avant l’échéance. Nous vous prévenons par email et par SMS.</p>
      )}
      <p className="mt-6 text-sm text-discret">
        Les factures de l’abonnement sont avec vos autres paiements. Après l’échéance, vous avez {offre.graceJours} jours pour renouveler ;
        ensuite, l’abonnement est suspendu, mais les campagnes déjà lancées continuent.
      </p>
      <RetourCompte />
    </PagePaiement>
  )
}

// /mon-compte/abonnement : état, échéance, souscription et renouvellement (US-45).
export default function Abonnement() {
  return (
    <EspaceDeveloppeur
      titre={TITRE}
      suite="/mon-compte/abonnement"
      raison="pour gérer votre abonnement."
      contenu={(utilisateur) => <Contenu utilisateur={utilisateur} />}
    />
  )
}
