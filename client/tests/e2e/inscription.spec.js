import { expect, test } from '@playwright/test'
import {
  capturerLienVerification,
  remplirInscription,
  verifierAccessibilite,
  verifierSansDefilementHorizontal,
} from './outils.js'

test.describe('Inscription développeur (US-05)', () => {
  test('parcours complet : inscription, email, lien, compte en attente', async ({ page }) => {
    const lien = capturerLienVerification(page)
    await page.goto('/')
    await page.getByRole('link', { name: /Soumettre mon app · 29/ }).click()

    const saisie = await remplirInscription(page)
    await page.getByRole('button', { name: 'Créer mon compte' }).click()
    await expect(page.getByRole('button', { name: 'Création du compte…' })).toBeDisabled()

    await expect(page.getByRole('heading', { name: 'Vérifiez votre adresse email' })).toBeVisible()
    await expect(page.getByText(saisie.email)).toBeVisible()

    await page.goto(await lien)
    await expect(page.getByText('Vérification en cours…')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Votre compte est en cours de vérification' })).toBeVisible()
    await expect(page).toHaveURL('/compte-en-attente')
    await expect(page.getByText('Votre adresse email est confirmée.')).toBeVisible()
    await expect(page.getByText('Bénin')).toBeVisible()
    await expect(page.getByText('https://play.google.com/store/apps/dev?id=1234567890')).toBeVisible()

    // La session survit à un rechargement.
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Votre compte est en cours de vérification' })).toBeVisible()

    // Un lien déjà utilisé n'est plus valable.
    await page.goto(await lien)
    await expect(page.getByRole('heading', { name: 'Ce lien n’est pas valide' })).toBeVisible()
  })

  test('erreurs champ par champ et focus sur le premier champ, au clavier', async ({ page }) => {
    await page.goto('/inscription')
    await page.getByLabel('Nom de développeur Google Play').focus()
    await page.keyboard.press('Enter')

    await expect(page.getByText('Saisissez votre nom de développeur.')).toBeVisible()
    await expect(page.getByText('Saisissez votre adresse email.')).toBeVisible()
    await expect(page.getByText('Choisissez votre pays.')).toBeVisible()
    await expect(page.getByLabel('Nom de développeur Google Play')).toBeFocused()

    await page.keyboard.type('Studio Awa')
    await expect(page.getByText('Saisissez votre nom de développeur.')).toBeHidden()

    await page.getByLabel('Lien de votre fiche développeur Google Play').fill('https://play.google.com/store/apps/details?id=bj.app')
    await page.getByLabel('Lien de votre fiche développeur Google Play').blur()
    await expect(page.getByText(/Le lien doit commencer par/)).toBeVisible()
  })

  test('email déjà utilisé : erreur sous le champ email', async ({ page }) => {
    await page.goto('/inscription')
    await remplirInscription(page, { email: 'valide@exemple.com' })
    await page.getByRole('button', { name: 'Créer mon compte' }).click()

    await expect(page.getByText('Un compte existe déjà avec cette adresse email.')).toBeVisible()
    await expect(page.getByLabel('Adresse email')).toBeFocused()
  })

  test('coupure réseau : message clair et saisie conservée', async ({ page }) => {
    await page.goto('/inscription')
    await remplirInscription(page, { email: 'test+reseau@exemple.com' })
    await page.getByRole('button', { name: 'Créer mon compte' }).click()

    await expect(page.getByRole('alert')).toContainText('Impossible de joindre le serveur')
    await expect(page.getByLabel('Adresse email')).toHaveValue('test+reseau@exemple.com')
    await expect(page.getByRole('button', { name: 'Créer mon compte' })).toBeEnabled()
  })

  test('trop de tentatives : délai affiché', async ({ page }) => {
    await page.goto('/inscription')
    await remplirInscription(page, { email: 'test+limite@exemple.com' })
    await page.getByRole('button', { name: 'Créer mon compte' }).click()
    await expect(page.getByRole('alert')).toContainText('Réessayez dans 5 minutes')
  })

  test('lien expiré : renvoi d’un nouvel email puis attente', async ({ page }) => {
    await page.goto('/verification-email?jeton=expire')
    await expect(page.getByRole('heading', { name: 'Ce lien a expiré' })).toBeVisible()

    await page.getByLabel('Adresse email du compte').fill('awa@studio.bj')
    await page.getByRole('button', { name: 'Renvoyer l’email' }).click()
    await expect(page.getByText(/un nouveau lien vient d’y être envoyé/)).toBeVisible()
    await expect(page.getByRole('button', { name: /possible dans \d+ s/ })).toBeDisabled()
  })

  test('les liens juridiques s’ouvrent dans un nouvel onglet sans perdre la saisie', async ({ page, context }) => {
    await page.goto('/inscription')
    await page.getByLabel('Nom de développeur Google Play').fill('Studio Awa')

    const [onglet] = await Promise.all([
      context.waitForEvent('page'),
      page.getByRole('link', { name: /conditions d’utilisation/ }).click(),
    ])
    await expect(onglet.getByRole('heading', { name: 'Conditions d’utilisation' })).toBeVisible()
    await expect(page.getByLabel('Nom de développeur Google Play')).toHaveValue('Studio Awa')
  })
})

test.describe('Accessibilité et affichage mobile', () => {
  test('formulaire d’inscription, vide puis en erreur', async ({ page }) => {
    await page.goto('/inscription')
    await verifierAccessibilite(page)
    await verifierSansDefilementHorizontal(page)

    await page.getByRole('button', { name: 'Créer mon compte' }).click()
    await expect(page.getByText('Saisissez votre adresse email.')).toBeVisible()
    await verifierAccessibilite(page)
  })

  test('écrans « vérifiez votre email » et « compte en attente »', async ({ page }) => {
    const lien = capturerLienVerification(page)
    await page.goto('/inscription')
    await remplirInscription(page, { lien: `https://play.google.com/store/apps/developer?id=${'Studio+Awa+'.repeat(20)}` })
    await page.getByRole('button', { name: 'Créer mon compte' }).click()
    await expect(page.getByRole('heading', { name: 'Vérifiez votre adresse email' })).toBeVisible()
    await verifierAccessibilite(page)
    await verifierSansDefilementHorizontal(page)

    await page.goto(await lien)
    await expect(page.getByRole('heading', { name: 'Votre compte est en cours de vérification' })).toBeVisible()
    await verifierAccessibilite(page)
    await verifierSansDefilementHorizontal(page)
  })
})
