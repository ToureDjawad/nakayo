import { Link } from 'react-router'
import { BoutonDeconnexion } from './BoutonDeconnexion.jsx'

// Avec `utilisateur`, l'en-tête affiche le nom et le bouton de déconnexion.
export function EnTete({ utilisateur, sousTitre }) {
  return (
    <header className="border-b border-trait">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
        <Link to="/" className="font-titre text-lg font-bold text-encre">
          Nakayo
        </Link>
        {sousTitre && <span className="text-sm text-discret">{sousTitre}</span>}
        {utilisateur && (
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden max-w-48 truncate text-sm text-texte sm:inline">{utilisateur.nom}</span>
            <BoutonDeconnexion />
          </div>
        )}
      </div>
    </header>
  )
}

// Colonne étroite centrée pour les écrans de compte (inscription, connexion, statuts).
export function PageCompte({ titre, intro, utilisateur, children }) {
  return (
    <div className="min-h-screen bg-white">
      <EnTete utilisateur={utilisateur} />
      <main className="mx-auto max-w-md px-4 pt-8 pb-16 sm:pt-12">
        <h1 className="text-2xl font-bold text-encre sm:text-3xl">{titre}</h1>
        {intro && <div className="mt-2 text-texte">{intro}</div>}
        <div className="mt-8">{children}</div>
      </main>
    </div>
  )
}

export function PageAdmin({ titre, intro, utilisateur, children }) {
  return (
    <div className="min-h-screen bg-white">
      <EnTete utilisateur={utilisateur} sousTitre="Administration" />
      <main className="mx-auto max-w-5xl px-4 pt-6 pb-16 sm:pt-10">
        <h1 className="text-2xl font-bold text-encre sm:text-3xl">{titre}</h1>
        {intro && <div className="mt-2 text-texte">{intro}</div>}
        <div className="mt-6">{children}</div>
      </main>
    </div>
  )
}
