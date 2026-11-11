// Bandeaux de la maquette : fond doux, texte foncé de la même teinte, coins arrondis.
const tons = {
  erreur: 'bg-erreur-clair text-[#7A1A12]',
  alerte: 'bg-ocre-clair text-[#5C3D0C]',
  succes: 'bg-succes-clair text-[#14522F]',
  info: 'bg-indigo-clair text-[#1F3457]',
}

function IconeAlerte({ ton }) {
  const chemins = {
    erreur: ['m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z', 'M12 9v4', 'M12 17h.01'],
    alerte: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'M12 8v4', 'M12 16h.01'],
    succes: ['M20 6 9 17l-5-5'],
    info: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'M12 16v-4', 'M12 8h.01'],
  }
  return (
    <svg viewBox="0 0 24 24" className="mt-0.5 size-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {chemins[ton].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}

// Les alertes d'erreur sont annoncées par les lecteurs d'écran (role="alert").
// Avec `ref`, l'alerte peut recevoir le focus (après une erreur à l'envoi d'un formulaire).
export function Alerte({ ton = 'info', titre, children, className = '', ref }) {
  return (
    <div
      ref={ref}
      tabIndex={ref ? -1 : undefined}
      role={ton === 'erreur' ? 'alert' : 'status'}
      className={`flex gap-3 rounded-xl px-4 py-3 text-sm ${tons[ton]} ${className}`}
    >
      <IconeAlerte ton={ton} />
      <div>
        {titre && <p className="font-semibold">{titre}</p>}
        {children && <div className={titre ? 'mt-1' : ''}>{children}</div>}
      </div>
    </div>
  )
}
