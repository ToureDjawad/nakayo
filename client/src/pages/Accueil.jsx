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

export default function Accueil() {
  return (
    <div className="min-h-screen bg-white">
      <EnTete />
      <main className="mx-auto max-w-md px-4 pt-8 pb-16 sm:pt-12">
        <h1 className="text-2xl font-bold sm:text-3xl">Nakayo</h1>
        <p className="mt-2 text-texte">
          Google Play demande aux nouveaux comptes développeurs personnels de faire tester leur application par au moins
          12 testeurs pendant 14 jours consécutifs avant de la publier. Nakayo fournit ces testeurs, depuis le Bénin.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/inscription"
            className="inline-flex h-11 items-center justify-center rounded-md bg-accent px-5 font-medium text-white hover:bg-accent-fonce"
          >
            Créer un compte développeur
          </Link>
          <Link
            to="/connexion"
            className="inline-flex h-11 items-center justify-center rounded-md border border-trait px-5 font-medium text-encre hover:bg-fond-doux"
          >
            Se connecter
          </Link>
        </div>
        {import.meta.env.DEV && <EtatServices />}
      </main>
    </div>
  )
}
