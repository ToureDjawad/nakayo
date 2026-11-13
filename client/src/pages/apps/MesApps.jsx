import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { dateCourte } from '../../lib/campagnes.js'
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

const NOMS_OFFRES = { standard: 'Offre Standard', pro: 'Offre Pro', afrique: 'Offre Lancement Afrique' }

// Lien vers le devis Lancement Afrique (US-37), selon où il en est.
const LIENS_DEVIS = {
  aucun: 'Devis Lancement Afrique',
  demande: 'Devis Lancement Afrique à l’étude',
  propose: 'Devis Lancement Afrique reçu',
  refuse: 'Réponse au devis Lancement Afrique',
}

const lienBoutonPetit =
  'inline-flex h-10 items-center justify-center rounded-champ bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-fonce'

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
                // Montée en gamme (US-32) : une app payée en Standard, tant que sa campagne n'est pas terminée.
                const peutMonter =
                  (app.offre ?? 'standard') === 'standard' &&
                  ['en_verification', 'validee'].includes(app.statut) &&
                  app.campagne?.statut !== 'terminee'
                return (
                  <li key={app.id} className="rounded-carte border border-trait bg-white p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-semibold [overflow-wrap:anywhere] text-encre">{app.nom}</p>
                      <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${couleurs}`}>{libelle}</span>
                    </div>
                    <p className="mt-0.5 font-mono text-sm [overflow-wrap:anywhere] text-texte">{app.package}</p>
                    {app.statut !== 'brouillon' && (
                      <p className="mt-0.5 text-sm text-texte">{NOMS_OFFRES[app.offre] ?? NOMS_OFFRES.standard}</p>
                    )}
                    {app.statut === 'brouillon' && (
                      <>
                        <p className="mt-2 text-sm text-texte">Prochaine étape : le paiement de l’offre, puis la vérification par l’équipe.</p>
                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                          <Link to={`/mon-compte/apps/${app.id}/paiement`} aria-label={`Payer l’offre pour ${app.nom}`} className={lienBoutonPetit}>
                            Payer l’offre
                          </Link>
                          <Link
                            to={`/mon-compte/apps/${app.id}/modifier`}
                            aria-label={`Modifier ${app.nom}`}
                            className="text-sm font-semibold text-accent underline underline-offset-2"
                          >
                            Modifier
                          </Link>
                          <Link
                            to={`/mon-compte/apps/${app.id}/devis`}
                            aria-label={`${LIENS_DEVIS[app.devis?.statut ?? 'aucun']} : ${app.nom}`}
                            className="text-sm font-semibold text-accent underline underline-offset-2"
                          >
                            {LIENS_DEVIS[app.devis?.statut ?? 'aucun']}
                          </Link>
                        </div>
                      </>
                    )}
                    {app.statut === 'en_verification' && (
                      <p className="mt-2 text-sm text-texte">Offre payée. L’équipe vérifie votre app sous 24 h ouvrées avant de lancer la campagne.</p>
                    )}
                    {app.statut === 'validee' && !app.campagne && (
                      <p className="mt-2 text-sm text-texte">Votre app est validée : terminez la liste de vérification, puis démarrez la campagne.</p>
                    )}
                    {app.campagne && (
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                        <Link to={`/mon-compte/apps/${app.id}/campagne`} aria-label={`Suivre la campagne de ${app.nom}`} className={lienBoutonPetit}>
                          {app.campagne.statut === 'en_cours' ? 'Suivre la campagne' : 'Voir la campagne'}
                        </Link>
                        {app.offre && app.offre !== 'standard' && (
                          <Link
                            to={`/mon-compte/apps/${app.id}/bugs`}
                            aria-label={`Bugs signalés pour ${app.nom}`}
                            className="text-sm font-semibold text-accent underline underline-offset-2"
                          >
                            Bugs signalés
                          </Link>
                        )}
                        <span className="text-sm text-texte">
                          {app.campagne.statut === 'en_cours'
                            ? `Campagne en cours depuis le ${dateCourte(app.campagne.demarreeLe)}.`
                            : 'Campagne terminée.'}
                        </span>
                      </div>
                    )}
                    {['en_verification', 'validee'].includes(app.statut) && !app.campagne && (
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                        <Link
                          to={`/mon-compte/apps/${app.id}/preparation`}
                          aria-label={`Préparer le lancement de ${app.nom}`}
                          className={app.preparation?.complete ? 'text-sm font-semibold text-accent underline underline-offset-2' : lienBoutonPetit}
                        >
                          Préparer le lancement
                        </Link>
                        <span className="text-sm text-texte">
                          {app.preparation?.complete
                            ? 'Liste de vérification complète.'
                            : `${app.preparation?.elements.length ?? 0} sur 6 points vérifiés.`}
                        </span>
                      </div>
                    )}
                    {peutMonter && (
                      <p className="mt-3 text-sm">
                        <Link
                          to={`/mon-compte/apps/${app.id}/montee-en-gamme`}
                          aria-label={`Passer à l’Offre Pro : ${app.nom}`}
                          className="font-semibold text-accent underline underline-offset-2"
                        >
                          Passer à l’Offre Pro
                        </Link>
                        <span className="text-texte"> : testeurs confirmés et mieux payés, vous ne réglez que la différence.</span>
                      </p>
                    )}
                    {app.statut === 'refusee' && (
                      <div className="mt-2 text-sm text-texte">
                        <p>
                          <span className="font-semibold text-encre">Motif :</span> <span className="[overflow-wrap:anywhere]">{app.motifRefus}</span>
                        </p>
                        <p className="mt-1">Votre paiement vous est remboursé. Vous pouvez soumettre l’app à nouveau une fois le problème corrigé.</p>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          <Link to="/mon-compte/apps/nouvelle" className={`mt-4 w-full sm:w-auto ${lienBouton}`}>
            Soumettre une app
          </Link>
          {etat.apps.some((app) => app.statut !== 'brouillon') && (
            <p className="mt-3 text-sm">
              <Link to="/mon-compte/paiements" className="font-semibold text-accent underline underline-offset-2">
                Vos paiements et factures
              </Link>
            </p>
          )}
        </>
      )}
    </section>
  )
}
