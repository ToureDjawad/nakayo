import { useState } from 'react'
import { sanctionnerCompte } from '../../api/admin.js'
import { ErreurApi } from '../../api/client.js'
import { Alerte } from '../../components/Alerte.jsx'
import { Bouton } from '../../components/Bouton.jsx'
import { ChampTexte } from '../../components/Champ.jsx'
import { messageErreurGlobale } from '../../lib/messages.js'
import { LIMITES, validerMotifRefus } from '../../lib/validation.js'

// US-29 : suspendre, bannir ou réactiver un compte (docs/sanctions.md).
const ACTIONS = {
  suspension: {
    bouton: 'Suspendre',
    confirmer: 'Confirmer la suspension',
    aide: 'Le compte est déconnecté et ses gains sont retenus jusqu’à la réactivation.',
    fait: (nom) => `Compte de ${nom} suspendu.`,
  },
  bannissement: {
    bouton: 'Bannir',
    confirmer: 'Confirmer le bannissement',
    aide: 'Le compte est fermé. Son numéro, son téléphone, son Mobile Money et son email ne pourront plus servir à un nouveau compte.',
    fait: (nom) => `Compte de ${nom} banni.`,
  },
  reactivation: {
    bouton: 'Réactiver',
    confirmer: 'Confirmer la réactivation',
    aide: 'Le compte redevient actif, les blocages sont levés et les gains retenus sont versés.',
    fait: (nom) => `Compte de ${nom} réactivé.`,
  },
}

const POSSIBLES = { valide: ['suspension', 'bannissement'], suspendu: ['reactivation', 'bannissement'], banni: ['reactivation'] }

export function ActionsSanction({ compte, onTraite }) {
  const [action, setAction] = useState(null)
  const [motif, setMotif] = useState('')
  const [erreurMotif, setErreurMotif] = useState(null)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)
  const possibles = POSSIBLES[compte.statut] ?? []
  if (!possibles.length) return null
  const moyen = compte.role === 'testeur' ? 'par SMS' : 'par email'

  async function confirmer(e) {
    e.preventDefault()
    const texte = motif.trim()
    const probleme = action === 'reactivation' ? (texte.length > LIMITES.motifRefusMax ? 'trop_long' : null) : validerMotifRefus(texte)
    setErreurMotif(probleme)
    if (probleme) return
    setEnvoi(true)
    setErreur(null)
    try {
      await sanctionnerCompte(compte.id, { action, motif: texte })
      onTraite(compte.id, { ton: 'succes', texte: `${ACTIONS[action].fait(compte.nom)} La personne est prévenue ${moyen}.` })
    } catch (err) {
      setEnvoi(false)
      if (err instanceof ErreurApi && err.code === 'statut_incompatible') {
        onTraite(compte.id, { ton: 'alerte', texte: `Le compte de ${compte.nom} a changé entre-temps. Il a été retiré de la liste.` })
      } else setErreur(messageErreurGlobale(err))
    }
  }

  if (!action) {
    return (
      <div className="flex flex-col gap-2 sm:flex-row">
        {possibles.map((a) => (
          <Bouton
            key={a}
            type="button"
            variante={a === 'reactivation' ? 'principal' : 'secondaire'}
            onClick={() => {
              setAction(a)
              setMotif('')
              setErreurMotif(null)
            }}
            aria-label={`${ACTIONS[a].bouton} le compte de ${compte.nom}`}
          >
            {ACTIONS[a].bouton}
          </Bouton>
        ))}
      </div>
    )
  }

  return (
    <form onSubmit={confirmer} noValidate className="space-y-4 rounded-champ border border-trait bg-papier p-4" aria-label={`${ACTIONS[action].bouton} le compte de ${compte.nom}`}>
      <p className="text-sm text-texte">{ACTIONS[action].aide}</p>
      <ChampTexte
        id={`sanction-${compte.id}-motif`}
        nom="motif"
        libelle={action === 'reactivation' ? 'Motif (facultatif)' : 'Motif'}
        aide={`Il est envoyé ${moyen}.`}
        valeur={motif}
        erreur={erreurMotif}
        onChange={setMotif}
        max={LIMITES.motifRefusMax}
        lignes={3}
      />
      {erreur && <Alerte ton="erreur">{erreur}</Alerte>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Bouton variante={action === 'reactivation' ? 'principal' : 'danger'} chargement={envoi} libelleChargement="Enregistrement…">
          {ACTIONS[action].confirmer}
        </Bouton>
        <Bouton type="button" variante="secondaire" disabled={envoi} onClick={() => setAction(null)}>
          Annuler
        </Bouton>
      </div>
    </form>
  )
}
