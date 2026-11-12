import { useEffect, useRef, useState } from 'react'

// Charge une ressource (annulée si la page change) ; `reessayer` relance la requête.
// `cle` identifie la ressource : la requête repart quand elle change.
export function useChargement(charger, cle) {
  const chargeur = useRef(charger)
  useEffect(() => {
    chargeur.current = charger
  })
  const [etat, setEtat] = useState({ cle: null, donnees: null, erreur: null })
  const [essai, setEssai] = useState(0)
  const cleComplete = `${cle}:${essai}`

  useEffect(() => {
    const controleur = new AbortController()
    chargeur.current(controleur.signal)
      .then((donnees) => setEtat({ cle: cleComplete, donnees, erreur: null }))
      .catch((erreur) => {
        if (!controleur.signal.aborted) setEtat({ cle: cleComplete, donnees: null, erreur })
      })
    return () => controleur.abort()
  }, [cleComplete])

  return {
    chargement: etat.cle !== cleComplete,
    donnees: etat.donnees,
    erreur: etat.erreur,
    reessayer: () => setEssai((n) => n + 1),
  }
}
