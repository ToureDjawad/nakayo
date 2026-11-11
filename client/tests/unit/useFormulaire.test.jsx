import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useFormulaire } from '../../src/lib/useFormulaire.js'
import { validerEmail, validerNom } from '../../src/lib/validation.js'

function monter() {
  return renderHook(() => useFormulaire({ nom: '', email: '' }, { nom: validerNom, email: validerEmail }))
}

describe('useFormulaire()', () => {
  it('n’affiche pas « requis » quand on quitte un champ vide avant l’envoi', () => {
    const { result } = monter()
    act(() => result.current.lier('nom').onBlur())
    expect(result.current.erreurs.nom).toBeUndefined()
  })

  it('affiche une erreur de format en quittant le champ, puis la retire à la frappe', () => {
    const { result } = monter()
    act(() => result.current.lier('email').onChange('awa@'))
    act(() => result.current.lier('email').onBlur())
    expect(result.current.erreurs.email).toBe('format_invalide')

    act(() => result.current.lier('email').onChange('awa@studio.bj'))
    expect(result.current.erreurs.email).toBeNull()
  })

  it('validerTout() signale tous les champs et renvoie false', () => {
    const { result } = monter()
    let valide
    act(() => {
      valide = result.current.validerTout()
    })
    expect(valide).toBe(false)
    expect(result.current.erreurs).toEqual({ nom: 'requis', email: 'requis' })
  })

  it('après un envoi, « requis » s’affiche aussi en quittant un champ vidé', () => {
    const { result } = monter()
    act(() => result.current.validerTout())
    act(() => result.current.lier('nom').onChange('Awa'))
    act(() => result.current.lier('nom').onChange(''))
    act(() => result.current.lier('nom').onBlur())
    expect(result.current.erreurs.nom).toBe('requis')
  })

  it('validerTout() renvoie true quand tout est bon', () => {
    const { result } = monter()
    act(() => result.current.lier('nom').onChange('Studio Awa'))
    act(() => result.current.lier('email').onChange('awa@studio.bj'))
    let valide
    act(() => {
      valide = result.current.validerTout()
    })
    expect(valide).toBe(true)
  })

  it('applique les erreurs renvoyées par l’API', () => {
    const { result } = monter()
    act(() => result.current.appliquerErreursServeur({ email: 'deja_utilise' }))
    expect(result.current.lier('email').erreur).toBe('deja_utilise')
  })
})
