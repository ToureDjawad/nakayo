import { useState } from 'react'
import { useNavigate } from 'react-router'
import { deconnecter } from '../api/auth.js'
import { messageErreurGlobale } from '../lib/messages.js'
import { Indicateur } from './Bouton.jsx'

export function BoutonDeconnexion() {
  const navigate = useNavigate()
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)

  async function deconnexion() {
    setErreur(null)
    setEnvoi(true)
    try {
      await deconnecter()
      navigate('/connexion', { replace: true, state: { message: 'Vous êtes déconnecté.' } })
    } catch (e) {
      setEnvoi(false)
      setErreur(messageErreurGlobale(e))
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={deconnexion}
        disabled={envoi}
        aria-busy={envoi || undefined}
        className="inline-flex h-9 items-center gap-2 rounded-md border border-trait px-3 text-sm font-medium text-encre hover:bg-fond-doux disabled:text-discret"
      >
        {envoi && <Indicateur className="size-3.5" />}
        Se déconnecter
      </button>
      {erreur && (
        <p role="alert" className="absolute right-0 top-11 z-10 w-64 border-l-4 border-erreur bg-erreur-clair px-3 py-2 text-sm text-erreur shadow-sm">
          Déconnexion impossible. {erreur}
        </p>
      )}
    </div>
  )
}
