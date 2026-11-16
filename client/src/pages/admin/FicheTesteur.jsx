import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { lireHistoriqueTesteur } from '../../api/admin.js'
import { ErreurApi } from '../../api/client.js'
import { Alerte } from '../../components/Alerte.jsx'
import { Bouton, Indicateur } from '../../components/Bouton.jsx'
import { PageAdmin } from '../../components/MiseEnPage.jsx'
import { duree, jourCourt, jourLong } from '../../lib/campagnes.js'
import { dateHeure, FUSEAU_BENIN, operateur, telephone } from '../../lib/format.js'
import { messageErreurGlobale } from '../../lib/messages.js'
import { AccesAdmin } from './AccesAdmin.jsx'
import { ActionsSanction } from './ActionsSanction.jsx'

// US-31 : fiche d'un testeur pour trancher un litige (docs/fiche-testeur.md).
const TITRE = 'Fiche testeur'
const STATUTS = { valide: 'Validé', suspendu: 'Suspendu', banni: 'Banni', en_attente: 'En attente', refuse: 'Refusé' }
const AFFECTATIONS = { active: 'En cours', terminee: 'Terminée', remplacee: 'Remplacé' }
const formatHeure = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: FUSEAU_BENIN })
const heure = (iso) => (iso ? formatHeure.format(new Date(iso)) : '')
const etatJour = (j) => (j.valide === null ? 'À vérifier' : j.valide ? 'Validé' : 'Non validé')

// Temps d'usage par jour : une seule série, barres fines ancrées sur la ligne de base.
function GraphiqueTemps({ jours }) {
  const L = 640
  const H = 180
  const bas = 24
  const haut = 12
  const max = Math.max(...jours.map((j) => j.usageSecondes), 600)
  const pas = L / jours.length
  const largeur = Math.max(4, Math.min(28, pas - 2))
  const y = (s) => H - bas - (s / max) * (H - bas - haut)
  return (
    <figure className="mt-3">
      <svg viewBox={`0 0 ${L} ${H}`} className="h-auto w-full" role="img" aria-label="Temps passé dans l’app testée, jour par jour">
        <line x1="0" x2={L} y1={H - bas} y2={H - bas} stroke="var(--color-trait)" strokeWidth="1" />
        <text x="0" y={haut - 2} fontSize="11" fill="var(--color-discret)">
          {duree(max)}
        </text>
        {jours.map((j, i) => {
          const x = i * pas + (pas - largeur) / 2
          const h = Math.max(0, H - bas - y(j.usageSecondes))
          const r = Math.min(4, h / 2, largeur / 2)
          return (
            <g key={j.jour}>
              <title>{`${jourCourt(j.jour)} : ${duree(j.usageSecondes)}, ${etatJour(j).toLowerCase()}`}</title>
              <rect x={i * pas} y="0" width={pas} height={H} fill="transparent" />
              {h > 0 && (
                <path
                  d={`M${x},${H - bas} V${H - bas - h + r} Q${x},${H - bas - h} ${x + r},${H - bas - h} H${x + largeur - r} Q${x + largeur},${H - bas - h} ${x + largeur},${H - bas - h + r} V${H - bas} Z`}
                  fill="var(--color-accent)"
                />
              )}
              {(i === 0 || i === jours.length - 1 || jours.length <= 8) && (
                <text x={i * pas + pas / 2} y={H - 6} fontSize="11" textAnchor="middle" fill="var(--color-discret)">
                  {jourCourt(j.jour)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <figcaption className="text-xs text-discret">Le détail jour par jour est dans le tableau ci-dessous.</figcaption>
    </figure>
  )
}

// Positions des rapports (arrondies à 1 km) : nuage de points, chaque point ouvre OpenStreetMap.
function CartePositions({ rapports }) {
  const points = rapports.map((r) => ({ ...r.position, jour: r.jour }))
  const lats = points.map((p) => p.latitude)
  const lons = points.map((p) => p.longitude)
  const marge = 0.02
  const [minLat, maxLat] = [Math.min(...lats) - marge, Math.max(...lats) + marge]
  const [minLon, maxLon] = [Math.min(...lons) - marge, Math.max(...lons) + marge]
  const L = 320
  const H = 220
  const x = (lon) => ((lon - minLon) / (maxLon - minLon)) * L
  const y = (lat) => H - ((lat - minLat) / (maxLat - minLat)) * H
  const lieux = new Map()
  for (const p of points) {
    const cle = `${p.latitude},${p.longitude}`
    lieux.set(cle, [...(lieux.get(cle) ?? []), p])
  }
  return (
    <div className="mt-3 grid gap-4 md:grid-cols-[20rem_1fr]">
      <svg viewBox={`0 0 ${L} ${H}`} className="h-auto w-full rounded-champ border border-trait bg-sable" role="img" aria-label={`${lieux.size} lieu(x) d’envoi des rapports`}>
        {[...lieux.entries()].map(([cle, liste]) => (
          <a key={cle} href={`https://www.openstreetmap.org/?mlat=${liste[0].latitude}&mlon=${liste[0].longitude}#map=13/${liste[0].latitude}/${liste[0].longitude}`} target="_blank" rel="noopener noreferrer">
            <title>{`${cle} : ${liste.length} rapport(s)`}</title>
            <circle cx={x(liste[0].longitude)} cy={y(liste[0].latitude)} r={Math.min(14, 5 + liste.length)} fill="var(--color-accent)" stroke="var(--color-papier)" strokeWidth="2" />
          </a>
        ))}
      </svg>
      <ul className="space-y-1 text-sm text-texte">
        {[...lieux.entries()].map(([cle, liste]) => (
          <li key={cle}>
            <a
              href={`https://www.openstreetmap.org/?mlat=${liste[0].latitude}&mlon=${liste[0].longitude}#map=13/${liste[0].latitude}/${liste[0].longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-accent underline underline-offset-2"
            >
              {cle.replace(',', ', ')}
              <span className="sr-only"> (nouvel onglet)</span>
            </a>{' '}
            · {liste.length} rapport{liste.length > 1 ? 's' : ''} ({liste.map((p) => jourCourt(p.jour)).join(', ')})
          </li>
        ))}
      </ul>
    </div>
  )
}

function Section({ id, titre, children }) {
  return (
    <section aria-labelledby={id} className="rounded-carte border border-trait bg-white p-5">
      <h2 id={id} className="text-lg font-semibold text-encre">
        {titre}
      </h2>
      {children}
    </section>
  )
}

function Fiche({ donnees, onChoisir, onRecharger }) {
  const { testeur: t, affectations, affectation, jours, rapports, alertes } = donnees
  const [annonce, setAnnonce] = useState(null)
  return (
    <div className="space-y-6">
      {annonce && <Alerte ton={annonce.ton}>{annonce.texte}</Alerte>}
      <Section id="identite" titre={t.nom}>
        <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-discret">Statut</dt>
          <dd className="text-encre">{STATUTS[t.statut] ?? t.statut}</dd>
          <dt className="text-discret">Niveau</dt>
          <dd className="text-encre">
            {t.niveau.nom} · {t.niveau.campagnesTerminees} campagne(s) menée(s), assiduité {t.niveau.assiduite} %
          </dd>
          <dt className="text-discret">Téléphone</dt>
          <dd className="text-encre">{telephone(t.telephone)}</dd>
          <dt className="text-discret">Ville</dt>
          <dd className="text-encre">{t.ville}</dd>
          <dt className="text-discret">Gmail</dt>
          <dd className="text-encre [overflow-wrap:anywhere]">{t.gmail}</dd>
          <dt className="text-discret">Mobile Money</dt>
          <dd className="text-encre">
            {telephone(t.numeroMomo)} ({operateur(t.operateurMomo)})
          </dd>
          <dt className="text-discret">Inscrit le</dt>
          <dd className="text-encre">{dateHeure(t.inscritLe)}</dd>
          {t.motifSanction && (
            <>
              <dt className="text-discret">Motif de la sanction</dt>
              <dd className="text-encre">{t.motifSanction}</dd>
            </>
          )}
        </dl>
        <div className="mt-4">
          <ActionsSanction
            compte={{ id: t.id, nom: t.nom, role: 'testeur', statut: t.statut }}
            onTraite={(_id, message) => {
              setAnnonce(message)
              onRecharger()
            }}
          />
        </div>
      </Section>

      {alertes.length > 0 && (
        <Section id="alertes" titre="Alertes de fraude">
          <ul className="mt-3 space-y-2 text-sm">
            {alertes.map((a) => (
              <li key={a.id}>
                <span className="font-semibold text-encre">{a.libelle}</span>
                <span className="text-discret">
                  {' '}
                  · {a.statut === 'ouverte' ? 'à examiner' : a.statut === 'confirmee' ? 'confirmée' : 'écartée'} · {dateHeure(a.creeLe)}
                </span>
                <span className="block text-texte">{a.detail}</span>
              </li>
            ))}
          </ul>
          <Link to="/admin/alertes" className="mt-3 inline-block text-sm font-medium text-accent underline underline-offset-2">
            Voir les alertes à examiner
          </Link>
        </Section>
      )}

      {affectations.length === 0 ? (
        <p className="text-texte">Ce testeur n’a encore participé à aucune campagne.</p>
      ) : (
        <>
          <div>
            <label htmlFor="campagne" className="block text-sm font-medium text-encre">
              Campagne
            </label>
            <select
              id="campagne"
              value={affectation}
              onChange={(e) => onChoisir(e.target.value)}
              className="mt-1 block h-11 w-full max-w-md rounded-champ border border-trait bg-white px-3 text-base text-encre"
            >
              {affectations.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.app} · {AFFECTATIONS[a.statut] ?? a.statut} · {a.joursValides}/{a.joursExiges} jours
                </option>
              ))}
            </select>
          </div>

          <Section id="temps" titre="Temps passé et connexions">
            {jours.length > 0 && <GraphiqueTemps jours={jours} />}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <caption className="sr-only">Jour par jour : connexions à l’app compagnon (heure du serveur), temps, rapport et validation</caption>
                <thead className="text-discret">
                  <tr>
                    <th scope="col" className="py-2 pr-3 font-medium">Jour</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Connexions</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Temps</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Rapport</th>
                    <th scope="col" className="py-2 font-medium">Journée</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-trait text-encre">
                  {jours.map((j) => (
                    <tr key={j.jour}>
                      <th scope="row" className="py-2 pr-3 font-normal">{jourLong(j.jour)}</th>
                      <td className="py-2 pr-3">{j.connexion ? `${j.connexion.nombre} (${heure(j.connexion.premiere)} à ${heure(j.connexion.derniere)})` : 'Aucune'}</td>
                      <td className="py-2 pr-3">{duree(j.usageSecondes)}</td>
                      <td className="py-2 pr-3">{j.rapport ? 'Envoyé' : 'Non'}</td>
                      <td className="py-2">{etatJour(j)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="positions" titre="Positions des rapports">
            {rapports.length ? <CartePositions rapports={rapports} /> : <p className="mt-2 text-sm text-texte">Aucun rapport pour cette campagne.</p>}
          </Section>

          <Section id="rapports" titre="Historique des rapports">
            {rapports.length === 0 ? (
              <p className="mt-2 text-sm text-texte">Aucun rapport pour cette campagne.</p>
            ) : (
              <ul className="mt-3 divide-y divide-trait">
                {rapports.map((r) => (
                  <li key={r.jour} className="py-3 text-sm">
                    <p className="font-semibold text-encre">
                      {jourLong(r.jour)} <span className="font-normal text-discret">· reçu le {dateHeure(r.recuLe)} · version {r.versionApp} · note {r.note} sur 5</span>
                    </p>
                    <p className="mt-1 whitespace-pre-line text-encre">{r.actions}</p>
                    <p className="text-texte">Fonctionnalités : {r.fonctionnalites.join(', ')}</p>
                    {r.bug && <p className="text-texte">Bug : {r.bug}</p>}
                    {r.retourDetaille && <p className="mt-1 whitespace-pre-line text-texte">{r.retourDetaille}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}
    </div>
  )
}

function Contenu() {
  const { id } = useParams()
  const [parametres, setParametres] = useSearchParams()
  const affectation = parametres.get('campagne')
  const [essai, setEssai] = useState(0)
  const [etat, setEtat] = useState({ cle: null, donnees: null, erreur: null })
  const cle = `${id}:${affectation}:${essai}`

  useEffect(() => {
    const controleur = new AbortController()
    lireHistoriqueTesteur(id, { affectation }, { signal: controleur.signal })
      .then((donnees) => setEtat({ cle, donnees, erreur: null }))
      .catch((erreur) => {
        if (!controleur.signal.aborted) setEtat({ cle, donnees: null, erreur })
      })
    return () => controleur.abort()
  }, [id, affectation, cle])

  if (etat.erreur) {
    const absent = etat.erreur instanceof ErreurApi && etat.erreur.statut === 404
    return (
      <div>
        <Alerte ton="erreur">{absent ? 'Testeur introuvable.' : messageErreurGlobale(etat.erreur)}</Alerte>
        {!absent && (
          <Bouton type="button" variante="secondaire" className="mt-3" onClick={() => setEssai((n) => n + 1)}>
            Réessayer
          </Bouton>
        )}
      </div>
    )
  }
  if (!etat.donnees) {
    return (
      <p role="status" className="flex items-center gap-3 text-texte">
        <Indicateur className="size-5 text-accent" />
        Chargement…
      </p>
    )
  }
  return <Fiche donnees={etat.donnees} onChoisir={(a) => setParametres({ campagne: a })} onRecharger={() => setEssai((n) => n + 1)} />
}

export default function FicheTesteur() {
  return (
    <AccesAdmin titre={TITRE}>
      {(utilisateur) => (
        <PageAdmin titre={TITRE} utilisateur={utilisateur} intro={<p>Tout ce qu’a fait le testeur, campagne par campagne, pour trancher un litige.</p>}>
          <Contenu />
        </PageAdmin>
      )}
    </AccesAdmin>
  )
}
