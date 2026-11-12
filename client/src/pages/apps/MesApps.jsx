import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { listerMesApps } from '../../api/apps.js'
import { Alerte } from '../../components/Alerte.jsx'
import { Bouton, Indicateur } from '../../components/Bouton.jsx'
import { messageErreurGlobale } from '../../lib/messages.js'

const STATUTS = {
  brouillon: ['Brouillon', 'bg-ocre-clair text-alerte'],
  en_verification: ['En vérification', 'bg-indigo-clair text-[#1F3457]'],
  validee: ['Validée', 'bg-succes-clair text-succes'],
  refusee: ['Refusée', 'bg-erreur-clair text-erreur'],
}

const lienBouton =
  'inline-flex h-11 items-center justify-center rounded-champ bg-accent px-[18px] text-[15px] font-semibold text-white hover:bg-accent-fonce'

// Apps du développeur validé, sur /mon-compte (US-11).
export function MesApps() {
  const [essai, setEssai] = useState(0)
  const [etat, setEtat] = useState({ essai: -1, apps: null, erreur: null })

  useEffect(() => {
    const controleur = new AbortController()
    listerMesApps({ signal: controleur.signal })
      .then(({ apps }) => setEtat({ essai, apps, erreur: null }))
      .catch((erreur) => {
        if (!controleur.signal.aborted) setEtat({ essai, apps: null, erreur })
      })
    return () => controleur.abort()
  }, [essai])

  const chargement = etat.essai !== essai

  return (
    <section aria-labelledby="titre-apps" className="mt-6">
      <h2 id="titre-apps" className="text-lg font-semibold text-encre">
        Vos apps
      </h2>
      {chargement && (
        <p role="status" className="mt-3 flex items-center gap-3 text-texte">
          <Indicateur className="size-5 text-accent" />
          Chargement de vos apps…
        </p>
      )}
      {!chargement && etat.erreur && (
        <div className="mt-3">
          <Alerte ton="erreur">{messageErreurGlobale(etat.erreur)}</Alerte>
          <Bouton type="button" variante="secondaire" className="mt-3" onClick={() => setEssai((n) => n + 1)}>
            Réessayer
          </Bouton>
        </div>
      )}
      {!chargement && etat.apps && (
        <>
          {etat.apps.length === 0 ? (
            <p className="mt-1 text-sm text-texte">Vous n’avez pas encore soumis d’app.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {etat.apps.map((app) => {
                const [libelle, couleurs] = STATUTS[app.statut] ?? [app.statut, 'bg-fond-doux text-encre']
                return (
                  <li key={app.id} className="rounded-carte border border-trait bg-white p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-semibold [overflow-wrap:anywhere] text-encre">{app.nom}</p>
                      <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${couleurs}`}>{libelle}</span>
                    </div>
                    <p className="mt-0.5 font-mono text-sm [overflow-wrap:anywhere] text-texte">{app.package}</p>
                    {app.statut === 'brouillon' && (
                      <>
                        <p className="mt-2 text-sm text-texte">Prochaine étape : le paiement de l’offre, bientôt disponible.</p>
                        <Link
                          to={`/mon-compte/apps/${app.id}/modifier`}
                          aria-label={`Modifier ${app.nom}`}
                          className="mt-2 inline-block text-sm font-semibold text-accent underline underline-offset-2"
                        >
                          Modifier
                        </Link>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          <Link to="/mon-compte/apps/nouvelle" className={`mt-4 w-full sm:w-auto ${lienBouton}`}>
            Soumettre une app
          </Link>
        </>
      )}
    </section>
  )
}
