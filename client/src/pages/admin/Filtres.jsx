import { useId } from 'react'
import { aujourdhuiBenin } from '../../lib/format.js'
import { messageChamp } from '../../lib/messages.js'

const classeChamp =
  'mt-1 block h-11 w-full rounded-md border bg-white px-3 text-base text-encre focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent'

function Liste({ libelle, valeur, onChange, options }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-encre">
        {libelle}
      </label>
      <select id={id} value={valeur} onChange={(e) => onChange(e.target.value)} className={`${classeChamp} border-trait`}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  )
}

function ChampDate({ libelle, nom, valeur, erreur, onChange, min }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-encre">
        {libelle}
      </label>
      <input
        id={id}
        type="date"
        value={valeur}
        min={min}
        max={aujourdhuiBenin()}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={erreur ? true : undefined}
        aria-describedby={erreur ? `${id}-erreur` : undefined}
        className={`${classeChamp} ${erreur ? 'border-erreur' : 'border-trait'}`}
      />
      {erreur && (
        <p id={`${id}-erreur`} className="mt-1 text-sm text-erreur">
          {messageChamp(nom, erreur)}
        </p>
      )}
    </div>
  )
}

export function Filtres({ filtres, erreurs, onChange, onEffacer }) {
  const actifs = filtres.role || filtres.du || filtres.au || filtres.tri !== 'ancien'
  return (
    <form role="search" aria-label="Filtrer les comptes" onSubmit={(e) => e.preventDefault()} className="border-b border-trait pb-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Liste
          libelle="Rôle"
          valeur={filtres.role}
          onChange={(v) => onChange('role', v)}
          options={[
            ['', 'Tous'],
            ['developpeur', 'Développeurs'],
            ['testeur', 'Testeurs'],
          ]}
        />
        <ChampDate libelle="Inscrit à partir du" nom="du" valeur={filtres.du} erreur={erreurs.du} onChange={(v) => onChange('du', v)} />
        <ChampDate
          libelle="Inscrit jusqu’au"
          nom="au"
          valeur={filtres.au}
          erreur={erreurs.au}
          min={filtres.du || undefined}
          onChange={(v) => onChange('au', v)}
        />
        <Liste
          libelle="Ordre"
          valeur={filtres.tri}
          onChange={(v) => onChange('tri', v)}
          options={[
            ['ancien', 'Plus anciens d’abord'],
            ['recent', 'Plus récents d’abord'],
          ]}
        />
      </div>
      {actifs && (
        <button type="button" onClick={onEffacer} className="mt-3 text-sm font-medium text-accent underline underline-offset-2">
          Effacer les filtres
        </button>
      )}
    </form>
  )
}
