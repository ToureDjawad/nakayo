const variantes = {
  principal: 'bg-accent text-white hover:bg-accent-fonce disabled:bg-accent/60',
  secondaire: 'border border-trait bg-white text-encre hover:bg-fond-doux disabled:text-discret',
  danger: 'bg-erreur text-white hover:bg-[#912018] disabled:bg-erreur/60',
  discret: 'text-accent underline-offset-2 hover:underline disabled:text-discret',
}

export function Bouton({ chargement, libelleChargement, variante = 'principal', className = '', children, disabled, ...props }) {
  return (
    <button
      type="submit"
      disabled={disabled || chargement}
      aria-busy={chargement || undefined}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 font-medium disabled:cursor-not-allowed ${variantes[variante]} ${className}`}
      {...props}
    >
      {chargement && <Indicateur />}
      {chargement ? (libelleChargement ?? children) : children}
    </button>
  )
}

export function Indicateur({ className = 'size-4' }) {
  return (
    <svg className={`${className} motion-safe:animate-spin`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
