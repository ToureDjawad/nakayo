import { useEffect, useState } from 'react'

// Secondes restantes avant de pouvoir refaire une action (renvoi d'email, de code SMS).
export function useCompteARebours() {
  const [restant, setRestant] = useState(0)

  useEffect(() => {
    if (restant <= 0) return undefined
    const minuteur = setTimeout(() => setRestant((r) => r - 1), 1000)
    return () => clearTimeout(minuteur)
  }, [restant])

  return [restant, setRestant]
}
