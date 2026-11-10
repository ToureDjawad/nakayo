import { useRef, useState } from 'react'

// État d'un formulaire : valeurs, erreurs (codes du contrat d'API) et champs déjà quittés.
// Les erreurs s'affichent quand on quitte un champ, puis se mettent à jour à la frappe.
// Un champ vide quitté sans avoir soumis n'affiche pas « requis » (navigation au clavier).
// `prefixe` évite les identifiants en double quand le même formulaire existe plusieurs fois.
export function useFormulaire(initiales, validateurs, { prefixe = '' } = {}) {
  const [valeurs, setValeurs] = useState(initiales)
  const [erreurs, setErreurs] = useState({})
  const [touches, setTouches] = useState({})
  const soumis = useRef(false)
  const ordre = Object.keys(initiales)

  const validerChamp = (nom, v) => validateurs[nom]?.(v[nom], v) ?? null

  function modifier(nom, valeur) {
    const suivantes = { ...valeurs, [nom]: valeur }
    setValeurs(suivantes)
    if (touches[nom] || erreurs[nom]) {
      setErreurs((e) => ({ ...e, [nom]: validerChamp(nom, suivantes) }))
    }
  }

  function quitter(nom) {
    const erreur = validerChamp(nom, valeurs)
    if (erreur === 'requis' && !soumis.current) return
    setTouches((t) => ({ ...t, [nom]: true }))
    setErreurs((e) => ({ ...e, [nom]: erreur }))
  }

  // Valide tout, met le focus sur le premier champ en erreur. Renvoie true si tout est valide.
  function validerTout() {
    soumis.current = true
    const suivantes = {}
    for (const nom of ordre) suivantes[nom] = validerChamp(nom, valeurs)
    setErreurs(suivantes)
    setTouches(Object.fromEntries(ordre.map((n) => [n, true])))
    return focaliserPremiereErreur(suivantes)
  }

  // Erreurs renvoyées par l'API ({ email: 'deja_utilise' }).
  function appliquerErreursServeur(champs) {
    const suivantes = { ...erreurs, ...champs }
    setErreurs(suivantes)
    setTouches((t) => ({ ...t, ...Object.fromEntries(Object.keys(champs).map((n) => [n, true])) }))
    focaliserPremiereErreur(suivantes)
  }

  function focaliserPremiereErreur(liste) {
    const premier = ordre.find((nom) => liste[nom])
    if (!premier) return true
    document.getElementById(`${prefixe}champ-${premier}`)?.focus()
    return false
  }

  function lier(nom) {
    return {
      id: `${prefixe}champ-${nom}`,
      nom,
      valeur: valeurs[nom],
      erreur: erreurs[nom] ?? null,
      onChange: (valeur) => modifier(nom, valeur),
      onBlur: () => quitter(nom),
    }
  }

  return { valeurs, erreurs, modifier, validerTout, appliquerErreursServeur, lier }
}
