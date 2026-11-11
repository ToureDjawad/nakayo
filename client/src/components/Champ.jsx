import { useId, useState } from 'react'
import { messageChamp } from '../lib/messages.js'

const classesSaisie =
  'block h-11 w-full rounded-md border bg-white px-3 text-base text-encre placeholder:text-discret ' +
  'focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent'

function bordure(erreur) {
  return erreur ? 'border-erreur' : 'border-trait hover:border-discret'
}

function Libelle({ htmlFor, children, facultatif }) {
  return (
    <label htmlFor={htmlFor} className="block font-medium text-encre">
      {children}
      {facultatif && <span className="font-normal text-discret"> (facultatif)</span>}
    </label>
  )
}

// `messages` remplace le texte par défaut d'un code dans un contexte précis.
function Message({ id, nom, erreur, messages }) {
  if (!erreur) return null
  return (
    <p id={id} className="mt-1.5 text-sm text-erreur">
      {messages?.[erreur] ?? messageChamp(nom, erreur)}
    </p>
  )
}

// Compteur affiché à partir de 80 % de la limite, pour prévenir avant l'erreur.
function Compteur({ id, longueur, max }) {
  if (!max || longueur < max * 0.8) return null
  const depasse = longueur > max
  return (
    <p id={id} className={`mt-1 text-right text-sm tabular-nums ${depasse ? 'text-erreur' : 'text-discret'}`}>
      {longueur} / {max} caractères
    </p>
  )
}

export function Champ({ id, nom, messages, libelle, aide, valeur, erreur, onChange, onBlur, max, type = 'text', facultatif, ...props }) {
  const base = useId()
  const idAide = `${base}-aide`
  const idErreur = `${base}-erreur`
  const idCompteur = `${base}-compteur`
  const decrit = [aide && idAide, erreur && idErreur, max && valeur.length >= max * 0.8 && idCompteur]
    .filter(Boolean)
    .join(' ')

  return (
    <div>
      <Libelle htmlFor={id ?? `champ-${nom}`} facultatif={facultatif}>
        {libelle}
      </Libelle>
      {aide && (
        <p id={idAide} className="mt-0.5 text-sm text-discret">
          {aide}
        </p>
      )}
      <input
        id={id ?? `champ-${nom}`}
        name={nom}
        type={type}
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-invalid={erreur ? true : undefined}
        aria-describedby={decrit || undefined}
        className={`mt-1.5 ${classesSaisie} ${bordure(erreur)}`}
        {...props}
      />
      <Compteur id={idCompteur} longueur={valeur.length} max={max} />
      <Message id={idErreur} nom={nom} erreur={erreur} messages={messages} />
    </div>
  )
}

export function ChampMotDePasse({ id, nom, messages, libelle, aide, valeur, erreur, onChange, onBlur, ...props }) {
  const [visible, setVisible] = useState(false)
  const base = useId()
  const idAide = `${base}-aide`
  const idErreur = `${base}-erreur`
  const decrit = [aide && idAide, erreur && idErreur].filter(Boolean).join(' ')

  return (
    <div>
      <Libelle htmlFor={id ?? `champ-${nom}`}>{libelle}</Libelle>
      {aide && (
        <p id={idAide} className="mt-0.5 text-sm text-discret">
          {aide}
        </p>
      )}
      <div className="relative mt-1.5">
        <input
          id={id ?? `champ-${nom}`}
          name={nom}
          type={visible ? 'text' : 'password'}
          value={valeur}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={erreur ? true : undefined}
          aria-describedby={decrit || undefined}
          className={`${classesSaisie} ${bordure(erreur)} pr-28`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-controls={id ?? `champ-${nom}`}
          className="absolute inset-y-1 right-1 rounded px-3 text-sm font-medium text-accent hover:bg-accent-clair"
        >
          {visible ? 'Masquer' : 'Afficher'}
        </button>
      </div>
      <Message id={idErreur} nom={nom} erreur={erreur} messages={messages} />
    </div>
  )
}

export function ChampSelection({ id, nom, messages, libelle, aide, valeur, erreur, onChange, onBlur, options, invite, ...props }) {
  const base = useId()
  const idAide = `${base}-aide`
  const idErreur = `${base}-erreur`
  const decrit = [aide && idAide, erreur && idErreur].filter(Boolean).join(' ')

  return (
    <div>
      <Libelle htmlFor={id ?? `champ-${nom}`}>{libelle}</Libelle>
      {aide && (
        <p id={idAide} className="mt-0.5 text-sm text-discret">
          {aide}
        </p>
      )}
      <select
        id={id ?? `champ-${nom}`}
        name={nom}
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-invalid={erreur ? true : undefined}
        aria-describedby={decrit || undefined}
        className={`mt-1.5 ${classesSaisie} ${bordure(erreur)}`}
        {...props}
      >
        <option value="">{invite}</option>
        {options.map((o) => (
          <option key={o.valeur} value={o.valeur}>
            {o.libelle}
          </option>
        ))}
      </select>
      <Message id={idErreur} nom={nom} erreur={erreur} messages={messages} />
    </div>
  )
}

export function CaseACocher({ id, nom, messages, valeur, erreur, onChange, children }) {
  const base = useId()
  const idErreur = `${base}-erreur`
  return (
    <div>
      <div className="flex items-start gap-3">
        <input
          id={id ?? `champ-${nom}`}
          name={nom}
          type="checkbox"
          checked={valeur}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={erreur ? true : undefined}
          aria-describedby={erreur ? idErreur : undefined}
          className="mt-0.5 size-5 shrink-0 accent-accent"
        />
        <label htmlFor={id ?? `champ-${nom}`} className="text-texte">
          {children}
        </label>
      </div>
      <Message id={idErreur} nom={nom} erreur={erreur} messages={messages} />
    </div>
  )
}

export function ChampTexte({ id, nom, messages, libelle, aide, valeur, erreur, onChange, onBlur, max, lignes = 4, ref, ...props }) {
  const base = useId()
  const idAide = `${base}-aide`
  const idErreur = `${base}-erreur`
  const idCompteur = `${base}-compteur`
  const decrit = [aide && idAide, erreur && idErreur, max && valeur.length >= max * 0.8 && idCompteur]
    .filter(Boolean)
    .join(' ')

  return (
    <div>
      <Libelle htmlFor={id ?? `champ-${nom}`}>{libelle}</Libelle>
      {aide && (
        <p id={idAide} className="mt-0.5 text-sm text-discret">
          {aide}
        </p>
      )}
      <textarea
        ref={ref}
        id={id ?? `champ-${nom}`}
        name={nom}
        rows={lignes}
        value={valeur}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-invalid={erreur ? true : undefined}
        aria-describedby={decrit || undefined}
        className={`mt-1.5 block w-full rounded-md border bg-white px-3 py-2 text-base text-encre focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent ${bordure(erreur)}`}
        {...props}
      />
      <Compteur id={idCompteur} longueur={valeur.length} max={max} />
      <Message id={idErreur} nom={nom} erreur={erreur} messages={messages} />
    </div>
  )
}
