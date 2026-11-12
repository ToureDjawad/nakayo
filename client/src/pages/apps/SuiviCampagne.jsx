import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { lireCampagne } from '../../api/apps.js'
import { ErreurApi } from '../../api/client.js'
import { Alerte } from '../../components/Alerte.jsx'
import { Bouton, Indicateur } from '../../components/Bouton.jsx'
import { AdresseGroupe, BoutonCopier } from '../../components/Copier.jsx'
import { AvancementCampagne } from './AvancementCampagne.jsx'
import { PageCompte, PanneauEtapes } from '../../components/MiseEnPage.jsx'
import { csvGmails, dateCourte, telechargerTexte } from '../../lib/campagnes.js'
import { messageErreurGlobale } from '../../lib/messages.js'
import { useSession } from '../../lib/useSession.js'

const TITRE = 'Suivi de la campagne'

const PANNEAU = (
  <PanneauEtapes
    titre="16 jours pour en garder 14"
    etapes={[
      { titre: 'Les testeurs s’inscrivent', detail: 'Chacun confirme son inscription avec une capture de Google Play.' },
      { titre: 'Ils testent chaque jour', detail: 'L’app Nakayo mesure leur temps d’utilisation et recueille leur rapport.' },
      { titre: 'Vous gardez le test ouvert', detail: 'Google compte 14 jours d’inscription continue.' },
    ]}
  />
)

const STATUTS = {
  en_cours: 'En cours',
  terminee: 'Terminée',
  annulee: 'Annulée',
}

function Compteur({ valeur, total, libelle, alerte }) {
  return (
    <div className={`rounded-carte border bg-white p-4 ${alerte ? 'border-erreur' : 'border-trait'}`}>
      <p className="font-titre text-3xl font-semibold text-encre">
        {valeur}
        {total !== undefined && <span className="text-base font-normal text-discret"> sur {total}</span>}
      </p>
      <p className="mt-1 text-sm text-texte">{libelle}</p>
    </div>
  )
}

function Etat({ ok, oui, non }) {
  return <span className={ok ? 'font-medium text-succes' : 'text-discret'}>{ok ? oui : non}</span>
}

function Campagne({ campagne, annonce }) {
  const { compteurs } = campagne
  const enCours = campagne.statut === 'en_cours'
  const gmails = campagne.testeurs.map((t) => t.gmail).join(', ')

  return (
    <div className="space-y-8">
      {annonce && (
        <Alerte ton="succes" titre="La campagne a démarré">
          {compteurs.affectes} testeurs sont affectés à votre app et viennent d’être prévenus. Ils s’inscrivent dans les prochaines heures.
        </Alerte>
      )}

      <section aria-labelledby="avancement">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="avancement" className="text-lg font-semibold text-encre">
            {enCours ? `Jour ${campagne.jour} sur ${campagne.joursCampagne}` : `Campagne ${STATUTS[campagne.statut]?.toLowerCase() ?? campagne.statut}`}
          </h2>
          <p className="text-sm text-texte">
            Du {dateCourte(campagne.demarreeLe)} au {dateCourte(campagne.termineeLe ?? campagne.finPrevueLe)}
          </p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-fond-doux" aria-hidden="true">
          <div className="h-full rounded-full bg-accent" style={{ width: `${(campagne.jour / campagne.joursCampagne) * 100}%` }} />
        </div>
        <p className="mt-2 text-sm text-texte">
          {campagne.joursExiges} jours sont exigés par Google ; les {campagne.joursCampagne - campagne.joursExiges} jours de plus laissent une marge.
        </p>
      </section>

      <section aria-labelledby="testeurs-chiffres">
        <h2 id="testeurs-chiffres" className="sr-only">
          Testeurs
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Compteur valeur={compteurs.affectes} total={campagne.testeursVises} libelle="testeurs affectés" />
          <Compteur valeur={compteurs.inscritsConfirmes} total={compteurs.affectes} libelle="inscriptions confirmées" alerte={campagne.alerteInscrits} />
          <Compteur valeur={compteurs.installes} total={compteurs.affectes} libelle="apps installées" />
        </div>
        {campagne.alerteInscrits && (
          <Alerte ton="erreur" titre="Moins de 13 inscriptions confirmées" className="mt-4">
            Vérifiez dans la Play Console que le groupe est bien ajouté au test fermé et que le Bénin est coché. Notre équipe remplace les testeurs
            qui ne s’inscrivent pas.
          </Alerte>
        )}
      </section>

      {enCours && (
        <section aria-labelledby="groupe" className="rounded-carte border border-trait bg-white p-5">
          <h2 id="groupe" className="font-semibold text-encre">
            Le groupe des testeurs
          </h2>
          {campagne.groupeGoogle ? (
            <>
              <p className="mt-1 text-sm text-texte">Il doit rester dans l’onglet Testeurs de votre test fermé jusqu’à la fin.</p>
              <AdresseGroupe adresse={campagne.groupeGoogle} />
            </>
          ) : (
            <p className="mt-1 text-sm text-texte">Ajoutez les adresses ci-dessous à la liste de testeurs de votre test fermé.</p>
          )}
          <details className="mt-4 text-sm text-texte" open={!campagne.groupeGoogle}>
            <summary className="cursor-pointer font-semibold text-encre">Méthode de secours : la liste des Gmail</summary>
            <p className="mt-2">Si le groupe ne fonctionne pas, collez ces adresses dans une liste de diffusion de votre test fermé.</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
              <BoutonCopier texte={gmails} libelle="Copier les adresses" libelleCopie="Adresses copiées" />
              <button
                type="button"
                onClick={() => telechargerTexte(csvGmails(campagne.testeurs), `testeurs-${campagne.app.package}.csv`)}
                className="text-sm font-semibold text-accent underline-offset-2 hover:underline"
              >
                Télécharger en CSV
              </button>
            </div>
          </details>
        </section>
      )}

      <AvancementCampagne appId={campagne.app.id} />

      <section aria-labelledby="liste-testeurs">
        <h2 id="liste-testeurs" className="text-lg font-semibold text-encre">
          Vos testeurs
        </h2>
        <ul className="mt-3 divide-y divide-trait rounded-carte border border-trait bg-white">
          {campagne.testeurs.map((t) => (
            <li key={t.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
              <p className="font-semibold text-encre">
                Testeur {t.numero} <span className="font-normal text-discret">· {t.ville}</span>
              </p>
              <p className="flex flex-wrap gap-x-3 text-texte">
                <Etat ok={t.inscriptionConfirmee} oui="Inscrit" non="Inscription en attente" />
                {t.inscriptionConfirmee && <Etat ok={t.installationConfirmee} oui="App installée" non="Installation en attente" />}
                <span>
                  {t.joursValides} jour{t.joursValides > 1 ? 's' : ''} validé{t.joursValides > 1 ? 's' : ''}
                </span>
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-texte">
          Un jour est validé quand le testeur a ouvert l’app Nakayo, utilisé votre app au moins 2 minutes et envoyé son rapport.
        </p>
      </section>

      <p>
        <Link to="/mon-compte" className="font-medium text-accent underline underline-offset-2">
          Retour à mon compte
        </Link>
      </p>
    </div>
  )
}

function Chargement() {
  return (
    <p role="status" className="flex items-center gap-3 text-texte">
      <Indicateur className="size-5 text-accent" />
      Chargement…
    </p>
  )
}

function Suivi({ id, utilisateur }) {
  const { state } = useLocation()
  const [essai, setEssai] = useState(0)
  const [etat, setEtat] = useState({ cle: null, campagne: null, erreur: null })
  const cle = `${id}:${essai}`

  useEffect(() => {
    const controleur = new AbortController()
    lireCampagne(id, { signal: controleur.signal })
      .then(({ campagne }) => setEtat({ cle, campagne, erreur: null }))
      .catch((erreur) => {
        if (!controleur.signal.aborted) setEtat({ cle, campagne: null, erreur })
      })
    return () => controleur.abort()
  }, [id, cle])

  const page = (contenu, intro) => (
    <PageCompte titre={TITRE} utilisateur={utilisateur} panneau={PANNEAU} intro={intro}>
      {contenu}
    </PageCompte>
  )
  if (etat.cle !== cle) return page(<Chargement />)
  if (etat.erreur) {
    const absente = etat.erreur instanceof ErreurApi && etat.erreur.statut === 404
    return page(
      <>
        <Alerte ton="erreur">{absente ? 'Cette app est introuvable.' : messageErreurGlobale(etat.erreur)}</Alerte>
        {!absente && (
          <Bouton type="button" variante="secondaire" className="mt-4" onClick={() => setEssai((n) => n + 1)}>
            Réessayer
          </Bouton>
        )}
      </>,
    )
  }
  if (!etat.campagne) {
    return page(
      <>
        <Alerte ton="info">La campagne de cette app n’a pas encore démarré.</Alerte>
        <p className="mt-6">
          <Link to={`/mon-compte/apps/${id}/preparation`} className="font-medium text-accent underline underline-offset-2">
            Préparer le lancement
          </Link>
        </p>
      </>,
    )
  }
  return page(
    <Campagne campagne={etat.campagne} annonce={state?.demarree} />,
    <p>
      Pour « <span className="[overflow-wrap:anywhere]">{etat.campagne.app.nom}</span> ».
    </p>,
  )
}

// /mon-compte/apps/:id/campagne (US-16, US-43, US-21).
export default function SuiviCampagne() {
  const { id } = useParams()
  const session = useSession()

  if (session.etat === 'chargement') {
    return (
      <PageCompte titre={TITRE} panneau={PANNEAU}>
        <Chargement />
      </PageCompte>
    )
  }
  if (session.etat === 'erreur') {
    return (
      <PageCompte titre={TITRE} panneau={PANNEAU}>
        <Alerte ton="erreur">{messageErreurGlobale(session.erreur)}</Alerte>
        <Bouton type="button" className="mt-6 w-full" onClick={session.recharger}>
          Réessayer
        </Bouton>
      </PageCompte>
    )
  }
  if (session.etat === 'deconnecte') {
    return (
      <PageCompte titre={TITRE} panneau={PANNEAU}>
        <p className="text-texte">
          <Link to={`/connexion?suite=${encodeURIComponent(`/mon-compte/apps/${id}/campagne`)}`} className="font-medium text-accent underline underline-offset-2">
            Connectez-vous
          </Link>{' '}
          pour suivre votre campagne.
        </p>
      </PageCompte>
    )
  }
  if (session.utilisateur.role !== 'developpeur') {
    return (
      <PageCompte titre={TITRE} utilisateur={session.utilisateur} panneau={PANNEAU}>
        <p className="text-texte">Cette page est réservée aux comptes développeur.</p>
      </PageCompte>
    )
  }
  return <Suivi id={id} utilisateur={session.utilisateur} />
}
