import { useEffect, useState } from 'react'
import { lireJournal } from '../../api/admin.js'
import { Alerte } from '../../components/Alerte.jsx'
import { Bouton, Indicateur } from '../../components/Bouton.jsx'
import { PageAdmin } from '../../components/MiseEnPage.jsx'
import { dateHeure } from '../../lib/format.js'
import { messageErreurGlobale } from '../../lib/messages.js'
import { AccesAdmin } from './AccesAdmin.jsx'

// US-29 : qui a fait quoi dans le back-office (docs/sanctions.md).
const TITRE = 'Journal des actions'
const CIBLES = { compte: 'Compte', app: 'App', campagne: 'Campagne', versement: 'Versement', alerte: 'Alerte' }

function Journal() {
  const [page, setPage] = useState(1)
  const [essai, setEssai] = useState(0)
  const [resultat, setResultat] = useState({ cle: null, donnees: null, erreur: null })
  const cle = `${page}:${essai}`

  useEffect(() => {
    const controleur = new AbortController()
    lireJournal({ page }, { signal: controleur.signal })
      .then((donnees) => setResultat({ cle, donnees, erreur: null }))
      .catch((erreur) => {
        if (!controleur.signal.aborted) setResultat({ cle, donnees: null, erreur })
      })
    return () => controleur.abort()
  }, [page, cle])

  const { donnees, erreur } = resultat
  if (erreur) {
    return (
      <div>
        <Alerte ton="erreur">{messageErreurGlobale(erreur)}</Alerte>
        <Bouton type="button" variante="secondaire" className="mt-3" onClick={() => setEssai((n) => n + 1)}>
          Réessayer
        </Bouton>
      </div>
    )
  }
  if (!donnees) {
    return (
      <p role="status" className="flex items-center gap-3 text-texte">
        <Indicateur className="size-5 text-accent" />
        Chargement…
      </p>
    )
  }
  const pages = Math.max(1, Math.ceil(donnees.total / donnees.parPage))
  if (donnees.total === 0) return <p className="text-texte">Aucune action enregistrée pour le moment.</p>

  return (
    <section aria-label="Actions des administrateurs">
      <ul className="divide-y divide-trait rounded-carte border border-trait bg-white">
        {donnees.actions.map((a) => (
          <li key={a.id} className="p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold text-encre">
                {a.libelle}
                <span className="font-normal text-texte">
                  {' '}
                  · {CIBLES[a.cible.type] ?? a.cible.type} n° {a.cible.id}
                </span>
              </p>
              <p className="text-sm text-discret">{dateHeure(a.le)}</p>
            </div>
            <p className="text-sm text-texte">Par {a.admin.nom}</p>
            {a.detail && <p className="mt-1 whitespace-pre-line text-sm text-encre">{a.detail}</p>}
          </li>
        ))}
      </ul>
      {pages > 1 && (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-between gap-4">
          <Bouton type="button" variante="secondaire" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Précédent
          </Bouton>
          <p className="text-sm text-texte">
            Page {page} sur {pages}
          </p>
          <Bouton type="button" variante="secondaire" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            Suivant
          </Bouton>
        </nav>
      )}
    </section>
  )
}

export default function JournalAdmin() {
  return (
    <AccesAdmin titre={TITRE}>
      {(utilisateur) => (
        <PageAdmin titre={TITRE} utilisateur={utilisateur} intro={<p>Décisions, sanctions, remplacements et relances, de la plus récente à la plus ancienne.</p>}>
          <Journal />
        </PageAdmin>
      )}
    </AccesAdmin>
  )
}
