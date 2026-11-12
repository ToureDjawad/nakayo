import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { lireTableauDeBord, relancerVersement } from '../../api/admin.js'
import { ErreurApi } from '../../api/client.js'
import { Alerte } from '../../components/Alerte.jsx'
import { Bouton, Indicateur } from '../../components/Bouton.jsx'
import { PageAdmin } from '../../components/MiseEnPage.jsx'
import { dateCourte, pourcentage } from '../../lib/campagnes.js'
import { operateur, pluriel, telephone } from '../../lib/format.js'
import { messageErreurGlobale } from '../../lib/messages.js'
import { AccesAdmin } from './AccesAdmin.jsx'

const TITRE = 'Tableau de bord'
const STATUTS = { en_cours: 'En cours', terminee: 'Terminée', annulee: 'Annulée' }
const fcfa = (n) => `${new Intl.NumberFormat('fr-FR').format(n).replace(/\s/g, ' ')} FCFA`

function Chiffre({ valeur, libelle, detail, ton }) {
  return (
    <div className="rounded-carte border border-trait bg-white p-4">
      <p className={`font-titre text-2xl font-semibold ${ton === 'alerte' ? 'text-erreur' : 'text-encre'}`}>{valeur}</p>
      <p className="mt-1 text-sm text-texte">{libelle}</p>
      {detail && <p className="mt-1 text-xs text-discret">{detail}</p>}
    </div>
  )
}

function Section({ id, titre, intro, children }) {
  return (
    <section aria-labelledby={id} className="mt-8 first:mt-0">
      <h2 id={id} className="text-lg font-semibold text-encre">
        {titre}
      </h2>
      {intro && <p className="mt-1 text-sm text-texte">{intro}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

// Réponses de Google indiquées par les développeurs (US-36) et campagnes annulées.
function detailTerminees(c) {
  const d = c.decisionsGoogle
  const morceaux = []
  if (d && d.acceptees + d.refusees > 0) {
    morceaux.push(`Google : ${pluriel(d.acceptees, 'acceptée', 'acceptées')}, ${pluriel(d.refusees, 'refusée', 'refusées')} (${pourcentage(d.tauxReussite)} de réussite).`)
  }
  if (c.annulees) morceaux.push(`${pluriel(c.annulees, 'annulée', 'annulées')}.`)
  return morceaux.join(' ') || undefined
}

function Campagnes({ c }) {
  return (
    <Section id="tdb-campagnes" titre="Campagnes">
      <div className="grid gap-3 sm:grid-cols-3">
        <Chiffre valeur={String(c.enCours)} libelle="en cours" />
        <Chiffre valeur={String(c.terminees)} libelle={c.terminees > 1 ? 'terminées' : 'terminée'} detail={detailTerminees(c)} />
        <Chiffre
          valeur={String(c.enRetard)}
          libelle="en retard"
          detail="Moins de 12 testeurs peuvent encore atteindre 14 jours."
          ton={c.enRetard ? 'alerte' : undefined}
        />
      </div>
      {c.retards.length > 0 && (
        <ul className="mt-3 divide-y divide-trait rounded-carte border border-trait bg-white">
          {c.retards.map((r) => (
            <li key={r.campagneId} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
              <span className="font-semibold [overflow-wrap:anywhere] text-encre">{r.appNom}</span>
              <span className="text-texte">
                Jour {r.jour} · {r.testeursEnBonneVoie} testeurs sur 12 en bonne voie
              </span>
            </li>
          ))}
        </ul>
      )}
      {c.retards.length > 0 && (
        <p className="mt-2 text-sm">
          <Link to="/admin/campagnes" className="font-semibold text-accent underline-offset-2 hover:underline">
            Voir les campagnes
          </Link>
        </p>
      )}
    </Section>
  )
}

function Testeurs({ t }) {
  return (
    <Section id="tdb-testeurs" titre="Testeurs">
      <div className="grid gap-3 sm:grid-cols-3">
        <Chiffre valeur={String(t.actifs)} libelle="testeurs actifs" detail={`Sur ${pluriel(t.valides, 'testeur validé', 'testeurs validés')}, app installée dans une campagne en cours.`} />
        <Chiffre
          valeur={pourcentage(t.tauxAbandon)}
          libelle="taux d’abandon"
          detail={`${pluriel(t.remplaces, 'testeur remplacé', 'testeurs remplacés')} sur ${pluriel(t.affectations, 'affectation', 'affectations')}.`}
        />
        <Chiffre valeur={String(t.avecRemise)} libelle={t.avecRemise > 1 ? 'compteurs remis à zéro' : 'compteur remis à zéro'} detail="Au moins une fois pendant une campagne." />
      </div>
    </Section>
  )
}

function Finances({ f }) {
  return (
    <Section id="tdb-finances" titre="Finances" intro={`Montants en FCFA ; les paiements par carte sont convertis à 1 $ = ${f.tauxUsdFcfa} FCFA.`}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Chiffre valeur={f.chiffreAffairesLisible} libelle="chiffre d’affaires" />
        <Chiffre valeur={f.versesTesteursLisible} libelle="versés aux testeurs" />
        <Chiffre valeur={f.dusTesteursLisible} libelle="à verser aux testeurs" />
        <Chiffre valeur={f.margeLisible} libelle="marge" detail="Hors frais des fournisseurs de paiement." />
      </div>
      {f.parApp.length > 0 && (
        <div className="mt-3 overflow-x-auto rounded-carte border border-trait bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Marge par app</caption>
            <thead className="border-b border-trait text-discret">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">App</th>
                <th scope="col" className="px-4 py-2 font-medium">Statut</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Encaissé</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Versé</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">À verser</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Marge</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-trait">
              {f.parApp.map((a) => (
                <tr key={a.campagneId}>
                  <th scope="row" className="px-4 py-2 font-normal">
                    <span className="block font-semibold [overflow-wrap:anywhere] text-encre">{a.appNom}</span>
                    <span className="block text-xs text-discret">
                      {a.developpeur} · {dateCourte(a.demarreeLe)}
                    </span>
                  </th>
                  <td className="px-4 py-2 text-texte">{STATUTS[a.statut] ?? a.statut}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap text-texte">{fcfa(a.encaisse)}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap text-texte">{fcfa(a.versesTesteurs)}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap text-texte">{fcfa(a.dusTesteurs)}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap text-encre">
                    {fcfa(a.marge)}
                    {!a.margeDefinitive && <span className="block text-xs text-discret">estimée</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {f.parApp.some((a) => !a.margeDefinitive) && (
        <p className="mt-2 text-xs text-discret">Campagne en cours : marge estimée en comptant les 15 testeurs payés.</p>
      )}
    </Section>
  )
}

function VersementsEchoues({ versements, onRelance }) {
  const [enCours, setEnCours] = useState(null)
  const [message, setMessage] = useState(null)

  async function relancer(v) {
    setEnCours(v.reference)
    setMessage(null)
    try {
      const { versement } = await relancerVersement(v.reference)
      setMessage({
        ton: versement.statut === 'verse' ? 'succes' : 'info',
        texte:
          versement.statut === 'verse'
            ? `${versement.montantLisible} versés à ${v.testeur.nom}. Le testeur est prévenu par SMS.`
            : `Versement à ${v.testeur.nom} relancé : nouvelle tentative en cours.`,
      })
      onRelance()
    } catch (err) {
      setMessage({ ton: 'erreur', texte: err instanceof ErreurApi && err.code === 'statut_incompatible' ? 'Ce versement n’est plus en échec.' : messageErreurGlobale(err) })
    } finally {
      setEnCours(null)
    }
  }

  return (
    <Section
      id="tdb-versements"
      titre="Versements MoMo échoués"
      intro="Après 4 essais. Vérifiez le compte avec le testeur, puis relancez : le numéro MoMo actuel du testeur est utilisé."
    >
      <div aria-live="polite">{message && <Alerte ton={message.ton} className="mb-3">{message.texte}</Alerte>}</div>
      {versements.length === 0 ? (
        <p className="rounded-carte border border-trait bg-white px-4 py-3 text-sm text-texte">Aucun versement en échec.</p>
      ) : (
        <ul className="divide-y divide-trait rounded-carte border border-trait bg-white">
          {versements.map((v) => (
            <li key={v.reference} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-semibold text-encre">
                  {v.testeur.nom} · {v.montantLisible}
                </p>
                <p className="text-texte">
                  {operateur(v.operateur)} {telephone(v.testeur.numeroMomo)} · app « {v.appNom} »
                </p>
                <p className="text-discret">
                  {v.dernierMotif ?? 'Motif inconnu'} · {v.reference}
                </p>
              </div>
              <Bouton
                type="button"
                variante="secondaire"
                chargement={enCours === v.reference}
                libelleChargement="Relance…"
                disabled={enCours !== null}
                onClick={() => relancer(v)}
                aria-label={`Relancer le versement à ${v.testeur.nom}`}
              >
                Relancer
              </Bouton>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

function Contenu() {
  const [essai, setEssai] = useState(0)
  const [etat, setEtat] = useState({ donnees: null, erreur: null })

  useEffect(() => {
    const controleur = new AbortController()
    lireTableauDeBord({ signal: controleur.signal })
      .then(({ tableauDeBord }) => setEtat({ donnees: tableauDeBord, erreur: null }))
      .catch((erreur) => {
        if (!controleur.signal.aborted) setEtat({ donnees: null, erreur })
      })
    return () => controleur.abort()
  }, [essai])

  if (etat.erreur) {
    return (
      <>
        <Alerte ton="erreur">{messageErreurGlobale(etat.erreur)}</Alerte>
        <Bouton type="button" className="mt-4" onClick={() => setEssai((n) => n + 1)}>
          Réessayer
        </Bouton>
      </>
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
  const t = etat.donnees
  return (
    <>
      <Campagnes c={t.campagnes} />
      <Testeurs t={t.testeurs} />
      <Finances f={t.finances} />
      <VersementsEchoues versements={t.versementsEchoues} onRelance={() => setEssai((n) => n + 1)} />
    </>
  )
}

// US-24 : vue d'ensemble de l'activité pour l'équipe Nakayo.
export default function TableauDeBord() {
  return (
    <AccesAdmin titre={TITRE}>
      {(utilisateur) => (
        <PageAdmin titre={TITRE} utilisateur={utilisateur} intro="L’activité de Nakayo en un coup d’œil.">
          <Contenu />
        </PageAdmin>
      )}
    </AccesAdmin>
  )
}
