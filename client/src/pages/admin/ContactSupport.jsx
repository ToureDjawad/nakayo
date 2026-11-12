import { useEffect, useState } from 'react'
import { enregistrerWhatsapp, lireSupport, publierWhatsapp, retirerWhatsapp } from '../../api/admin.js'
import { ErreurApi } from '../../api/client.js'
import { Alerte } from '../../components/Alerte.jsx'
import { Bouton, Indicateur } from '../../components/Bouton.jsx'
import { Champ } from '../../components/Champ.jsx'
import { PageAdmin } from '../../components/MiseEnPage.jsx'
import { dateHeure, telephone } from '../../lib/format.js'
import { messageErreurGlobale } from '../../lib/messages.js'
import { useFormulaire } from '../../lib/useFormulaire.js'
import { normaliserWhatsapp, validerWhatsapp } from '../../lib/validation.js'
import { AccesAdmin } from './AccesAdmin.jsx'

const TITRE = 'Contact du support'

// Numéro WhatsApp du support (§11) : enregistré ici, puis publié dans l'app et sur le site.
function FormulaireSupport({ initial }) {
  const [support, setSupport] = useState(initial)
  const formulaire = useFormulaire({ whatsapp: initial.whatsapp ?? '' }, { whatsapp: validerWhatsapp })
  const [action, setAction] = useState(null)
  const [annonce, setAnnonce] = useState(null)
  const [erreur, setErreur] = useState(null)

  async function executer(nom, appel, message) {
    setAction(nom)
    setErreur(null)
    setAnnonce(null)
    try {
      const reponse = await appel()
      setSupport(reponse.support)
      setAnnonce(message)
    } catch (err) {
      if (err instanceof ErreurApi && err.champs) formulaire.appliquerErreursServeur(err.champs)
      else if (err instanceof ErreurApi && err.code === 'rien_a_publier') setErreur('Enregistrez d’abord un numéro WhatsApp.')
      else setErreur(messageErreurGlobale(err))
    } finally {
      setAction(null)
    }
  }

  function enregistrer(e) {
    e.preventDefault()
    if (!formulaire.validerTout()) return
    const numero = normaliserWhatsapp(formulaire.valeurs.whatsapp)
    executer('enregistrer', () => enregistrerWhatsapp(numero), 'Numéro enregistré. Il n’est visible qu’après publication.')
  }

  const enAttente = support.whatsapp && support.whatsapp !== support.whatsappPublie
  const occupe = action !== null

  return (
    <div className="grid max-w-2xl gap-6">
      <div aria-live="polite">
        {annonce && (
          <Alerte ton="succes" className="mb-0">
            {annonce}
          </Alerte>
        )}
      </div>
      {erreur && <Alerte ton="erreur">{erreur}</Alerte>}

      <section aria-labelledby="titre-publie" className="rounded-carte border border-trait bg-white p-5">
        <h2 id="titre-publie" className="text-lg text-encre">
          Numéro publié
        </h2>
        {support.whatsappPublie ? (
          <>
            <p className="mt-2 text-[22px] font-semibold tabular-nums text-encre">{telephone(support.whatsappPublie)}</p>
            <p className="mt-1 text-sm text-texte">
              Visible dans l’app des testeurs depuis le {dateHeure(support.publieLe)}.
            </p>
            <Bouton
              type="button"
              variante="secondaire"
              className="mt-4"
              chargement={action === 'retirer'}
              libelleChargement="Retrait…"
              disabled={occupe}
              onClick={() => executer('retirer', retirerWhatsapp, 'Le numéro n’est plus affiché. Il reste enregistré.')}
            >
              Retirer la publication
            </Bouton>
          </>
        ) : (
          <p className="mt-2 text-texte">Aucun numéro publié : l’app n’affiche pas de contact WhatsApp.</p>
        )}
      </section>

      <section aria-labelledby="titre-numero" className="rounded-carte border border-trait bg-white p-5">
        <h2 id="titre-numero" className="text-lg text-encre">
          Numéro WhatsApp
        </h2>
        <form onSubmit={enregistrer} noValidate className="mt-4 space-y-4">
          <Champ
            {...formulaire.lier('whatsapp')}
            libelle="Numéro WhatsApp du support"
            aide="Format international avec l’indicatif. Exemple : +229 01 97 00 00 00"
            type="tel"
            inputMode="tel"
            autoComplete="off"
          />
          <Bouton chargement={action === 'enregistrer'} libelleChargement="Enregistrement…" disabled={occupe}>
            Enregistrer
          </Bouton>
        </form>

        {enAttente && (
          <div className="mt-5 border-t border-trait pt-5">
            <p className="text-texte">
              Numéro enregistré, pas encore publié :{' '}
              <strong className="font-semibold tabular-nums text-encre">{telephone(support.whatsapp)}</strong>
            </p>
            <Bouton
              type="button"
              className="mt-3"
              chargement={action === 'publier'}
              libelleChargement="Publication…"
              disabled={occupe}
              onClick={() => executer('publier', publierWhatsapp, 'Numéro publié : les testeurs peuvent vous écrire sur WhatsApp.')}
            >
              Publier ce numéro
            </Bouton>
          </div>
        )}
      </section>
    </div>
  )
}

function Chargement() {
  const [etat, setEtat] = useState({ support: null, erreur: null })
  const [essai, setEssai] = useState(0)

  useEffect(() => {
    const controleur = new AbortController()
    lireSupport({ signal: controleur.signal })
      .then((r) => setEtat({ support: r.support, erreur: null }))
      .catch((err) => {
        if (!controleur.signal.aborted) setEtat({ support: null, erreur: err })
      })
    return () => controleur.abort()
  }, [essai])

  if (etat.erreur) {
    return (
      <div>
        <Alerte ton="erreur">{messageErreurGlobale(etat.erreur)}</Alerte>
        <Bouton
          type="button"
          variante="secondaire"
          className="mt-3"
          onClick={() => {
            setEtat({ support: null, erreur: null })
            setEssai((n) => n + 1)
          }}
        >
          Réessayer
        </Bouton>
      </div>
    )
  }
  if (!etat.support) {
    return (
      <p role="status" className="flex items-center gap-3 text-texte">
        <Indicateur className="size-5 text-accent" />
        Chargement…
      </p>
    )
  }
  return <FormulaireSupport initial={etat.support} />
}

export default function ContactSupport() {
  return (
    <AccesAdmin titre={TITRE}>
      {(utilisateur) => (
        <PageAdmin
          titre={TITRE}
          utilisateur={utilisateur}
          intro={<p>Le numéro WhatsApp que les testeurs voient dans l’app. Enregistrez-le, puis publiez-le quand il est prêt.</p>}
        >
          <Chargement />
        </PageAdmin>
      )}
    </AccesAdmin>
  )
}
