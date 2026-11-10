import { useCallback, useEffect, useState } from 'react'
import { lireSession } from '../api/auth.js'
import { ErreurApi } from '../api/client.js'

// Charge l'utilisateur connecté. etat : chargement | connecte | deconnecte | erreur
export function useSession() {
  const [etat, setEtat] = useState({ etat: 'chargement' })
  const [essai, setEssai] = useState(0)

  useEffect(() => {
    const controleur = new AbortController()
    lireSession({ signal: controleur.signal })
      .then(({ utilisateur }) => setEtat({ etat: 'connecte', utilisateur }))
      .catch((erreur) => {
        if (erreur?.name === 'AbortError') return
        if (erreur instanceof ErreurApi && erreur.statut === 401) setEtat({ etat: 'deconnecte' })
        else setEtat({ etat: 'erreur', erreur })
      })
    return () => controleur.abort()
  }, [essai])

  const recharger = useCallback(() => {
    setEtat({ etat: 'chargement' })
    setEssai((n) => n + 1)
  }, [])

  return { ...etat, recharger }
}
