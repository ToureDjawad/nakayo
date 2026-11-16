import { useEffect, useState } from 'react'
import { demanderGarantie, demarrerCampagne, lireGarantie } from '../../api/apps.js'
import { ErreurApi } from '../../api/client.js'
import { Alerte } from '../../components/Alerte.jsx'
import { Bouton } from '../../components/Bouton.jsx'
import { CaseACocher, ChampTexte, ChoixRadio } from '../../components/Champ.jsx'
import { jourLong } from '../../lib/campagnes.js'
import { messageErreurGlobale } from '../../lib/messages.js'

// US-30 : garantie si Google refuse l'accès à la production (docs/garantie.md).
const MOTIFS = [
  { valeur: 'engagement_insuffisant', libelle: 'Les testeurs n’ont pas assez utilisé l’app' },
  { valeur: 'testeurs_insuffisants', libelle: 'Pas assez de testeurs' },
]
const CHOIX = [
  { valeur: 'nouvelle_campagne', libelle: 'Une nouvelle campagne de 14 jours offerte' },
  { valeur: 'remboursement', libelle: 'Le remboursement de votre paiement' },
]
const MESSAGES = {
  motifGoogle: { requis: 'Choisissez le motif donné par Google.' },
  choix: { requis: 'Choisissez une campagne offerte ou un remboursement.' },
  emailGoogle: { requis: 'Collez l’email de refus de Google.', trop_court: 'Collez l’email complet de Google.' },
  engagement: { doit_etre_accepte: 'Confirmez avoir respecté la liste de vérification.' },
}

function Formulaire({ appId, jusquau, onEnvoyee }) {
  const [valeurs, setValeurs] = useState({ motifGoogle: '', choix: '', emailGoogle: '', engagement: false })
  const [erreurs, setErreurs] = useState({})
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)
  const changer = (nom) => (v) => {
    setValeurs((x) => ({ ...x, [nom]: v }))
    setErreurs((x) => ({ ...x, [nom]: undefined }))
  }

  async function soumettre(e) {
    e.preventDefault()
    setErreur(null)
    const texte = valeurs.emailGoogle.trim()
    const locales = {
      motifGoogle: valeurs.motifGoogle ? undefined : 'requis',
      choix: valeurs.choix ? undefined : 'requis',
      emailGoogle: !texte ? 'requis' : texte.length < 30 ? 'trop_court' : undefined,
      engagement: valeurs.engagement ? undefined : 'doit_etre_accepte',
    }
    if (Object.values(locales).some(Boolean)) {
      setErreurs(locales)
      return
    }
    setEnvoi(true)
    try {
      onEnvoyee(await demanderGarantie(appId, { ...valeurs, emailGoogle: texte }))
    } catch (err) {
      if (err instanceof ErreurApi && err.champs) setErreurs(err.champs)
      else setErreur(messageErreurGlobale(err))
      setEnvoi(false)
    }
  }

  return (
    <form onSubmit={soumettre} noValidate className="mt-4 space-y-4">
      <p className="text-sm text-texte">
        Google a refusé l’accès à la production ? Demandez la garantie avant le {jourLong(jusquau)}. Une seule garantie par app.
      </p>
      <ChoixRadio nom="motifGoogle" libelle="Motif donné par Google" valeur={valeurs.motifGoogle} erreur={erreurs.motifGoogle} onChange={changer('motifGoogle')} options={MOTIFS} messages={MESSAGES.motifGoogle} />
      <ChampTexte
        nom="emailGoogle"
        libelle="Email de refus de Google"
        aide="Copiez-collez le texte de l’email reçu de Google Play."
        valeur={valeurs.emailGoogle}
        erreur={erreurs.emailGoogle}
        onChange={changer('emailGoogle')}
        max={5000}
        lignes={5}
        messages={MESSAGES.emailGoogle}
      />
      <ChoixRadio nom="choix" libelle="Ce que vous souhaitez" valeur={valeurs.choix} erreur={erreurs.choix} onChange={changer('choix')} options={CHOIX} messages={MESSAGES.choix} />
      <CaseACocher nom="engagement" valeur={valeurs.engagement} erreur={erreurs.engagement} onChange={changer('engagement')} messages={MESSAGES.engagement}>
        J’ai respecté la liste de vérification avant le test (testeurs ajoutés, fiche complète, version publiée).
      </CaseACocher>
      {erreur && <Alerte ton="erreur">{erreur}</Alerte>}
      <Bouton chargement={envoi} libelleChargement="Envoi…">
        Demander la garantie
      </Bouton>
    </form>
  )
}

function Suivi({ appId, garantie, onCampagneDemarree }) {
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)

  async function demarrer() {
    setEnvoi(true)
    setErreur(null)
    try {
      await demarrerCampagne(appId)
      onCampagneDemarree?.()
    } catch (err) {
      setErreur(messageErreurGlobale(err))
      setEnvoi(false)
    }
  }

  if (garantie.statut === 'en_attente') {
    return (
      <Alerte ton="info" className="mt-4">
        Demande envoyée le {jourLong(garantie.creeLe.slice(0, 10))}. Notre équipe l’examine et vous répond par email.
      </Alerte>
    )
  }
  if (garantie.statut === 'refusee') {
    return (
      <Alerte ton="erreur" className="mt-4" titre="Demande refusée">
        {garantie.motifRefus}
      </Alerte>
    )
  }
  if (garantie.choix === 'remboursement') {
    return (
      <Alerte ton="succes" className="mt-4">
        Demande acceptée : votre paiement vous est remboursé.
      </Alerte>
    )
  }
  if (garantie.campagneOfferteDemarree) {
    return (
      <Alerte ton="succes" className="mt-4">
        Votre campagne offerte a démarré.
      </Alerte>
    )
  }
  return (
    <div className="mt-4 space-y-3">
      <Alerte ton="succes">
        Demande acceptée : une nouvelle campagne de 14 jours vous est offerte. Publiez d’abord une version avec vos corrections, puis démarrez-la.
      </Alerte>
      {erreur && <Alerte ton="erreur">{erreur}</Alerte>}
      <Bouton type="button" chargement={envoi} libelleChargement="Démarrage…" onClick={demarrer}>
        Démarrer la campagne offerte
      </Bouton>
    </div>
  )
}

export function Garantie({ appId, onCampagneDemarree }) {
  const [etat, setEtat] = useState(null)

  useEffect(() => {
    const controleur = new AbortController()
    lireGarantie(appId, { signal: controleur.signal })
      .then(setEtat)
      .catch(() => {
        // Facultatif : sans réponse, le bloc n'est simplement pas affiché.
      })
    return () => controleur.abort()
  }, [appId])

  if (!etat || (!etat.garantie && !etat.possible)) return null
  return (
    <section aria-labelledby="garantie" className="mt-6 rounded-carte border border-trait bg-white p-5">
      <h3 id="garantie" className="font-semibold text-encre">
        Garantie
      </h3>
      {etat.garantie ? (
        <Suivi appId={appId} garantie={etat.garantie} onCampagneDemarree={onCampagneDemarree} />
      ) : (
        <Formulaire appId={appId} jusquau={etat.jusquau} onEnvoyee={setEtat} />
      )}
    </section>
  )
}
