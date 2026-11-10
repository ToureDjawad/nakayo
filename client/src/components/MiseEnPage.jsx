import { Link } from 'react-router'

export function EnTete() {
  return (
    <header className="border-b border-trait">
      <div className="mx-auto flex h-14 max-w-5xl items-center px-4">
        <Link to="/" className="font-titre text-lg font-bold text-encre">
          Nakayo
        </Link>
      </div>
    </header>
  )
}

// Colonne étroite centrée pour les écrans de compte (inscription, connexion, statuts).
export function PageCompte({ titre, intro, children }) {
  return (
    <div className="min-h-screen bg-white">
      <EnTete />
      <main className="mx-auto max-w-md px-4 pt-8 pb-16 sm:pt-12">
        <h1 className="text-2xl font-bold text-encre sm:text-3xl">{titre}</h1>
        {intro && <div className="mt-2 text-texte">{intro}</div>}
        <div className="mt-8">{children}</div>
      </main>
    </div>
  )
}

export function PageAdmin({ titre, intro, children }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-trait">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <Link to="/" className="font-titre text-lg font-bold text-encre">
            Nakayo
          </Link>
          <span className="text-sm text-discret">Administration</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pt-6 pb-16 sm:pt-10">
        <h1 className="text-2xl font-bold text-encre sm:text-3xl">{titre}</h1>
        {intro && <div className="mt-2 text-texte">{intro}</div>}
        <div className="mt-6">{children}</div>
      </main>
    </div>
  )
}
