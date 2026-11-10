import { useState } from 'react'
import { lireCompte } from '../../api/admin.js'
import { Alerte } from '../../components/Alerte.jsx'
import { Indicateur } from '../../components/Bouton.jsx'
import { messageErreurGlobale } from '../../lib/messages.js'

// Photos d'un testeur, chargées seulement quand l'admin les demande.
export function Documents({ compte }) {
  const [ouvert, setOuvert] = useState(false)
  const [etat, setEtat] = useState({ etat: 'inactif' })
  const idZone = `documents-${compte.id}`

  async function basculer() {
    const suivant = !ouvert
    setOuvert(suivant)
    if (!suivant || etat.etat === 'pret' || etat.etat === 'chargement') return
    setEtat({ etat: 'chargement' })
    try {
      const { compte: detail } = await lireCompte(compte.id)
      setEtat({ etat: 'pret', documents: detail.documents ?? null })
    } catch (erreur) {
      setEtat({ etat: 'erreur', erreur })
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={basculer}
        aria-expanded={ouvert}
        aria-controls={idZone}
        className="text-sm font-medium text-accent underline underline-offset-2"
      >
        {ouvert ? 'Masquer les photos' : 'Afficher la pièce d’identité et le selfie'}
      </button>
      <div id={idZone} hidden={!ouvert} className="mt-3">
        {etat.etat === 'chargement' && (
          <p role="status" className="flex items-center gap-2 text-sm text-texte">
            <Indicateur className="size-4 text-accent" />
            Chargement des photos…
          </p>
        )}
        {etat.etat === 'erreur' && <Alerte ton="erreur">{messageErreurGlobale(etat.erreur)}</Alerte>}
        {etat.etat === 'pret' && !etat.documents && <p className="text-sm text-discret">Aucune photo reçue.</p>}
        {etat.etat === 'pret' && etat.documents && (
          <div className="grid grid-cols-2 gap-3">
            {[
              ['pieceIdentite', 'Pièce d’identité'],
              ['selfie', 'Selfie'],
            ].map(([cle, libelle]) => (
              <figure key={cle}>
                <a href={etat.documents[cle]} target="_blank" rel="noopener noreferrer" className="block">
                  <img
                    src={etat.documents[cle]}
                    alt={`${libelle} de ${compte.nom}`}
                    className="h-40 w-full rounded-md border border-trait bg-fond-doux object-contain"
                  />
                  <span className="sr-only"> (ouvrir en grand dans un nouvel onglet)</span>
                </a>
                <figcaption className="mt-1 text-sm text-texte">{libelle}</figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
