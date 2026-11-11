import { useEffect, useRef, useState } from 'react'
import { refuserCompte } from '../../api/admin.js'
import { ErreurApi } from '../../api/client.js'
import { Alerte } from '../../components/Alerte.jsx'
import { Bouton } from '../../components/Bouton.jsx'
import { ChampTexte } from '../../components/Champ.jsx'
import { messageErreurGlobale } from '../../lib/messages.js'
import { useFormulaire } from '../../lib/useFormulaire.js'
import { LIMITES, validerMotifRefus } from '../../lib/validation.js'

export function FormulaireRefus({ compte, onRefuse, onDejaTraite, onAnnuler }) {
  const formulaire = useFormulaire({ motif: '' }, { motif: validerMotifRefus }, { prefixe: `refus-${compte.id}-` })
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
      await refuserCompte(compte.id, formulaire.valeurs.motif.trim())
      onRefuse()
    } catch (err) {
      setEnvoi(false)
      if (err instanceof ErreurApi && err.code === 'statut_incompatible') onDejaTraite()
      else if (err instanceof ErreurApi && err.champs) formulaire.appliquerErreursServeur(err.champs)
      else setErreur(messageErreurGlobale(err))
    }
  }

  const moyen = compte.role === 'testeur' ? 'par SMS' : 'par email'

  return (
    <form
      onSubmit={soumettre}
      noValidate
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !envoi) onAnnuler()
      }}
      className="space-y-4 rounded-champ border border-trait bg-papier p-4"
      aria-label={`Refuser le compte de ${compte.nom}`}
    >
      <ChampTexte
        {...formulaire.lier('motif')}
        ref={refMotif}
        libelle="Motif du refus"
        aide={`Obligatoire. Il est envoyé ${moyen} et affiché dans le compte de la personne.`}
        max={LIMITES.motifRefusMax}
        lignes={3}
      />
      {erreur && <Alerte ton="erreur">{erreur}</Alerte>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Bouton variante="danger" chargement={envoi} libelleChargement="Refus en cours…">
          Confirmer le refus
        </Bouton>
        <Bouton type="button" variante="secondaire" onClick={onAnnuler} disabled={envoi}>
          Annuler
        </Bouton>
      </div>
    </form>
  )
}
