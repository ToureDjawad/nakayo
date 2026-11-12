import { useEffect, useState } from 'react'
import { lireContactSupport } from '../api/support.js'
import { telephone } from '../lib/format.js'

// Lien WhatsApp du support, affiché seulement si un admin a publié un numéro (§11).
// En cas d'erreur réseau, rien n'est affiché : le reste de la page n'en dépend pas.
export function ContactWhatsapp({ className = '' }) {
  const [numero, setNumero] = useState(null)

  useEffect(() => {
    const controleur = new AbortController()
    lireContactSupport({ signal: controleur.signal })
      .then((r) => setNumero(r?.support?.whatsapp ?? null))
      .catch(() => {})
    return () => controleur.abort()
  }, [])

  if (!numero) return null
  return (
    <section aria-labelledby="titre-support" className={`rounded-carte border border-trait bg-white p-4 ${className}`}>
      <h2 id="titre-support" className="text-base font-semibold text-encre">
        Une question ?
      </h2>
      <p className="mt-1 text-sm text-texte">Notre équipe vous répond sur WhatsApp au {telephone(numero)}.</p>
      <a
        href={`https://wa.me/${numero.replace(/\D/g, '')}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex h-11 items-center gap-2 rounded-champ border border-trait bg-white px-4 text-[15px] font-semibold text-encre hover:bg-fond-doux"
      >
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
        </svg>
        Écrire au support sur WhatsApp
        <span className="sr-only">(nouvel onglet)</span>
      </a>
    </section>
  )
}
