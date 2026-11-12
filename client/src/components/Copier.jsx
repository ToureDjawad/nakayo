import { useState } from 'react'

// Bouton qui copie un texte dans le presse-papiers et l'annonce aux lecteurs d'écran.
export function BoutonCopier({ texte, libelle, libelleCopie, ariaLabel, className = '' }) {
  const [copie, setCopie] = useState(false)

  async function copier() {
    try {
      await navigator.clipboard.writeText(texte)
      setCopie(true)
    } catch {
      setCopie(false)
    }
  }

  return (
    <button
      type="button"
      onClick={copier}
      aria-label={copie ? undefined : ariaLabel}
      className={`text-sm font-semibold text-accent underline-offset-2 hover:underline ${className}`}
    >
      <span aria-live="polite">{copie ? libelleCopie : libelle}</span>
    </button>
  )
}

// Adresse du Groupe Google des testeurs, avec son bouton de copie (US-13).
export function AdresseGroupe({ adresse }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <code className="rounded-md bg-fond-doux px-2 py-1 text-sm [overflow-wrap:anywhere] text-encre">{adresse}</code>
      <BoutonCopier texte={adresse} libelle="Copier l’adresse" libelleCopie="Adresse copiée" />
    </div>
  )
}
