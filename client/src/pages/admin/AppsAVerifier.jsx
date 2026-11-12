import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { listerAppsAVerifier, refuserApp, validerApp } from '../../api/admin.js'
import { ErreurApi } from '../../api/client.js'
import { Alerte } from '../../components/Alerte.jsx'
import { Bouton, Indicateur } from '../../components/Bouton.jsx'
import { ChampTexte } from '../../components/Champ.jsx'
import { PageAdmin } from '../../components/MiseEnPage.jsx'
import { dateHeure, pluriel } from '../../lib/format.js'
import { messageErreurGlobale } from '../../lib/messages.js'
import { useFormulaire } from '../../lib/useFormulaire.js'
import { LIMITES, validerMotifRefus } from '../../lib/validation.js'
import { AccesAdmin } from './AccesAdmin.jsx'

const TITRE = 'Apps à vérifier'
const ONGLETS = [
  { statut: 'en_verification', libelle: 'À vérifier' },
  { statut: 'validee', libelle: 'Validées' },
  { statut: 'refusee', libelle: 'Refusées' },
]
const COMPTES_PLAY = {
  personnel_recent: 'Personnel, créé après le 13/11/2023 (test de 14 jours obligatoire)',
  personnel_ancien: 'Personnel, créé avant le 13/11/2023',
  organisation: 'Organisation',
}
const MOYENS = { carte: 'carte', mobile_money: 'Mobile Money' }

// Points à contrôler avant de valider : les refus Google les plus fréquents.
const A_VERIFIER = [
  'Le lien du test fermé s’ouvre et vise bien le package indiqué.',
  'L’app n’est ni frauduleuse ni interdite par nos conditions.',
  'Les instructions et les fonctionnalités sont assez précises pour un testeur.',
  'Le compte de test fonctionne, si l’app demande une connexion.',
]

function Ligne({ terme, children }) {
  return (
    <div className="py-2.5 sm:grid sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm text-discret">{terme}</dt>
      <dd className="mt-0.5 [overflow-wrap:anywhere] text-encre sm:mt-0">{children}</dd>
    </div>
  )
}

function FormulaireRefusApp({ app, onRefuse, onDejaTraite, onAnnuler }) {
  const formulaire = useFormulaire({ motif: '' }, { motif: validerMotifRefus }, { prefixe: `refus-app-${app.id}-` })
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
      await refuserApp(app.id, formulaire.valeurs.motif.trim())
      onRefuse()
    } catch (err) {
      setEnvoi(false)
      if (err instanceof ErreurApi && err.code === 'statut_incompatible') onDejaTraite()
      else if (err instanceof ErreurApi && err.champs) formulaire.appliquerErreursServeur(err.champs)
      else setErreur(messageErreurGlobale(err))
    }
  }

  return (
    <form
      onSubmit={soumettre}
      noValidate
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !envoi) onAnnuler()
      }}
      className="mt-4 space-y-4 rounded-champ border border-trait bg-papier p-4"
      aria-label={`Refuser l’app ${app.nom}`}
    >
      <ChampTexte
        {...formulaire.lier('motif')}
        ref={refMotif}
        libelle="Motif du refus"
        aide={`Obligatoire. Il est envoyé par email au développeur, avec le remboursement de ${app.paiement?.montantLisible ?? 'son paiement'}.`}
        max={LIMITES.motifRefusMax}
        lignes={3}
      />
      {erreur && <Alerte ton="erreur">{erreur}</Alerte>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Bouton variante="danger" chargement={envoi} libelleChargement="Refus en cours…">
          Refuser et rembourser
        </Bouton>
        <Bouton type="button" variante="secondaire" onClick={onAnnuler} disabled={envoi}>
          Annuler
        </Bouton>
      </div>
    </form>
  )
}

function CarteApp({ app, onDecide }) {
  const [refus, setRefus] = useState(false)
  const [validation, setValidation] = useState(false)
  const [erreur, setErreur] = useState(null)
  const { developpeur, paiement } = app

  async function valider() {
    setValidation(true)
    setErreur(null)
    try {
      await validerApp(app.id)
      onDecide(app.id, `« ${app.nom} » est validée. Le développeur est prévenu par email.`)
    } catch (err) {
      setValidation(false)
      if (err instanceof ErreurApi && err.code === 'statut_incompatible') onDecide(app.id, `« ${app.nom} » avait déjà été traitée par un autre admin.`)
      else setErreur(messageErreurGlobale(err))
    }
  }

  return (
    <article aria-labelledby={`app-${app.id}`} className="rounded-carte border border-trait bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`app-${app.id}`} className="text-base font-semibold [overflow-wrap:anywhere] text-encre">
          {app.nom}
        </h3>
        <p className="text-sm text-discret">
          {app.statut === 'en_verification'
            ? `Payée le ${dateHeure(paiement?.confirmeLe ?? app.modifieLe)}`
            : `${app.statut === 'validee' ? 'Validée' : 'Refusée'} le ${dateHeure(app.decideLe)}`}
        </p>
      </div>
      <p className="mt-0.5 font-mono text-sm [overflow-wrap:anywhere] text-texte">{app.package}</p>

      <dl className="mt-3 divide-y divide-trait border-y border-trait">
        <Ligne terme="Développeur">
          {developpeur.nom} · {developpeur.email}
          {developpeur.lienFicheDeveloppeur && (
            <>
              {' · '}
              <a href={developpeur.lienFicheDeveloppeur} target="_blank" rel="noreferrer" className="font-medium text-accent underline underline-offset-2">
                fiche Google Play
              </a>
            </>
          )}
        </Ligne>
        <Ligne terme="Test fermé">
          <a href={app.lienTestFerme} target="_blank" rel="noreferrer" className="font-medium text-accent underline underline-offset-2">
            {app.lienTestFerme}
          </a>
        </Ligne>
        <Ligne terme="Compte Google Play">{COMPTES_PLAY[app.comptePlay] ?? app.comptePlay}</Ligne>
        <Ligne terme="Description">
          <span className="whitespace-pre-line">{app.description}</span>
        </Ligne>
        <Ligne terme="Instructions">
          <span className="whitespace-pre-line">{app.instructions}</span>
        </Ligne>
        <Ligne terme="Fonctionnalités">
          <ol className="list-decimal pl-5">
            {app.fonctionnalites.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ol>
        </Ligne>
        <Ligne terme="Compte de test">
          {app.connexionRequise ? <span className="font-mono text-sm whitespace-pre-line">{app.identifiantsTest}</span> : 'Pas de connexion dans l’app'}
        </Ligne>
        {paiement && (
          <Ligne terme="Paiement">
            {paiement.montantLisible} par {MOYENS[paiement.moyen] ?? paiement.moyen}
            {paiement.facture && ` · facture ${paiement.facture}`}
            {paiement.statut === 'rembourse' && ` · remboursé le ${dateHeure(paiement.rembourseLe)}`}
          </Ligne>
        )}
        {app.statut === 'refusee' && <Ligne terme="Motif du refus">{app.motifRefus}</Ligne>}
      </dl>

      {erreur && (
        <Alerte ton="erreur" className="mt-4">
          {erreur}
        </Alerte>
      )}

      {app.statut === 'en_verification' && (
        <>
          <details className="mt-4 text-sm text-texte">
            <summary className="cursor-pointer font-semibold text-encre">Points à vérifier</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {A_VERIFIER.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </details>
          {refus ? (
            <FormulaireRefusApp
              app={app}
              onRefuse={() => onDecide(app.id, `« ${app.nom} » est refusée. Le développeur est prévenu et remboursé.`)}
              onDejaTraite={() => onDecide(app.id, `« ${app.nom} » avait déjà été traitée par un autre admin.`)}
              onAnnuler={() => setRefus(false)}
            />
          ) : (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Bouton type="button" chargement={validation} libelleChargement="Validation…" onClick={valider} aria-label={`Valider ${app.nom}`}>
                Valider
              </Bouton>
              <Bouton type="button" variante="secondaire" disabled={validation} onClick={() => setRefus(true)} aria-label={`Refuser ${app.nom}`}>
                Refuser
              </Bouton>
            </div>
          )}
        </>
      )}
    </article>
  )
}

function ListeApps() {
  const [parametres, setParametres] = useSearchParams()
  const statut = ONGLETS.some((o) => o.statut === parametres.get('statut')) ? parametres.get('statut') : 'en_verification'
  const page = Math.max(1, Number.parseInt(parametres.get('page') ?? '1', 10) || 1)
  const [essai, setEssai] = useState(0)
  const [resultat, setResultat] = useState({ cle: null, donnees: null, erreur: null })
  const [annonce, setAnnonce] = useState(null)
  const cle = `${statut}:${page}:${essai}`

  useEffect(() => {
    const controleur = new AbortController()
    listerAppsAVerifier({ statut, page }, { signal: controleur.signal })
      .then((donnees) => setResultat({ cle, donnees, erreur: null }))
      .catch((erreur) => {
        if (!controleur.signal.aborted) setResultat({ cle, donnees: null, erreur })
      })
    return () => controleur.abort()
  }, [statut, page, cle])

  function changer(suivants) {
    setAnnonce(null)
    setParametres(suivants)
  }

  function retirer(id, message) {
    setAnnonce(message)
    setResultat((r) => (r.donnees ? { ...r, donnees: { ...r.donnees, apps: r.donnees.apps.filter((a) => a.id !== id), total: r.donnees.total - 1 } } : r))
  }

  const chargement = resultat.cle !== cle
  const { donnees, erreur } = resultat
  const pages = donnees ? Math.max(1, Math.ceil(donnees.total / donnees.parPage)) : 1
  const avecStatut = statut === 'en_verification' ? {} : { statut }

  const titreListe = () => {
    if (donnees.total === 0) return statut === 'en_verification' ? 'Aucune app à vérifier' : statut === 'validee' ? 'Aucune app validée' : 'Aucune app refusée'
    if (statut === 'en_verification') return `${pluriel(donnees.total, 'app')} à vérifier`
    return statut === 'validee' ? pluriel(donnees.total, 'app validée', 'apps validées') : pluriel(donnees.total, 'app refusée', 'apps refusées')
  }

  return (
    <div>
      <nav aria-label="Statut des apps" className="flex flex-wrap gap-2">
        {ONGLETS.map((o) => (
          <button
            key={o.statut}
            type="button"
            aria-current={statut === o.statut ? 'page' : undefined}
            onClick={() => changer(o.statut === 'en_verification' ? {} : { statut: o.statut })}
            className={`h-10 rounded-champ border px-4 text-sm font-semibold ${
              statut === o.statut ? 'border-encre bg-encre text-white' : 'border-trait bg-white text-encre hover:bg-fond-doux'
            }`}
          >
            {o.libelle}
          </button>
        ))}
      </nav>

      <div aria-live="polite" className="mt-4">
        {annonce && <Alerte ton="succes">{annonce}</Alerte>}
      </div>

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
            {titreListe()}
          </h2>
          <ul className="mt-4 space-y-4">
            {donnees.apps.map((a) => (
              <li key={a.id}>
                <CarteApp app={a} onDecide={retirer} />
              </li>
            ))}
          </ul>
          {pages > 1 && (
            <nav aria-label="Pagination" className="mt-6 flex items-center justify-between gap-4">
              <Bouton type="button" variante="secondaire" disabled={page <= 1} onClick={() => changer({ ...avecStatut, page: String(page - 1) })}>
                Précédent
              </Bouton>
              <p className="text-sm text-texte">
                Page {page} sur {pages}
              </p>
              <Bouton type="button" variante="secondaire" disabled={page >= pages} onClick={() => changer({ ...avecStatut, page: String(page + 1) })}>
                Suivant
              </Bouton>
            </nav>
          )}
        </section>
      )}
    </div>
  )
}

// /admin/apps : vérification des apps payées avant le lancement (US-14).
export default function AppsAVerifier() {
  return (
    <AccesAdmin titre={TITRE}>
      {(utilisateur) => (
        <PageAdmin
          titre={TITRE}
          utilisateur={utilisateur}
          intro={<p>Les apps payées, des plus anciennes aux plus récentes. Validez-les avant le lancement de la campagne, ou refusez-les avec un motif : le paiement est alors remboursé.</p>}
        >
          <ListeApps />
        </PageAdmin>
      )}
    </AccesAdmin>
  )
}
