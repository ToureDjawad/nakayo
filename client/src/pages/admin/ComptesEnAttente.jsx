import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { construireRequeteComptes, listerComptes } from '../../api/admin.js'
import { Alerte } from '../../components/Alerte.jsx'
import { Bouton, Indicateur } from '../../components/Bouton.jsx'
import { pluriel } from '../../lib/format.js'
import { messageErreurGlobale } from '../../lib/messages.js'
import { validerPeriode } from '../../lib/validation.js'
import { PageAdmin } from '../../components/MiseEnPage.jsx'
import { AccesAdmin } from './AccesAdmin.jsx'
import { CarteCompte } from './CarteCompte.jsx'
import { Filtres } from './Filtres.jsx'

const TITRE = 'Comptes en attente'

// Les filtres vivent dans l'adresse : on peut partager un lien filtré ou revenir en arrière.
function lireFiltres(parametres) {
  const role = parametres.get('role')
  const page = Number.parseInt(parametres.get('page') ?? '1', 10)
  return {
    role: role === 'developpeur' || role === 'testeur' ? role : '',
    du: parametres.get('du') ?? '',
    au: parametres.get('au') ?? '',
    tri: parametres.get('tri') === 'recent' ? 'recent' : 'ancien',
    page: Number.isFinite(page) && page > 0 ? page : 1,
  }
}

function Pagination({ page, total, parPage, onPage }) {
  const pages = Math.max(1, Math.ceil(total / parPage))
  if (pages <= 1) return null
  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-between gap-4">
      <Bouton type="button" variante="secondaire" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Précédent
      </Bouton>
      <p className="text-sm text-texte">
        Page {page} sur {pages}
      </p>
      <Bouton type="button" variante="secondaire" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Suivant
      </Bouton>
    </nav>
  )
}

function ListeComptes() {
  const [parametres, setParametres] = useSearchParams()
  const cleParametres = parametres.toString()
  const filtres = useMemo(() => lireFiltres(new URLSearchParams(cleParametres)), [cleParametres])
  const erreursPeriode = validerPeriode(filtres.du, filtres.au)
  const periodeValide = Object.keys(erreursPeriode).length === 0
  const cleRequete = construireRequeteComptes(filtres)

  const [essai, setEssai] = useState(0)
  // Dernière réponse reçue, avec la clé de la requête qui l'a produite.
  const [resultat, setResultat] = useState({ cle: null, donnees: null, erreur: null })
  const [annonce, setAnnonce] = useState(null)
  const refTitre = useRef(null)

  const cleCourante = `${cleRequete}#${essai}`
  const chargement = periodeValide && resultat.cle !== cleCourante

  useEffect(() => {
    if (!periodeValide) return undefined
    const controleur = new AbortController()
    const cle = `${construireRequeteComptes(filtres)}#${essai}`
    listerComptes(filtres, { signal: controleur.signal })
      .then((donnees) => setResultat({ cle, donnees, erreur: null }))
      .catch((erreur) => {
        if (erreur?.name !== 'AbortError') setResultat((r) => ({ cle, donnees: r.donnees, erreur }))
      })
    return () => controleur.abort()
  }, [filtres, essai, periodeValide])

  function modifierParametres(modifs, { remplacer = true } = {}) {
    const suivants = new URLSearchParams(parametres)
    for (const [cle, valeur] of Object.entries(modifs)) {
      if (valeur === '' || valeur === null || valeur === undefined) suivants.delete(cle)
      else suivants.set(cle, String(valeur))
    }
    setParametres(suivants, { replace: remplacer })
  }

  function changerFiltre(nom, valeur) {
    setAnnonce(null)
    modifierParametres({ [nom]: nom === 'tri' && valeur === 'ancien' ? '' : valeur, page: '' })
  }

  function changerPage(page) {
    setAnnonce(null)
    modifierParametres({ page: page > 1 ? page : '' }, { remplacer: false })
    refTitre.current?.focus()
    window.scrollTo?.({ top: 0 })
  }

  // Retire un compte traité de la liste et annonce la décision. Si la page se vide
  // alors qu'il reste des comptes, on recharge (ou on revient à la dernière page).
  function retirer(id, message) {
    setAnnonce(message)
    const actuelles = resultat.donnees
    if (!actuelles) return
    const comptes = actuelles.comptes.filter((c) => c.id !== id)
    const total = Math.max(0, actuelles.total - 1)
    setResultat((r) => ({ ...r, donnees: { ...actuelles, comptes, total } }))

    if (comptes.length === 0 && total > 0) {
      const derniere = Math.max(1, Math.ceil(total / actuelles.parPage))
      if (filtres.page > derniere) modifierParametres({ page: derniere > 1 ? derniere : '' })
      else setEssai((n) => n + 1)
    }
    requestAnimationFrame(() => refTitre.current?.focus())
  }

  const donnees = resultat.donnees
  const erreur = resultat.cle === cleCourante ? resultat.erreur : null
  const filtresActifs = Boolean(filtres.role || filtres.du || filtres.au)

  return (
    <div>
      <Filtres
        filtres={filtres}
        erreurs={erreursPeriode}
        onChange={changerFiltre}
        onEffacer={() => {
          setAnnonce(null)
          setParametres(new URLSearchParams(), { replace: true })
        }}
      />

      {annonce && (
        <Alerte ton={annonce.ton} className="mt-5">
          {annonce.texte}
        </Alerte>
      )}

      {!periodeValide ? (
        <p className="mt-6 text-texte">Corrigez la période pour afficher les comptes.</p>
      ) : erreur && !donnees ? (
        <div className="mt-6">
          <Alerte ton="erreur">{messageErreurGlobale(erreur)}</Alerte>
          <Bouton type="button" className="mt-4" onClick={() => setEssai((n) => n + 1)}>
            Réessayer
          </Bouton>
        </div>
      ) : !donnees ? (
        <p role="status" className="mt-6 flex items-center gap-3 text-texte">
          <Indicateur className="size-5 text-accent" />
          Chargement des comptes…
        </p>
      ) : (
        <section aria-labelledby="titre-liste" aria-busy={chargement} className="mt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="titre-liste" ref={refTitre} tabIndex={-1} className="text-lg font-semibold text-encre">
              {donnees.total === 0
                ? 'Aucun compte en attente'
                : `${pluriel(donnees.total, 'compte')} en attente${filtresActifs ? ' pour ces filtres' : ''}`}
            </h2>
            {chargement && (
              <p role="status" className="flex items-center gap-2 text-sm text-discret">
                <Indicateur className="size-4" />
                Mise à jour…
              </p>
            )}
          </div>

          {erreur && (
            <div className="mt-4">
              <Alerte ton="erreur">{messageErreurGlobale(erreur)}</Alerte>
              <Bouton type="button" variante="secondaire" className="mt-3" onClick={() => setEssai((n) => n + 1)}>
                Réessayer
              </Bouton>
            </div>
          )}

          {donnees.total === 0 && (
            <p className="mt-2 text-texte">
              {filtresActifs
                ? 'Aucun compte ne correspond à ces filtres. Élargissez la période ou effacez les filtres.'
                : 'Les nouvelles inscriptions apparaîtront ici après la vérification de leur email ou de leur téléphone.'}
            </p>
          )}

          {donnees.comptes.length > 0 && (
            <ul className={`mt-4 space-y-4 ${chargement ? 'opacity-60' : ''}`}>
              {donnees.comptes.map((compte) => (
                <li key={compte.id}>
                  <CarteCompte compte={compte} onTraite={retirer} />
                </li>
              ))}
            </ul>
          )}

          <Pagination page={donnees.page} total={donnees.total} parPage={donnees.parPage} onPage={changerPage} />
        </section>
      )}
    </div>
  )
}

export default function ComptesEnAttente() {
  return (
    <AccesAdmin titre={TITRE}>
      {() => (
        <PageAdmin
          titre={TITRE}
          intro={<p>Vérifiez chaque compte avant de le valider. Un refus demande un motif, qui est envoyé à la personne.</p>}
        >
          <ListeComptes />
        </PageAdmin>
      )}
    </AccesAdmin>
  )
}
