import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { lireCampagneAdmin, listerCampagnes, remplacerTesteur } from '../../api/admin.js'
import { ErreurApi } from '../../api/client.js'
import { Alerte } from '../../components/Alerte.jsx'
import { Bouton, Indicateur } from '../../components/Bouton.jsx'
import { ChampTexte } from '../../components/Champ.jsx'
import { PageAdmin } from '../../components/MiseEnPage.jsx'
import { dateCourte } from '../../lib/campagnes.js'
import { pluriel, telephone } from '../../lib/format.js'
import { messageErreurGlobale } from '../../lib/messages.js'
import { useFormulaire } from '../../lib/useFormulaire.js'
import { LIMITES, validerMotifRefus } from '../../lib/validation.js'
import { AccesAdmin } from './AccesAdmin.jsx'

const TITRE = 'Campagnes'
const ONGLETS = [
  { statut: 'en_cours', libelle: 'En cours' },
  { statut: 'terminee', libelle: 'Terminées' },
]
const MESSAGES_MOTIF = {
  requis: 'Indiquez pourquoi ce testeur est remplacé.',
  trop_court: `Le motif doit contenir au moins ${LIMITES.motifRefusMin} caractères.`,
}
const ERREURS_REMPLACEMENT = {
  delai_depasse: 'Le remplacement manuel n’est possible que pendant les 2 premiers jours de la campagne.',
  testeurs_insuffisants: 'Aucun testeur disponible pour ce remplacement pour le moment.',
  statut_incompatible: 'Ce testeur a déjà été remplacé, ou la campagne est terminée.',
}

function Oui({ ok, children }) {
  return <span className={ok ? 'text-succes' : 'text-discret'}>{children}</span>
}

function FormulaireRemplacement({ campagne, testeur, onRemplace, onAnnuler }) {
  const formulaire = useFormulaire({ motif: '' }, { motif: validerMotifRefus }, { prefixe: `remplacement-${testeur.id}-` })
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)
  const refMotif = useRef(null)

  useEffect(() => {
    refMotif.current?.focus()
  }, [])

  async function soumettre(e) {
    e.preventDefault()
    setErreur(null)
    if (!formulaire.validerTout()) return
    setEnvoi(true)
    try {
      const { campagne: aJour } = await remplacerTesteur(campagne.id, testeur.id, formulaire.valeurs.motif.trim())
      onRemplace(aJour, `${testeur.nom} est remplacé. Le nouveau testeur est prévenu par SMS.`)
    } catch (err) {
      setEnvoi(false)
      if (err instanceof ErreurApi && err.champs) formulaire.appliquerErreursServeur(err.champs)
      else setErreur((err instanceof ErreurApi && ERREURS_REMPLACEMENT[err.code]) || messageErreurGlobale(err))
    }
  }

  return (
    <form
      onSubmit={soumettre}
      noValidate
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !envoi) onAnnuler()
      }}
      className="mt-3 space-y-3 rounded-champ border border-trait bg-papier p-4"
      aria-label={`Remplacer ${testeur.nom}`}
    >
      <ChampTexte
        {...formulaire.lier('motif')}
        ref={refMotif}
        libelle="Motif du remplacement"
        aide="Par exemple : ne s’est pas inscrit au test, injoignable."
        max={LIMITES.motifRefusMax}
        lignes={2}
        messages={MESSAGES_MOTIF}
      />
      {erreur && <Alerte ton="erreur">{erreur}</Alerte>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Bouton chargement={envoi} libelleChargement="Remplacement…">
          Remplacer le testeur
        </Bouton>
        <Bouton type="button" variante="secondaire" onClick={onAnnuler} disabled={envoi}>
          Annuler
        </Bouton>
      </div>
    </form>
  )
}

function Testeurs({ campagne, onMiseAJour }) {
  const [enCours, setEnCours] = useState(null)

  return (
    <ul className="mt-4 divide-y divide-trait border-y border-trait">
      {campagne.testeurs.map((t) => {
        const remplace = t.statut === 'remplacee'
        return (
          <li key={t.id} className={`py-3 text-sm ${remplace ? 'opacity-60' : ''}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="font-semibold text-encre">
                {t.nom} <span className="font-normal text-discret">· {telephone(t.telephone)} · {t.ville}</span>
              </p>
              {remplace ? (
                <p className="text-discret">Remplacé le {dateCourte(t.remplaceeLe)}</p>
              ) : (
                <p className="flex flex-wrap gap-x-3 text-texte">
                  <Oui ok={t.inscriptionConfirmee}>{t.inscriptionConfirmee ? 'Inscrit' : 'Non inscrit'}</Oui>
                  <Oui ok={t.installationConfirmee}>{t.installationConfirmee ? 'Installée' : 'Non installée'}</Oui>
                  <span>{pluriel(t.joursValides, 'jour validé', 'jours validés')}</span>
                  {t.nombreRemises > 0 && <span className="text-alerte">{pluriel(t.nombreRemises, 'remise à zéro', 'remises à zéro')}</span>}
                </p>
              )}
            </div>
            <p className="mt-0.5 text-discret">
              {t.gmail}
              {t.modele && ` · ${t.modele}`}
              {remplace && t.motifRemplacement && ` · motif : ${t.motifRemplacement}`}
            </p>
            {!remplace && campagne.remplacementPossible && enCours !== t.id && (
              <button
                type="button"
                onClick={() => setEnCours(t.id)}
                aria-label={`Remplacer ${t.nom}`}
                className="mt-1 font-semibold text-accent underline-offset-2 hover:underline"
              >
                Remplacer
              </button>
            )}
            {enCours === t.id && (
              <FormulaireRemplacement
                campagne={campagne}
                testeur={t}
                onAnnuler={() => setEnCours(null)}
                onRemplace={(aJour, message) => {
                  setEnCours(null)
                  onMiseAJour(aJour, message)
                }}
              />
            )}
          </li>
        )
      })}
    </ul>
  )
}

function CarteCampagne({ resume }) {
  const [ouverte, setOuverte] = useState(false)
  const [detail, setDetail] = useState({ campagne: null, erreur: null, chargement: false })
  const [annonce, setAnnonce] = useState(null)
  const campagne = detail.campagne ?? resume
  const { compteurs } = campagne

  async function ouvrir() {
    const suivant = !ouverte
    setOuverte(suivant)
    if (!suivant || detail.campagne) return
    setDetail({ campagne: null, erreur: null, chargement: true })
    try {
      const { campagne: complete } = await lireCampagneAdmin(resume.id)
      setDetail({ campagne: complete, erreur: null, chargement: false })
    } catch (erreur) {
      setDetail({ campagne: null, erreur, chargement: false })
    }
  }

  return (
    <article aria-labelledby={`campagne-${campagne.id}`} className="rounded-carte border border-trait bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`campagne-${campagne.id}`} className="text-base font-semibold [overflow-wrap:anywhere] text-encre">
          {campagne.app.nom}
        </h3>
        <p className="text-sm text-discret">
          {campagne.statut === 'en_cours' ? `Jour ${campagne.jour} sur ${campagne.joursCampagne}` : `Terminée le ${dateCourte(campagne.termineeLe)}`}
        </p>
      </div>
      <p className="mt-0.5 text-sm text-texte">
        {campagne.developpeur.nom} · {campagne.developpeur.email}
      </p>
      <p className="mt-2 flex flex-wrap gap-x-4 text-sm text-texte">
        <span className={campagne.alerteInscrits ? 'font-semibold text-erreur' : ''}>
          {compteurs.inscritsConfirmes} inscrits confirmés sur {compteurs.affectes}
        </span>
        <span>{compteurs.installes} installations</span>
        <span>Démarrée le {dateCourte(campagne.demarreeLe)}</span>
      </p>
      {campagne.alerteInscrits && (
        <Alerte ton="erreur" className="mt-3">
          Moins de 13 inscriptions confirmées : remplacez les testeurs qui ne se sont pas inscrits.
        </Alerte>
      )}
      <div aria-live="polite">{annonce && <Alerte ton="succes" className="mt-3">{annonce}</Alerte>}</div>

      <button
        type="button"
        onClick={ouvrir}
        aria-expanded={ouverte}
        className="mt-3 text-sm font-semibold text-accent underline-offset-2 hover:underline"
      >
        {ouverte ? 'Masquer les testeurs' : 'Voir les testeurs'}
      </button>
      {ouverte && detail.chargement && (
        <p role="status" className="mt-3 flex items-center gap-2 text-sm text-texte">
          <Indicateur className="size-4 text-accent" />
          Chargement…
        </p>
      )}
      {ouverte && detail.erreur && (
        <Alerte ton="erreur" className="mt-3">
          {messageErreurGlobale(detail.erreur)}
        </Alerte>
      )}
      {ouverte && detail.campagne && (
        <>
          {campagne.statut === 'en_cours' && !campagne.remplacementPossible && (
            <p className="mt-3 text-sm text-texte">Le remplacement manuel n’est plus possible après le 2e jour.</p>
          )}
          <Testeurs
            campagne={detail.campagne}
            onMiseAJour={(aJour, message) => {
              setDetail({ campagne: aJour, erreur: null, chargement: false })
              setAnnonce(message)
            }}
          />
        </>
      )}
    </article>
  )
}

function ListeCampagnes() {
  const [parametres, setParametres] = useSearchParams()
  const statut = ONGLETS.some((o) => o.statut === parametres.get('statut')) ? parametres.get('statut') : 'en_cours'
  const page = Math.max(1, Number.parseInt(parametres.get('page') ?? '1', 10) || 1)
  const [essai, setEssai] = useState(0)
  const [resultat, setResultat] = useState({ cle: null, donnees: null, erreur: null })
  const cle = `${statut}:${page}:${essai}`

  useEffect(() => {
    const controleur = new AbortController()
    listerCampagnes({ statut, page }, { signal: controleur.signal })
      .then((donnees) => setResultat({ cle, donnees, erreur: null }))
      .catch((erreur) => {
        if (!controleur.signal.aborted) setResultat({ cle, donnees: null, erreur })
      })
    return () => controleur.abort()
  }, [statut, page, cle])

  const chargement = resultat.cle !== cle
  const { donnees, erreur } = resultat
  const pages = donnees ? Math.max(1, Math.ceil(donnees.total / donnees.parPage)) : 1
  const avecStatut = statut === 'en_cours' ? {} : { statut }

  return (
    <div>
      <nav aria-label="Statut des campagnes" className="flex flex-wrap gap-2">
        {ONGLETS.map((o) => (
          <button
            key={o.statut}
            type="button"
            aria-current={statut === o.statut ? 'page' : undefined}
            onClick={() => setParametres(o.statut === 'en_cours' ? {} : { statut: o.statut })}
            className={`h-10 rounded-champ border px-4 text-sm font-semibold ${
              statut === o.statut ? 'border-encre bg-encre text-white' : 'border-trait bg-white text-encre hover:bg-fond-doux'
            }`}
          >
            {o.libelle}
          </button>
        ))}
      </nav>

      {erreur && !chargement && (
        <div className="mt-4">
          <Alerte ton="erreur">{messageErreurGlobale(erreur)}</Alerte>
          <Bouton type="button" variante="secondaire" className="mt-3" onClick={() => setEssai((n) => n + 1)}>
            Réessayer
          </Bouton>
        </div>
      )}

      {chargement && !donnees && (
        <p role="status" className="mt-4 flex items-center gap-3 text-texte">
          <Indicateur className="size-5 text-accent" />
          Chargement…
        </p>
      )}

      {donnees && (
        <section aria-labelledby="titre-liste" className={`mt-4 ${chargement ? 'opacity-60' : ''}`}>
          <h2 id="titre-liste" className="text-lg text-encre">
            {donnees.total === 0
              ? statut === 'en_cours'
                ? 'Aucune campagne en cours'
                : 'Aucune campagne terminée'
              : statut === 'en_cours'
                ? pluriel(donnees.total, 'campagne en cours', 'campagnes en cours')
                : pluriel(donnees.total, 'campagne terminée', 'campagnes terminées')}
          </h2>
          <ul className="mt-4 space-y-4">
            {donnees.campagnes.map((c) => (
              <li key={c.id}>
                <CarteCampagne resume={c} />
              </li>
            ))}
          </ul>
          {pages > 1 && (
            <nav aria-label="Pagination" className="mt-6 flex items-center justify-between gap-4">
              <Bouton type="button" variante="secondaire" disabled={page <= 1} onClick={() => setParametres({ ...avecStatut, page: String(page - 1) })}>
                Précédent
              </Bouton>
              <p className="text-sm text-texte">
                Page {page} sur {pages}
              </p>
              <Bouton type="button" variante="secondaire" disabled={page >= pages} onClick={() => setParametres({ ...avecStatut, page: String(page + 1) })}>
                Suivant
              </Bouton>
            </nav>
          )}
        </section>
      )}
    </div>
  )
}

// /admin/campagnes : suivi des campagnes et remplacement manuel des testeurs (US-16, US-43).
export default function Campagnes() {
  return (
    <AccesAdmin titre={TITRE}>
      {(utilisateur) => (
        <PageAdmin
          titre={TITRE}
          utilisateur={utilisateur}
          intro={
            <p>
              Les campagnes en cours, des plus anciennes aux plus récentes. Pendant les 2 premiers jours, remplacez les testeurs qui ne se sont pas
              inscrits : la campagne doit garder au moins 13 inscrits confirmés.
            </p>
          }
        >
          <ListeCampagnes />
        </PageAdmin>
      )}
    </AccesAdmin>
  )
}
