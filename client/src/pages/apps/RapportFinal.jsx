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
const CONNEXIONS = { wifi: 'Wi-Fi', '4g': '4G', '3g': '3G', '2g': '2G' }
const LANGUES = { fr: 'français', en: 'anglais' }
const tenue = (t) => `${t.fluide} fluide, ${t.lent} lent, ${t.inutilisable} inutilisable`
const note = (n) => (n === null ? '-' : `${String(n).replace('.', ',')} sur 5`)

function LigneTerrain({ terme, children }) {
  return (
    <div className="py-2 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm text-discret">{terme}</dt>
      <dd className="mt-0.5 text-sm text-encre sm:mt-0">{children}</dd>
    </div>
  )
}

// US-37 : questionnaire terrain de l'offre Lancement Afrique (réseau, petits téléphones, langue).
function TestTerrain({ terrain: t }) {
  return (
    <section aria-labelledby="test-terrain" className="mt-6 rounded-carte border border-trait bg-white p-4 sm:p-5">
      <h3 id="test-terrain" className="font-semibold text-encre">
        Test terrain
      </h3>
      {!t.reponses ? (
        <p className="mt-2 text-sm text-texte">Aucun testeur n’a encore répondu au questionnaire terrain.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-texte">
            {t.reponses} testeur{t.reponses > 1 ? 's ont' : ' a'} répondu au questionnaire terrain, à partir du 7e jour.
          </p>
          <dl className="mt-3 divide-y divide-trait">
            <LigneTerrain terme="Tenue sur le réseau">{tenue(t.reseau)}</LigneTerrain>
            {t.parConnexion.map((c) => (
              <LigneTerrain key={c.connexion} terme={`En ${CONNEXIONS[c.connexion]} (${c.reponses})`}>
                {tenue(c)}
              </LigneTerrain>
            ))}
            <LigneTerrain terme="Tenue sur le téléphone">{tenue(t.telephone)}</LigneTerrain>
            <LigneTerrain terme={`Petits téléphones (${t.petitsTelephones.reponses})`}>
              {t.petitsTelephones.reponses ? tenue(t.petitsTelephones) : '-'}
            </LigneTerrain>
            <LigneTerrain terme="Compréhension de l’app">{note(t.comprehensionMoyenne)}</LigneTerrain>
            {t.langues.map((l) => (
              <LigneTerrain key={l.langue} terme={`En ${LANGUES[l.langue]} (${l.reponses})`}>
                {note(l.comprehensionMoyenne)}
              </LigneTerrain>
            ))}
          </dl>
          {t.commentaires.length > 0 && (
            <ul className="mt-3 space-y-2">
              {t.commentaires.map((c, i) => (
                <li key={i} className="rounded-champ bg-fond-doux px-3 py-2 text-sm [overflow-wrap:anywhere] text-texte">
                  {c}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

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
        {rapport.bilan?.terrain && <TestTerrain terrain={rapport.bilan.terrain} />}
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
