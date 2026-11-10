import { useState } from 'react'
import { renvoyerEmailVerification } from '../../api/auth.js'
import { ErreurApi } from '../../api/client.js'
import { Alerte } from '../../components/Alerte.jsx'
import { Bouton } from '../../components/Bouton.jsx'
import { Champ } from '../../components/Champ.jsx'
import { messageErreurGlobale } from '../../lib/messages.js'
import { useCompteARebours } from '../../lib/useCompteARebours.js'
import { useFormulaire } from '../../lib/useFormulaire.js'
import { LIMITES, validerEmail } from '../../lib/validation.js'
import { memoriserEmailEnAttente } from './emailEnAttente.js'

const DELAI_RENVOI = 60

// Renvoi du lien de vérification. Sans adresse connue, demande l'adresse.
export function RenvoiEmail({ email }) {
  const formulaire = useFormulaire({ email: email ?? '' }, { email: validerEmail })
  const [envoi, setEnvoi] = useState(false)
  const [resultat, setResultat] = useState(null)
  const [restant, setRestant] = useCompteARebours()

  async function soumettre(e) {
    e.preventDefault()
    setResultat(null)
    if (!formulaire.validerTout()) return
    const adresse = formulaire.valeurs.email.trim().toLowerCase()
    setEnvoi(true)
    try {
      await renvoyerEmailVerification(adresse)
      memoriserEmailEnAttente(adresse)
      setResultat({ ton: 'succes', texte: `Si un compte en attente de vérification existe pour ${adresse}, un nouveau lien vient d’y être envoyé.` })
      setRestant(DELAI_RENVOI)
    } catch (erreur) {
      if (erreur instanceof ErreurApi && erreur.champs) {
        formulaire.appliquerErreursServeur(erreur.champs)
      } else {
        setResultat({ ton: 'erreur', texte: messageErreurGlobale(erreur) })
        if (erreur instanceof ErreurApi && erreur.statut === 429) setRestant(erreur.retryAfter ?? DELAI_RENVOI)
      }
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <form onSubmit={soumettre} noValidate className="space-y-4">
      {!email && (
        <Champ
          {...formulaire.lier('email')}
          libelle="Adresse email du compte"
          type="email"
          autoComplete="email"
          inputMode="email"
          spellCheck={false}
          max={LIMITES.email}
        />
      )}
      {resultat && <Alerte ton={resultat.ton}>{resultat.texte}</Alerte>}
      <Bouton variante="secondaire" chargement={envoi} libelleChargement="Envoi…" disabled={restant > 0} className="w-full">
        {restant > 0 ? `Renvoyer l’email (possible dans ${restant} s)` : 'Renvoyer l’email'}
      </Bouton>
    </form>
  )
}
