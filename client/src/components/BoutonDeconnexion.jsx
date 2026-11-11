import { useState } from 'react'
import { useNavigate } from 'react-router'
import { deconnecter } from '../api/auth.js'
import { messageErreurGlobale } from '../lib/messages.js'
import { Indicateur } from './Bouton.jsx'

// `sombre` : sur la barre latérale noire de l'administration.
export function BoutonDeconnexion({ sombre = false }) {
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
        className={`inline-flex h-9 items-center gap-2 rounded-champ border px-3 text-sm font-semibold disabled:opacity-60 ${
          sombre ? 'border-[#3A372F] text-white hover:bg-[#2C2A25]' : 'border-trait bg-white text-encre hover:bg-fond-doux'
        }`}
      >
        {envoi && <Indicateur className="size-3.5" />}
        Se déconnecter
      </button>
      {erreur && (
        <p role="alert" className="absolute top-11 right-0 z-10 w-64 rounded-xl bg-erreur-clair px-3 py-2 text-sm text-[#7A1A12] shadow-sm">
          Déconnexion impossible. {erreur}
        </p>
      )}
    </div>
  )
}
