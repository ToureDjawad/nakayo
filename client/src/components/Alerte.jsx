const tons = {
  erreur: 'border-erreur bg-erreur-clair text-erreur',
  alerte: 'border-alerte bg-alerte-clair text-alerte',
  succes: 'border-succes bg-succes-clair text-succes',
  info: 'border-accent bg-accent-clair text-accent-fonce',
}

// Les alertes d'erreur sont annoncées par les lecteurs d'écran (role="alert").
// Avec `ref`, l'alerte peut recevoir le focus (après une erreur à l'envoi d'un formulaire).
export function Alerte({ ton = 'info', titre, children, className = '', ref }) {
  return (
    <div
      ref={ref}
      tabIndex={ref ? -1 : undefined}
      role={ton === 'erreur' ? 'alert' : 'status'}
      className={`border-l-4 px-4 py-3 ${tons[ton]} ${className}`}
    >
      {titre && <p className="font-semibold">{titre}</p>}
      {children && <div className={titre ? 'mt-1 text-texte' : 'text-texte'}>{children}</div>}
    </div>
  )
}
