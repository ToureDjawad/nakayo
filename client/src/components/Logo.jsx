// Marque Nakayo : disque vert forêt, N tracé en ocre, puis le mot « nakayo ».
export function Logo({ clair = false, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 font-titre text-[22px] leading-none font-bold tracking-[-0.03em] ${clair ? 'text-white' : 'text-encre'} ${className}`}>
      <svg viewBox="0 0 28 28" className="size-7 shrink-0" aria-hidden="true">
        <circle cx="14" cy="14" r="14" fill="#15543F" />
        <path d="M8 19V9.5l12 9V9" stroke="#E3A33A" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      nakayo
    </span>
  )
}

// Frise de demi-disques ocre et argile, en bas des panneaux verts de la maquette.
export function Motif({ className = '' }) {
  return (
    <svg className={className} aria-hidden="true" width="100%" height="56">
      <defs>
        <pattern id="motif-nakayo" width="56" height="56" patternUnits="userSpaceOnUse">
          <path d="M2 26a12 12 0 0 1 24 0z" fill="#E3A33A" />
          <path d="M30 2a12 12 0 0 0 24 0z" fill="#C65A3A" />
          <path d="M2 30a12 12 0 0 0 24 0z" fill="#C65A3A" />
          <path d="M30 54a12 12 0 0 1 24 0z" fill="#E3A33A" />
          <circle cx="42" cy="28" r="4" fill="#E3A33A" />
        </pattern>
      </defs>
      <rect width="100%" height="56" fill="url(#motif-nakayo)" />
    </svg>
  )
}
