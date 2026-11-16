import { useEffect, useState } from 'react'
import { annoncerVersion, lireVersions } from '../../api/apps.js'
import { ErreurApi } from '../../api/client.js'
import { Alerte } from '../../components/Alerte.jsx'
import { Bouton } from '../../components/Bouton.jsx'
import { Champ, ChampTexte } from '../../components/Champ.jsx'
import { dateCourte } from '../../lib/campagnes.js'
import { messageErreurGlobale } from '../../lib/messages.js'

// US-44 : annoncer une nouvelle version aux testeurs pendant le test (docs/nouvelle-version.md).
const MESSAGES = {
  numero: { requis: 'Indiquez le numéro de la version.', deja_utilise: 'Cette version est déjà annoncée.' },
  changements: { requis: 'Décrivez ce qui a changé.', trop_court: 'Décrivez ce qui a changé en une phrase au moins.' },
}

export function NouvelleVersion({ appId, enCours }) {
  const [versions, setVersions] = useState(null)
  const [numero, setNumero] = useState('')
  const [changements, setChangements] = useState('')
  const [erreurs, setErreurs] = useState({})
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [annonce, setAnnonce] = useState(null)

  useEffect(() => {
    const controleur = new AbortController()
    lireVersions(appId, { signal: controleur.signal })
      .then(({ versions: v }) => setVersions(v))
      .catch(() => {
        // Sans réponse, la liste reste vide ; le formulaire reste utilisable.
        if (!controleur.signal.aborted) setVersions([])
      })
    return () => controleur.abort()
  }, [appId])

  async function soumettre(e) {
    e.preventDefault()
    setErreur(null)
    setAnnonce(null)
    const n = numero.trim()
    const c = changements.trim()
    const locales = { numero: n ? undefined : 'requis', changements: !c ? 'requis' : c.length < 10 ? 'trop_court' : undefined }
    if (locales.numero || locales.changements) {
      setErreurs(locales)
      return
    }
    setEnvoi(true)
    try {
      const { versions: v } = await annoncerVersion(appId, { numero: n, changements: c })
      setVersions(v)
      setNumero('')
      setChangements('')
      setErreurs({})
      setAnnonce(`Version ${n} annoncée. Vos testeurs sont prévenus par SMS et dans l’app Nakayo.`)
    } catch (err) {
      if (err instanceof ErreurApi && err.champs) setErreurs(err.champs)
      else setErreur(messageErreurGlobale(err))
    } finally {
      setEnvoi(false)
    }
  }

  if (!enCours && !versions?.length) return null
  return (
    <section aria-labelledby="nouvelle-version" className="rounded-carte border border-trait bg-white p-4">
      <h2 id="nouvelle-version" className="text-lg font-semibold text-encre">
        Nouvelles versions
      </h2>
      <p className="mt-1 text-sm text-texte">
        Google attend des corrections faites grâce aux retours des testeurs. Publiez une nouvelle version dans votre test fermé, puis annoncez-la ici : vos
        testeurs la mettent à jour et vérifient les corrections. L’historique est repris dans le rapport de fin.
      </p>
      {versions?.length > 0 && (
        <ul className="mt-4 divide-y divide-trait text-sm">
          {versions.map((v) => (
            <li key={v.numero} className="py-2">
              <p className="font-semibold text-encre">
                Version {v.numero}{' '}
                <span className="font-normal text-discret">
                  · jour {v.jourCampagne}, le {dateCourte(v.annonceeLe)} · vérifiée par {v.testeursSurVersion} testeur{v.testeursSurVersion > 1 ? 's' : ''}
                </span>
              </p>
              <p className="whitespace-pre-line text-texte">{v.changements}</p>
            </li>
          ))}
        </ul>
      )}
      {enCours && (
        <form onSubmit={soumettre} noValidate className="mt-4 space-y-4">
          <div aria-live="polite">{annonce && <Alerte ton="succes">{annonce}</Alerte>}</div>
          <Champ
            nom="numero"
            libelle="Numéro de version"
            aide="Le nom de version affiché dans la Play Console, par exemple 1.0.3."
            valeur={numero}
            erreur={erreurs.numero}
            onChange={(v) => {
              setNumero(v)
              setErreurs((x) => ({ ...x, numero: undefined }))
            }}
            max={50}
            messages={MESSAGES.numero}
          />
          <ChampTexte
            nom="changements"
            libelle="Ce qui a changé"
            aide="Les corrections à vérifier par les testeurs."
            valeur={changements}
            erreur={erreurs.changements}
            onChange={(v) => {
              setChangements(v)
              setErreurs((x) => ({ ...x, changements: undefined }))
            }}
            max={1000}
            lignes={3}
            messages={MESSAGES.changements}
          />
          {erreur && <Alerte ton="erreur">{erreur}</Alerte>}
          <Bouton chargement={envoi} libelleChargement="Annonce…">
            Annoncer la version
          </Bouton>
        </form>
      )}
    </section>
  )
}
