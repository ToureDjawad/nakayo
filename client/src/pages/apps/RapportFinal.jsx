import { useEffect, useState } from 'react'
import { enregistrerDecisionGoogle, lireRapportFinal, telechargerRapportFinal } from '../../api/apps.js'
import { ErreurApi } from '../../api/client.js'
import { Alerte } from '../../components/Alerte.jsx'
import { Bouton, Indicateur } from '../../components/Bouton.jsx'
import { Champ, ChampTexte, ChoixRadio } from '../../components/Champ.jsx'
import { BoutonCopier } from '../../components/Copier.jsx'
import { jourLong } from '../../lib/campagnes.js'
import { messageErreurGlobale } from '../../lib/messages.js'

const A_COMPLETER = '[À compléter'
const DECISIONS = [
  { valeur: 'acceptee', libelle: 'Accès à la production accepté' },
  { valeur: 'refusee', libelle: 'Accès à la production refusé' },
]

// Les réponses modifiées sont gardées dans ce navigateur, pour reprendre la relecture plus tard.
const cleBrouillon = (appId) => `nakayo:brouillon-google:${appId}`
function lireModifs(appId) {
  try {
    return JSON.parse(localStorage.getItem(cleBrouillon(appId))) ?? {}
  } catch {
    return {}
  }
}
function ecrireModifs(appId, modifs) {
  try {
    localStorage.setItem(cleBrouillon(appId), JSON.stringify(modifs))
  } catch {
    // Stockage indisponible (navigation privée) : les modifications restent le temps de la visite.
  }
}

function BoutonRapport({ appId }) {
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState(null)

  async function telecharger() {
    setEnCours(true)
    setErreur(null)
    try {
      const url = URL.createObjectURL(await telechargerRapportFinal(appId))
      const lien = document.createElement('a')
      lien.href = url
      lien.download = 'rapport-nakayo.pdf'
      document.body.append(lien)
      lien.click()
      lien.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      setErreur(messageErreurGlobale(err))
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div>
      <Bouton type="button" chargement={enCours} libelleChargement="Téléchargement…" onClick={telecharger}>
        Télécharger le rapport PDF
      </Bouton>
      {erreur && (
        <p role="alert" className="mt-1.5 text-sm text-erreur">
          {erreur}
        </p>
      )}
    </div>
  )
}

function Brouillon({ appId, brouillon }) {
  const [modifs, setModifs] = useState(() => lireModifs(appId))
  const valeur = (q) => modifs[q.id] ?? q.reponse

  function modifier(id, texte) {
    const suivantes = { ...modifs, [id]: texte }
    setModifs(suivantes)
    ecrireModifs(appId, suivantes)
  }

  const restantes = brouillon.parties.flatMap((p) => p.questions).filter((q) => valeur(q).includes(A_COMPLETER)).length

  return (
    <div className="mt-5 space-y-6">
      <Alerte ton={restantes ? 'info' : 'succes'}>
        {restantes
          ? `${restantes} réponse${restantes > 1 ? 's' : ''} à compléter : remplacez les passages entre crochets par vos propres informations. Nous n’inventons aucune réponse.`
          : 'Toutes les réponses sont complétées. Relisez-les une dernière fois avant de les coller dans la Play Console.'}
      </Alerte>
      {brouillon.parties.map((partie, i) => (
        <div key={partie.titre}>
          <h3 className="font-semibold text-encre">
            {i + 1}. {partie.titre}
          </h3>
          <div className="mt-3 space-y-5">
            {partie.questions.map((q) => {
              const texte = valeur(q)
              return (
                <div key={q.id}>
                  <ChampTexte
                    id={`brouillon-${q.id}`}
                    nom={q.id}
                    libelle={q.question}
                    valeur={texte}
                    onChange={(v) => modifier(q.id, v)}
                    lignes={Math.min(Math.max(texte.split('\n').length + 2, 4), 12)}
                  />
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <BoutonCopier texte={texte} libelle="Copier la réponse" libelleCopie="Réponse copiée" ariaLabel={`Copier la réponse : ${q.question}`} />
                    {texte.includes(A_COMPLETER) && <span className="text-sm font-medium text-alerte">À compléter avant l’envoi</span>}
                    {modifs[q.id] !== undefined && modifs[q.id] !== q.reponse && (
                      <button
                        type="button"
                        onClick={() => modifier(q.id, q.reponse)}
                        className="text-sm font-semibold text-texte underline-offset-2 hover:underline"
                        aria-label={`Revenir au brouillon proposé : ${q.question}`}
                      >
                        Revenir au brouillon proposé
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function DecisionGoogle({ appId, decisionInitiale }) {
  const [decision, setDecision] = useState(decisionInitiale?.decision ?? '')
  const [le, setLe] = useState(decisionInitiale?.le ?? '')
  const [enregistree, setEnregistree] = useState(decisionInitiale)
  const [erreurs, setErreurs] = useState({})
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)

  async function soumettre(e) {
    e.preventDefault()
    setErreur(null)
    if (!decision) {
      setErreurs({ decision: 'requis' })
      return
    }
    setEnvoi(true)
    try {
      const { decisionGoogle } = await enregistrerDecisionGoogle(appId, { decision, le })
      setEnregistree(decisionGoogle)
      setErreurs({})
    } catch (err) {
      if (err instanceof ErreurApi && err.champs) setErreurs(err.champs)
      else setErreur(messageErreurGlobale(err))
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <form onSubmit={soumettre} noValidate className="mt-6 space-y-4 rounded-carte border border-trait bg-white p-5" aria-labelledby="decision-google">
      <div>
        <h3 id="decision-google" className="font-semibold text-encre">
          Réponse de Google
        </h3>
        <p className="mt-1 text-sm text-texte">Indiquez-nous la réponse de Google à votre demande : elle nous aide à mesurer et améliorer nos tests.</p>
      </div>
      <div aria-live="polite">
        {enregistree && (
          <Alerte ton="succes">
            Merci, réponse enregistrée : accès {enregistree.decision === 'acceptee' ? 'accepté' : 'refusé'}
            {enregistree.le ? ` le ${jourLong(enregistree.le)}` : ''}.
          </Alerte>
        )}
      </div>
      <ChoixRadio
        nom="decision"
        libelle="Décision de Google"
        valeur={decision}
        erreur={erreurs.decision}
        onChange={(v) => {
          setDecision(v)
          setErreurs((x) => ({ ...x, decision: undefined }))
        }}
        options={DECISIONS}
        messages={{ requis: 'Choisissez la réponse de Google.' }}
      />
      <Champ
        nom="le"
        type="date"
        libelle="Date de la réponse"
        facultatif
        valeur={le}
        erreur={erreurs.le}
        onChange={(v) => {
          setLe(v)
          setErreurs((x) => ({ ...x, le: undefined }))
        }}
        messages={{ format_invalide: 'Indiquez une date passée ou aujourd’hui.' }}
      />
      {erreur && <Alerte ton="erreur">{erreur}</Alerte>}
      <Bouton chargement={envoi} libelleChargement="Enregistrement…">
        Enregistrer la réponse
      </Bouton>
    </form>
  )
}

// US-36 : rapport de fin PDF et brouillon des réponses au formulaire Google, au 14e jour du test.
export function RapportFinal({ appId }) {
  const [essai, setEssai] = useState(0)
  const [etat, setEtat] = useState({ rapport: null, erreur: null })

  useEffect(() => {
    const controleur = new AbortController()
    lireRapportFinal(appId, { signal: controleur.signal })
      .then(({ rapport }) => setEtat({ rapport, erreur: null }))
      .catch((erreur) => {
        if (!controleur.signal.aborted) setEtat({ rapport: null, erreur })
      })
    return () => controleur.abort()
  }, [appId, essai])

  const { rapport, erreur } = etat
  let contenu
  if (erreur) {
    contenu = (
      <>
        <Alerte ton="erreur">{messageErreurGlobale(erreur)}</Alerte>
        <Bouton type="button" variante="secondaire" className="mt-3" onClick={() => setEssai((n) => n + 1)}>
          Réessayer
        </Bouton>
      </>
    )
  } else if (!rapport) {
    contenu = (
      <p role="status" className="flex items-center gap-2 text-sm text-texte">
        <Indicateur className="size-4 text-accent" />
        Chargement…
      </p>
    )
  } else if (!rapport.pret) {
    contenu = (
      <p className="rounded-carte border border-trait bg-white p-4 text-sm text-texte">
        {rapport.disponibleLe
          ? `Disponible le ${jourLong(rapport.disponibleLe)}, au 14e jour du test. Nous vous prévenons par email.`
          : 'Pas de rapport pour une campagne annulée.'}
      </p>
    )
  } else {
    contenu = (
      <>
        <p className="text-sm text-texte">
          Le rapport reprend les chiffres réels du test : testeurs, temps d’utilisation, téléphones, versions testées et retours par fonctionnalité. Le
          brouillon ci-dessous vous aide à remplir le formulaire de demande d’accès à la production dans la Play Console.
        </p>
        <div className="mt-4">
          <BoutonRapport appId={appId} />
        </div>
        <Brouillon appId={appId} brouillon={rapport.brouillon} />
        <DecisionGoogle appId={appId} decisionInitiale={rapport.decisionGoogle} />
      </>
    )
  }

  return (
    <section aria-labelledby="rapport-final">
      <h2 id="rapport-final" className="text-lg font-semibold text-encre">
        Rapport de fin et réponses pour Google
      </h2>
      <div className="mt-3">{contenu}</div>
    </section>
  )
}
