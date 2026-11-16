import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { validerCompte } from '../../api/admin.js'
import { ErreurApi } from '../../api/client.js'
import { Alerte } from '../../components/Alerte.jsx'
import { Bouton } from '../../components/Bouton.jsx'
import { dateHeure, operateur, ROLES, telephone } from '../../lib/format.js'
import { messageErreurGlobale } from '../../lib/messages.js'
import { nomPays } from '../../lib/pays.js'
import { Controles } from './Controles.jsx'
import { Documents } from './Documents.jsx'
import { FormulaireRefus } from './FormulaireRefus.jsx'
import { ActionsSanction } from './ActionsSanction.jsx'
import { resumeControles } from './resumeControles.js'

const TONS_RESUME = {
  erreur: 'text-erreur',
  alerte: 'text-alerte',
  succes: 'text-succes',
  discret: 'text-discret',
}

function Infos({ compte }) {
  let lignes
  if (compte.role === 'developpeur' && compte.developpeur) {
    const d = compte.developpeur
    lignes = [
      ['Email', d.email],
      ['Pays', nomPays(d.pays)],
      [
        'Fiche Google Play',
        <a
          key="fiche"
          href={d.lienFicheDeveloppeur}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline underline-offset-2 [overflow-wrap:anywhere]"
        >
          {d.lienFicheDeveloppeur}
          <span className="sr-only"> (nouvel onglet)</span>
        </a>,
      ],
    ]
  } else if (compte.testeur) {
    const t = compte.testeur
    const a = t.appareil
    lignes = [
      ['Téléphone', telephone(t.telephone)],
      ['Ville', t.ville],
      ['Gmail', t.gmail],
      ['Mobile Money', `${telephone(t.numeroMomo)} (${operateur(t.operateurMomo)})`],
      ['Appareil', a ? `${[a.fabricant, a.modele].filter(Boolean).join(' ')}, Android ${a.versionAndroid}` : 'Non renseigné'],
    ]
  } else {
    lignes = []
  }

  return (
    <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
      {lignes.map(([terme, valeur]) => (
        <div key={terme} className="contents">
          <dt className="text-discret">{terme}</dt>
          <dd className="text-encre [overflow-wrap:anywhere]">{valeur}</dd>
        </div>
      ))}
    </dl>
  )
}

export function CarteCompte({ compte, onTraite }) {
  const [mode, setMode] = useState('actions')
  const [validation, setValidation] = useState(false)
  const [erreur, setErreur] = useState(null)
  const refBoutonRefus = useRef(null)
  const idTitre = `compte-${compte.id}`
  const resume = resumeControles(compte.controles)
  const moyen = compte.role === 'testeur' ? 'par SMS' : 'par email'

  async function valider() {
    setErreur(null)
    setValidation(true)
    try {
      await validerCompte(compte.id)
      onTraite(compte.id, { ton: 'succes', texte: `Compte de ${compte.nom} validé. La personne est prévenue ${moyen}.` })
    } catch (err) {
      setValidation(false)
      if (err instanceof ErreurApi && err.code === 'statut_incompatible') dejaTraite()
      else setErreur(messageErreurGlobale(err))
    }
  }

  function dejaTraite() {
    onTraite(compte.id, {
      ton: 'alerte',
      texte: `Le compte de ${compte.nom} a déjà été traité par un autre administrateur. Il a été retiré de la liste.`,
    })
  }

  function annulerRefus() {
    setMode('actions')
    requestAnimationFrame(() => refBoutonRefus.current?.focus())
  }

  return (
    <article aria-labelledby={idTitre} className="rounded-carte border border-trait bg-white p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div>
          <h3 id={idTitre} className="text-lg font-semibold text-encre [overflow-wrap:anywhere]">
            {compte.nom}
          </h3>
          <p className="text-sm text-discret">
            <span className="font-medium text-texte">{ROLES[compte.role] ?? compte.role}</span> · inscrit le{' '}
            <time dateTime={compte.creeLe}>{dateHeure(compte.creeLe)}</time>
          </p>
        </div>
        <p className={`text-sm font-medium ${TONS_RESUME[resume.ton]}`}>{resume.texte}</p>
      </header>

      <div className="mt-4 grid gap-5 md:grid-cols-2">
        <Infos compte={compte} />
        <Controles controles={compte.controles} idTitre={`controles-${compte.id}`} />
      </div>

      {compte.role === 'testeur' && (
        <div className="mt-4">
          <Documents compte={compte} />
        </div>
      )}

      {compte.statut !== 'en_attente' ? (
        <div className="mt-5 border-t border-trait pt-4">
          {compte.motifSanction && (
            <p className="mb-4 text-sm text-texte">
              <span className="font-semibold text-encre">Motif de la sanction : </span>
              {compte.motifSanction}
            </p>
          )}
          {compte.role === 'testeur' && (
            <Link to={`/admin/testeurs/${compte.id}`} className="mb-4 inline-block text-sm font-medium text-accent underline underline-offset-2">
              Voir la fiche du testeur
            </Link>
          )}
          <ActionsSanction compte={compte} onTraite={onTraite} />
        </div>
      ) : (
      <div className="mt-5 border-t border-trait pt-4">
        {erreur && (
          <Alerte ton="erreur" className="mb-4">
            {erreur}
          </Alerte>
        )}
        {mode === 'refus' ? (
          <FormulaireRefus
            compte={compte}
            onAnnuler={annulerRefus}
            onDejaTraite={dejaTraite}
            onRefuse={() =>
              onTraite(compte.id, {
                ton: 'succes',
                texte: `Compte de ${compte.nom} refusé. Le motif est envoyé ${moyen}.`,
              })
            }
          />
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Bouton
              type="button"
              onClick={valider}
              chargement={validation}
              libelleChargement="Validation…"
              aria-label={`Valider le compte de ${compte.nom}`}
            >
              Valider
            </Bouton>
            <Bouton
              type="button"
              variante="secondaire"
              ref={refBoutonRefus}
              onClick={() => {
                setErreur(null)
                setMode('refus')
              }}
              disabled={validation}
              aria-label={`Refuser le compte de ${compte.nom}`}
            >
              Refuser
            </Bouton>
          </div>
        )}
      </div>
      )}
    </article>
  )
}
