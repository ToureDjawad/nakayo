import { useState } from 'react'
import { telechargerFacture } from '../../api/paiements.js'
import { Bouton } from '../../components/Bouton.jsx'
import { messageErreurGlobale } from '../../lib/messages.js'

// Télécharge la facture PDF (US-15) avec la session du site, puis la propose à l'enregistrement.
export function BoutonFacture({ numero, compact = false }) {
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState(null)

  async function telecharger() {
    setEnCours(true)
    setErreur(null)
    try {
      const fichier = await telechargerFacture(numero)
      const url = URL.createObjectURL(fichier)
      const lien = document.createElement('a')
      lien.href = url
      lien.download = `facture-${numero}.pdf`
      document.body.append(lien)
      lien.click()
      lien.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      setErreur(messageErreurGlobale(err))
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div>
      <Bouton
        type="button"
        variante="secondaire"
        chargement={enCours}
        libelleChargement="Téléchargement…"
        onClick={telecharger}
        aria-label={`Télécharger la facture ${numero}`}
      >
        {compact ? `Facture ${numero}` : 'Télécharger la facture'}
      </Bouton>
      {erreur && (
        <p role="alert" className="mt-1.5 text-sm text-erreur">
          {erreur}
        </p>
      )}
    </div>
  )
}
