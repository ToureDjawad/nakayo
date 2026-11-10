import { useEffect, useState } from 'react'

function Statut({ libelle, valeur }) {
  const ok = valeur === 'ok'
  return (
    <div className="flex items-center justify-between border-b border-stone-200 py-3 last:border-0">
      <span className="text-stone-700">{libelle}</span>
      <span className={ok ? 'font-medium text-emerald-700' : 'font-medium text-red-700'}>
        {valeur ?? '...'}
      </span>
    </div>
  )
}

export default function App() {
  const [sante, setSante] = useState(null)

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then(setSante)
      .catch(() => setSante({ api: 'injoignable', base: 'inconnue' }))
  }, [])

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-16 text-stone-900">
      <div className="mx-auto max-w-md">
        <h1 className="text-3xl font-semibold">Nakayo</h1>
        <p className="mt-2 text-stone-600">
          Environnement de développement. Cette page vérifie que le front, l'API et la base
          de données communiquent.
        </p>
        <div className="mt-8 rounded-md border border-stone-200 bg-white px-4">
          <Statut libelle="API" valeur={sante?.api} />
          <Statut libelle="PostgreSQL" valeur={sante?.base} />
        </div>
      </div>
    </main>
  )
}
