import { useEffect, useState } from 'react'
import { lireContactSupport } from '../api/support.js'
import { telephone } from '../lib/format.js'
import { lienWhatsapp, messageSupport } from '../lib/whatsapp.js'

// Lien WhatsApp du support, affiché seulement si un admin a publié un numéro (§11).
// En cas d'erreur réseau, rien n'est affiché : le reste de la page n'en dépend pas.
// `compact` : sans cadre ni titre, pour s'insérer dans un bloc d'aide existant.
export function ContactWhatsapp({ utilisateur, compact = false, className = '' }) {
  const [numero, setNumero] = useState(null)

  useEffect(() => {
    const controleur = new AbortController()
    lireContactSupport({ signal: controleur.signal })
      .then((r) => setNumero(r?.support?.whatsapp ?? null))
      .catch(() => {})
    return () => controleur.abort()
  }, [])

  if (!numero) return null
  const contenu = (
    <>
      <p className="mt-1 text-sm text-texte">Notre équipe vous répond aussi sur WhatsApp au {telephone(numero)}.</p>
      <a
        href={lienWhatsapp(numero, messageSupport(utilisateur))}
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
    </>
  )
  if (compact) return <div className={className}>{contenu}</div>
  return (
    <section aria-labelledby="titre-whatsapp" className={`rounded-carte border border-trait bg-white p-4 ${className}`}>
      <h2 id="titre-whatsapp" className="text-base font-semibold text-encre">
        Sur WhatsApp
      </h2>
      {contenu}
    </section>
  )
}
