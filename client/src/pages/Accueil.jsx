import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { EnTete } from '../components/MiseEnPage.jsx'

// Bloc réservé au développement : indique si l'API et PostgreSQL répondent.
function EtatServices() {
  const [sante, setSante] = useState(null)

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then(setSante)
      .catch(() => setSante({ api: 'injoignable', base: 'inconnue' }))
  }, [])

  return (
    <section aria-labelledby="etat-services" className="mt-12 border-t border-trait pt-6">
      <h2 id="etat-services" className="text-sm font-semibold text-discret">
        Environnement de développement
      </h2>
      <dl className="mt-2 text-sm">
        {[
          ['API', sante?.api],
          ['PostgreSQL', sante?.base],
        ].map(([libelle, valeur]) => (
          <div key={libelle} className="flex justify-between border-b border-trait py-2 last:border-0">
            <dt className="text-texte">{libelle}</dt>
            <dd className={valeur === 'ok' ? 'font-medium text-succes' : 'font-medium text-erreur'}>{valeur ?? '…'}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

// Haut de la page d'accueil (D01) : la promesse et la règle de Google. Les offres et la FAQ viendront
// avec le paiement des campagnes.
export default function Accueil() {
  return (
    <div className="min-h-screen bg-papier">
      <EnTete
        actions={
          <>
            <Link to="/connexion" className="inline-flex h-10 items-center rounded-champ border border-trait bg-white px-4 text-sm font-semibold text-encre hover:bg-fond-doux">
              Se connecter
            </Link>
            <Link to="/inscription" className="inline-flex h-10 items-center rounded-champ bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-fonce">
              Soumettre mon app
            </Link>
          </>
        }
      />
      <main>
        <section className="mx-auto max-w-6xl px-4 pt-14 pb-16 sm:pt-20">
          <h1 className="max-w-4xl text-4xl text-encre sm:text-6xl">12 testeurs pendant 14 jours : on s’en occupe.</h1>
          <p className="mt-6 max-w-3xl text-lg text-texte">
            Google exige que votre app soit testée par au moins 12 personnes, sans interruption, pendant 14 jours avant d’ouvrir la
            production. Nakayo vous fournit des testeurs vérifiés au Bénin, suit leur activité chaque jour et vous rend un brouillon de
            réponses pour le formulaire de Google.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/inscription" className="inline-flex h-12 items-center justify-center gap-2 rounded-champ bg-accent px-5 font-semibold text-white hover:bg-accent-fonce">
              Créer un compte développeur <span aria-hidden="true">→</span>
            </Link>
            <Link to="/connexion" className="inline-flex h-12 items-center justify-center rounded-champ border border-trait bg-white px-5 font-semibold text-encre hover:bg-fond-doux">
              Se connecter
            </Link>
          </div>
        </section>

        <section aria-labelledby="regle-google" className="bg-accent-fonce text-white">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div>
              <p id="regle-google" className="text-xs font-semibold tracking-[0.07em] text-ocre uppercase">
                La règle, en clair
              </p>
              <p className="mt-2 text-sur-fonce">Concerne les comptes développeur personnels créés après le 13 novembre 2023.</p>
            </div>
            {[
              ['12', 'testeurs inscrits au test fermé'],
              ['14', 'jours d’affilée, sans désinscription'],
              ['3', 'parties dans le formulaire d’accès à la production'],
            ].map(([chiffre, texte]) => (
              <div key={chiffre}>
                <p className="font-titre text-5xl font-semibold text-ocre">{chiffre}</p>
                <p className="mt-2 text-sm text-sur-fonce">{texte}</p>
              </div>
            ))}
          </div>
        </section>

        {import.meta.env.DEV && (
          <div className="mx-auto max-w-md px-4 pb-16">
            <EtatServices />
          </div>
        )}
      </main>
    </div>
  )
}
