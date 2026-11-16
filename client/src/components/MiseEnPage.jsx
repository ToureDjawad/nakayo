import { Link, NavLink } from 'react-router'
import { BoutonDeconnexion } from './BoutonDeconnexion.jsx'
import { Logo, Motif } from './Logo.jsx'

// Avec `utilisateur`, l'en-tête affiche le nom et le bouton de déconnexion.
export function EnTete({ utilisateur, actions }) {
  return (
    <header className="border-b border-trait bg-papier">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link to="/" aria-label="Nakayo, accueil">
          <Logo />
        </Link>
        {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
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

// Panneau vert de droite : titre et étapes numérotées en ocre (D02 « Ce qui se passe après l'inscription »).
export function PanneauEtapes({ titre, etapes }) {
  return (
    <div className="flex h-full flex-col bg-accent-fonce px-12 pt-14 text-white">
      <Logo clair />
      <h2 className="mt-12 max-w-md text-4xl text-white">{titre}</h2>
      <ol className="mt-8 max-w-md space-y-5">
        {etapes.map((etape, i) => (
          <li key={etape.titre} className="flex gap-3">
            <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-ocre text-sm font-bold text-accent-fonce" aria-hidden="true">
              {i + 1}
            </span>
            <div>
              <p className="font-semibold">{etape.titre}</p>
              {etape.detail && <p className="text-sm text-sur-fonce">{etape.detail}</p>}
            </div>
          </li>
        ))}
      </ol>
      <Motif className="mt-auto mb-14" />
    </div>
  )
}

// Panneau sable avec une phrase en italique (D03 « Vos campagnes vous attendent. »).
export function PanneauCitation({ texte }) {
  return (
    <div className="flex h-full items-center bg-sable px-12">
      <p className="font-accent text-5xl text-accent italic">{texte}</p>
    </div>
  )
}

const PANNEAU_PAR_DEFAUT = (
  <PanneauEtapes
    titre="12 testeurs pendant 14 jours : on s’en occupe."
    etapes={[
      { titre: 'Des testeurs vérifiés au Bénin', detail: 'Une personne, un compte, un vrai téléphone Android.' },
      { titre: 'Un suivi chaque jour', detail: 'Vous voyez qui a testé, et quand.' },
      { titre: 'Un brouillon pour Google', detail: 'Pour remplir le formulaire d’accès à la production.' },
    ]}
  />
)

// Écrans de compte (D02 à D04) : formulaire à gauche sur fond papier, panneau illustratif à droite
// sur les grands écrans. `panneau={null}` affiche la colonne seule.
export function PageCompte({ titre, intro, utilisateur, icone, panneau = PANNEAU_PAR_DEFAUT, children }) {
  return (
    <div className="min-h-screen bg-papier lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.64fr)]">
      <div className="flex min-h-screen flex-col">
        <div className="flex h-20 items-center gap-3 px-4 sm:px-10 lg:px-24">
          <Link to="/" aria-label="Nakayo, accueil">
            <Logo />
          </Link>
          {utilisateur && (
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden max-w-48 truncate text-sm text-texte sm:inline">{utilisateur.nom}</span>
              <BoutonDeconnexion />
            </div>
          )}
        </div>
        <main className="w-full max-w-[560px] px-4 pt-6 pb-16 sm:px-10 lg:px-24">
          {icone && <div className="mb-6">{icone}</div>}
          <h1 className="text-[32px] text-encre sm:text-4xl">{titre}</h1>
          {intro && <div className="mt-3 text-texte">{intro}</div>}
          <div className="mt-8">{children}</div>
        </main>
      </div>
      {panneau && <aside className="hidden lg:block">{panneau}</aside>}
    </div>
  )
}

// Icône carrée de la maquette (horloge ocre de D04, etc.).
export function BoiteIcone({ ton = 'ocre', children }) {
  const tons = {
    ocre: 'bg-ocre-clair text-alerte',
    vert: 'bg-succes-clair text-succes',
    rouge: 'bg-erreur-clair text-erreur',
  }
  return <span className={`grid size-14 place-items-center rounded-2xl ${tons[ton]}`}>{children}</span>
}

const LIENS_ADMIN = [
  { to: '/admin/tableau-de-bord', libelle: 'Tableau de bord', icone: 'tableau' },
  { to: '/admin/comptes', libelle: 'Comptes', icone: 'utilisateurs' },
  { to: '/admin/apps', libelle: 'Apps à vérifier', icone: 'app' },
  { to: '/admin/campagnes', libelle: 'Campagnes', icone: 'campagne' },
  { to: '/admin/garanties', libelle: 'Garanties', icone: 'garantie' },
  { to: '/admin/alertes', libelle: 'Alertes de fraude', icone: 'bouclier' },
  { to: '/admin/journal', libelle: 'Journal des actions', icone: 'journal' },
  { to: '/admin/devis', libelle: 'Devis Offre Plus', icone: 'devis' },
  { to: '/admin/messages', libelle: 'Messages reçus', icone: 'boite' },
  { to: '/admin/support', libelle: 'Contact du support', icone: 'message' },
]

function IconeAdmin({ nom }) {
  if (nom === 'boite') {
    return (
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M22 12h-6l-2 3h-4l-2-3H2" />
        <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
      </svg>
    )
  }
  if (nom === 'app') {
    return (
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="6" y="2" width="12" height="20" rx="2" />
        <path d="M11 18h2" />
      </svg>
    )
  }
  if (nom === 'tableau') {
    return (
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 3v16a2 2 0 0 0 2 2h16" />
        <path d="M7 16V11M12 16V7M17 16v-3" />
      </svg>
    )
  }
  if (nom === 'campagne') {
    return (
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18M8 15l2 2 4-4" />
      </svg>
    )
  }
  if (nom === 'devis') {
    return (
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v6h6M8 13h8M8 17h5" />
      </svg>
    )
  }
  if (nom === 'garantie') {
    return (
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 3v5h5M12 7v5l3 2" />
      </svg>
    )
  }
  if (nom === 'journal') {
    return (
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z" />
        <path d="M9 9h6M9 13h6" />
      </svg>
    )
  }
  if (nom === 'bouclier') {
    return (
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
    )
  }
  if (nom === 'message') {
    return (
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      </svg>
    )
  }
  if (nom !== 'utilisateurs') return null
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

// Back-office (A02) : barre latérale sombre, pour ne jamais confondre avec l'espace développeur.
export function PageAdmin({ titre, intro, utilisateur, entete, children }) {
  return (
    <div className="min-h-screen bg-papier md:grid md:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="flex flex-col gap-6 bg-encre px-3 py-5 md:min-h-screen">
        <div className="flex items-center gap-2 px-2">
          <Link to="/admin/tableau-de-bord" aria-label="Nakayo, administration">
            <Logo clair className="text-[19px]" />
          </Link>
          <span className="rounded bg-ocre px-1.5 py-0.5 text-[11px] font-semibold text-encre">admin</span>
        </div>
        <nav aria-label="Administration">
          <ul className="grid gap-0.5">
            {LIENS_ADMIN.map((lien) => (
              <li key={lien.to}>
                <NavLink
                  to={lien.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-[9px] border px-2.5 py-2 text-[13.5px] ${
                      isActive ? 'border-[#3A372F] bg-[#2C2A25] font-semibold text-white' : 'border-transparent font-medium text-[#B5AE9F] hover:text-white'
                    }`
                  }
                >
                  <IconeAdmin nom={lien.icone} />
                  {lien.libelle}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        {utilisateur && (
          <div className="mt-auto flex flex-col gap-2 px-2 text-sm text-[#B5AE9F]">
            <span className="truncate">{utilisateur.nom}</span>
            <BoutonDeconnexion sombre />
          </div>
        )}
      </aside>
      <main className="min-w-0 px-4 py-6 sm:px-8 sm:py-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-[26px] text-encre">{titre}</h1>
          {entete}
        </div>
        {intro && <div className="mt-2 text-texte">{intro}</div>}
        <div className="mt-6">{children}</div>
      </main>
    </div>
  )
}
