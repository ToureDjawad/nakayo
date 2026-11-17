import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { lireAbonnement, utiliserAbonnement } from '../../api/abonnement.js'
import { lireApp, lireDevis } from '../../api/apps.js'
import { ErreurApi } from '../../api/client.js'
import { lireOffres, monterEnGamme, payerApp } from '../../api/paiements.js'
import { Alerte } from '../../components/Alerte.jsx'
import { Bouton } from '../../components/Bouton.jsx'
import { Champ, ChoixRadio } from '../../components/Champ.jsx'
import { montantLisible } from '../../lib/format.js'
import { messageErreurGlobale } from '../../lib/messages.js'
import { ouvrirPageFournisseur } from '../../lib/paiements.js'
import { useFormulaire } from '../../lib/useFormulaire.js'
import { normaliserWhatsapp, validerWhatsapp } from '../../lib/validation.js'
import { useChargement } from '../../lib/useChargement.js'
import { Chargement, EspaceDeveloppeur, PagePaiement, RetourCompte } from './commun.jsx'

const TITRE = 'Payer l’offre de votre app'
const TITRE_MONTEE = 'Passer à l’Offre Pro'

const VALIDATEURS = {
  offre: (v) => (v ? null : 'requis'),
  moyen: (v) => (v ? null : 'requis'),
  numeroMomo: (v, valeurs) => (valeurs.moyen === 'mobile_money' ? validerWhatsapp(v) : null),
}

const MESSAGES_ERREUR = {
  paiement_indisponible: 'Le paiement en ligne n’est pas encore ouvert. Votre app est conservée : nous vous prévenons par email dès l’ouverture.',
  compte_non_valide: 'Votre compte doit être validé par l’équipe avant de payer une offre.',
  deja_dans_cette_offre: 'Votre app est déjà en Offre Pro.',
  devis_requis: 'Le prix de l’Offre Plus dépend de votre besoin : demandez d’abord un devis.',
  campagne_terminee: 'La campagne de cette app est terminée : elle ne peut plus changer d’offre.',
  fournisseur_indisponible: 'Le service de paiement ne répond pas pour le moment. Aucun montant n’a été prélevé : réessayez dans quelques minutes.',
}

// Prix affichés : l'offre entière, ou la différence de prix pour une montée en gamme.
const tarifs = (offre, montee) => (montee ? offre.monteeEnGamme : offre)

// `offres` : les offres proposées ; une seule pour la montée en gamme (Pro).
function Formulaire({ app, offres, offreInitiale, montee = false }) {
  const navigate = useNavigate()
  const formulaire = useFormulaire({ offre: offreInitiale, moyen: '', numeroMomo: '' }, VALIDATEURS)
  const { valeurs, lier } = formulaire
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)
  const alerte = useRef(null)
  const offre = offres.find((o) => o.code === valeurs.offre) ?? offres[0]
  const tarif = tarifs(offre, montee)
  // Montant réellement débité : en FCFA pour la carte quand FedaPay encaisse.
  const prix = valeurs.moyen === 'carte' && tarif.debitCarte ? tarif.debitCarte : valeurs.moyen ? tarif.prix[valeurs.moyen] : null

  useEffect(() => {
    if (erreur) alerte.current?.focus()
  }, [erreur])

  const choixOffres = offres.map((o) => ({
    valeur: o.code,
    libelle: `${o.nom}${o.surDevis ? ' (votre devis)' : ''} : ${montantLisible(o.prix.mobile_money.montant, o.prix.mobile_money.devise)} ou ${montantLisible(o.prix.carte.montant, o.prix.carte.devise)}`,
    detail: o.description,
  }))

  const moyens = [
    {
      valeur: 'carte',
      libelle: `Carte bancaire : ${montantLisible(tarif.prix.carte.montant, tarif.prix.carte.devise)}`,
      // Avec FedaPay, la carte est débitée en FCFA (même valeur, 1 $ = 600 FCFA).
      detail: tarif.debitCarte
        ? `Visa ou Mastercard, débitée en FCFA : ${montantLisible(tarif.debitCarte.montant, tarif.debitCarte.devise)}.`
        : 'Visa ou Mastercard, débitée en dollars américains.',
    },
    {
      valeur: 'mobile_money',
      libelle: `Mobile Money : ${montantLisible(tarif.prix.mobile_money.montant, tarif.prix.mobile_money.devise)}`,
      detail: 'MTN ou Moov. Vous validez le paiement sur votre téléphone.',
    },
  ]

  async function soumettre(e) {
    e.preventDefault()
    setErreur(null)
    if (!formulaire.validerTout()) return
    setEnvoi(true)
    try {
      const demande = {
        offre: offre.code,
        moyen: valeurs.moyen,
        numeroMomo: valeurs.moyen === 'mobile_money' ? normaliserWhatsapp(valeurs.numeroMomo) : undefined,
      }
      const { redirection } = await (montee ? monterEnGamme(app.id, demande) : payerApp(app.id, demande))
      // Page du fournisseur (FedaPay) : adresse externe ; simulation : page du site.
      if (/^https?:\/\//.test(redirection)) ouvrirPageFournisseur(redirection)
      else navigate(redirection)
    } catch (err) {
      setEnvoi(false)
      if (err instanceof ErreurApi && err.champs) return formulaire.appliquerErreursServeur(err.champs)
      if (err instanceof ErreurApi && MESSAGES_ERREUR[err.code]) return setErreur(MESSAGES_ERREUR[err.code])
      if (err instanceof ErreurApi && err.code === 'statut_incompatible') {
        return setErreur(montee ? 'Cette app ne peut pas changer d’offre dans son état actuel.' : 'Cette app n’est plus en brouillon : son offre est déjà payée.')
      }
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
        {montee && (
          <p className="mt-2 text-sm text-texte">
            Vous avez déjà payé l’Offre Standard : vous ne réglez que la différence de prix.
          </p>
        )}
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
        {offres.length > 1 && <ChoixRadio {...lier('offre')} libelle="Offre" options={choixOffres} />}
        <ChoixRadio {...lier('moyen')} libelle="Moyen de paiement" options={moyens} />
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

const MESSAGES_ABONNEMENT = {
  quota_atteint: 'Les campagnes de ce mois sont toutes utilisées.',
  abonnement_suspendu: 'Votre abonnement est suspendu : renouvelez-le pour continuer.',
  sans_abonnement: 'Vous n’avez pas d’abonnement.',
  statut_incompatible: 'Cette app n’est plus en brouillon.',
}

// US-45 : avec un abonnement, une campagne Standard se lance sans payer l'app.
function BlocAbonnement({ app }) {
  const navigate = useNavigate()
  const [abonnement, setAbonnement] = useState(null)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)

  useEffect(() => {
    const controle = new AbortController()
    lireAbonnement({ signal: controle.signal })
      .then((r) => setAbonnement(r.abonnement))
      // Sans état d'abonnement lisible, le paiement à l'app reste possible.
      .catch(() => {})
    return () => controle.abort()
  }, [])

  if (!abonnement) return null
  if (abonnement.statut === 'suspendu' || !abonnement.campagnesRestantes) {
    return (
      <p className="mb-6 rounded-carte border border-trait bg-white p-4 text-sm text-texte">
        {abonnement.statut === 'suspendu' ? 'Votre abonnement est suspendu.' : 'Les campagnes de votre abonnement sont utilisées ce mois-ci.'}{' '}
        <Link to="/mon-compte/abonnement" className="font-medium text-accent underline underline-offset-2">
          Voir mon abonnement
        </Link>
      </p>
    )
  }

  async function utiliser() {
    setErreur(null)
    setEnvoi(true)
    try {
      await utiliserAbonnement(app.id)
      navigate('/mon-compte')
    } catch (err) {
      setEnvoi(false)
      setErreur(err instanceof ErreurApi && MESSAGES_ABONNEMENT[err.code] ? MESSAGES_ABONNEMENT[err.code] : messageErreurGlobale(err))
    }
  }

  return (
    <section aria-labelledby="titre-abonnement" className="mb-6 rounded-carte border border-accent bg-white p-4">
      <h2 id="titre-abonnement" className="font-semibold text-encre">
        Utiliser votre abonnement
      </h2>
      <p className="mt-1 text-sm text-texte">
        Il vous reste {abonnement.campagnesRestantes} {abonnement.campagnesRestantes > 1 ? 'campagnes Standard' : 'campagne Standard'} ce
        mois-ci : lancez celle de « {app.nom} » sans payer.
      </p>
      {erreur && (
        <Alerte ton="erreur" className="mt-3">
          {erreur}
        </Alerte>
      )}
      <Bouton type="button" className="mt-3 w-full sm:w-auto" chargement={envoi} libelleChargement="Envoi…" onClick={utiliser}>
        Utiliser mon abonnement
      </Bouton>
    </section>
  )
}

function useAppEtOffres(id) {
  return useChargement(
    async (signal) => {
      const [{ app }, { offres }] = await Promise.all([lireApp(id, { signal }), lireOffres({ signal })])
      // US-37 : le prix de l’Offre Plus vient du devis de l'app.
      const devis = app.statut === 'brouillon' && offres.some((o) => o.surDevis) ? (await lireDevis(id, { signal })).devis : null
      return { app, offres, devis }
    },
    id,
  )
}

// Offres payables : L’Offre Plus seulement avec un devis proposé, à son prix.
function offresPayables(offres, devis) {
  return offres
    .filter((o) => !o.surDevis || devis?.statut === 'propose')
    .map((o) =>
      o.surDevis
        ? {
            ...o,
            prix: { carte: devis.prix.carte, mobile_money: devis.prix.mobile_money },
            ...(o.debitCarte && { debitCarte: devis.prix.mobile_money }),
          }
        : o,
    )
}

// Offre Plus sans devis proposé : lien vers la demande de devis.
function NoteDevis({ app, offre, devis }) {
  if (!offre || devis?.statut === 'propose') return null
  const lien = `/mon-compte/apps/${app.id}/devis`
  return (
    <p className="mt-6 rounded-carte border border-trait bg-white p-4 text-sm text-texte">
      <span className="font-semibold text-encre">{offre.nom}</span> : sur devis, à partir de{' '}
      {montantLisible(offre.prix.carte.montant, offre.prix.carte.devise)}.{' '}
      {devis?.statut === 'demande' ? 'Votre demande est à l’étude. ' : devis?.statut === 'refuse' ? 'Notre équipe a répondu à votre demande. ' : ''}
      <Link to={lien} className="font-medium text-accent underline underline-offset-2">
        {devis ? 'Voir votre demande de devis' : 'Demander un devis'}
      </Link>
    </p>
  )
}

function ErreurChargement({ titre, utilisateur, erreur, reessayer }) {
  const absente = erreur instanceof ErreurApi && erreur.statut === 404
  return (
    <PagePaiement titre={titre} utilisateur={utilisateur}>
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

function Paiement({ id, utilisateur }) {
  const [parametres] = useSearchParams()
  const { chargement, donnees, erreur, reessayer } = useAppEtOffres(id)

  if (chargement) return <Chargement titre={TITRE} />
  if (erreur) return <ErreurChargement titre={TITRE} utilisateur={utilisateur} erreur={erreur} reessayer={reessayer} />
  const { app, offres } = donnees
  if (app.statut !== 'brouillon') {
    const peutMonter = (app.offre ?? 'standard') === 'standard' && app.statut !== 'refusee' && offres.some((o) => o.monteeEnGamme)
    return (
      <PagePaiement titre={app.nom} utilisateur={utilisateur}>
        <Alerte ton="info">L’offre de cette app est déjà payée.</Alerte>
        <p className="mt-6 text-texte">
          <Link to="/mon-compte/paiements" className="font-medium text-accent underline underline-offset-2">
            Voir vos paiements et factures
          </Link>
        </p>
        {peutMonter && (
          <p className="mt-3 text-texte">
            <Link to={`/mon-compte/apps/${app.id}/montee-en-gamme`} className="font-medium text-accent underline underline-offset-2">
              Passer à l’Offre Pro
            </Link>
          </p>
        )}
        <RetourCompte className="mt-3" />
      </PagePaiement>
    )
  }
  const payables = offresPayables(offres, donnees.devis)
  const demandee = parametres.get('offre')
  const offreInitiale = payables.some((o) => o.code === demandee) ? demandee : (payables.find((o) => o.code === 'standard') ?? payables[0]).code
  return (
    <PagePaiement
      titre={TITRE}
      utilisateur={utilisateur}
      intro={<p>Une fois l’offre payée, l’app passe en vérification et ne peut plus être modifiée.</p>}
    >
      <BlocAbonnement app={app} />
      <Formulaire app={app} offres={payables} offreInitiale={offreInitiale} />
      <NoteDevis app={app} offre={offres.find((o) => o.surDevis)} devis={donnees.devis} />
    </PagePaiement>
  )
}

function Montee({ id, utilisateur }) {
  const { chargement, donnees, erreur, reessayer } = useAppEtOffres(id)

  if (chargement) return <Chargement titre={TITRE_MONTEE} />
  if (erreur) return <ErreurChargement titre={TITRE_MONTEE} utilisateur={utilisateur} erreur={erreur} reessayer={reessayer} />
  const { app, offres } = donnees
  const pro = offres.find((o) => o.code === 'pro' && o.monteeEnGamme)
  let blocage = null
  if (!pro) blocage = 'L’Offre Pro n’est pas encore ouverte.'
  else if (app.offre === 'pro') blocage = 'Votre app est déjà en Offre Pro.'
  else if (app.offre === 'afrique') blocage = 'Votre app est en Offre Plus : elle a déjà tout ce que l’Offre Pro apporte.'
  else if (app.statut === 'refusee') blocage = 'Cette app a été refusée : elle ne peut pas changer d’offre.'
  else if (app.campagne?.statut === 'terminee') blocage = 'La campagne de cette app est terminée : elle ne peut plus changer d’offre.'

  if (app.statut === 'brouillon' && pro) {
    return (
      <PagePaiement titre={TITRE_MONTEE} utilisateur={utilisateur}>
        <Alerte ton="info">Cette app n’est pas encore payée : choisissez directement l’Offre Pro au paiement.</Alerte>
        <p className="mt-6">
          <Link to={`/mon-compte/apps/${app.id}/paiement?offre=pro`} className="font-medium text-accent underline underline-offset-2">
            Payer l’Offre Pro
          </Link>
        </p>
        <RetourCompte className="mt-3" />
      </PagePaiement>
    )
  }
  if (blocage) {
    return (
      <PagePaiement titre={TITRE_MONTEE} utilisateur={utilisateur}>
        <Alerte ton="info">{blocage}</Alerte>
        <RetourCompte />
      </PagePaiement>
    )
  }
  return (
    <PagePaiement
      titre={TITRE_MONTEE}
      utilisateur={utilisateur}
      intro={
        <p>
          Le passage vaut pour toute la campagne, même déjà lancée : chaque testeur qui va au bout est payé 800 FCFA, et les remplaçants
          viennent en priorité des testeurs confirmés.
        </p>
      }
    >
      <Formulaire app={app} offres={[pro]} offreInitiale="pro" montee />
    </PagePaiement>
  )
}

function Garde({ titre, suite, raison, rendu }) {
  return (
    <EspaceDeveloppeur
      titre={titre}
      suite={suite}
      raison={raison}
      contenu={(utilisateur) =>
        utilisateur.statut === 'valide' ? (
          rendu(utilisateur)
        ) : (
          <PagePaiement titre={titre} utilisateur={utilisateur}>
            <Alerte ton="alerte">Votre compte doit être validé par l’équipe avant de payer une offre.</Alerte>
            <RetourCompte />
          </PagePaiement>
        )
      }
    />
  )
}

// /mon-compte/apps/:id/paiement (US-12, US-32) : choix de l'offre et paiement.
export default function PayerApp() {
  const { id } = useParams()
  return (
    <Garde
      titre={TITRE}
      suite={`/mon-compte/apps/${id}/paiement`}
      raison="pour payer l’offre de votre app."
      rendu={(utilisateur) => <Paiement id={id} utilisateur={utilisateur} />}
    />
  )
}

// /mon-compte/apps/:id/montee-en-gamme (US-32) : passage de Standard à Pro.
export function MonteeEnGamme() {
  const { id } = useParams()
  return (
    <Garde
      titre={TITRE_MONTEE}
      suite={`/mon-compte/apps/${id}/montee-en-gamme`}
      raison="pour passer votre app à l’Offre Pro."
      rendu={(utilisateur) => <Montee id={id} utilisateur={utilisateur} />}
    />
  )
}
