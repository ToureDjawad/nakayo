import { expect, test } from '@playwright/test'
import {
  capturerLienReinitialisation,
  seConnecter,
  verifierAccessibilite,
  verifierSansDefilementHorizontal,
} from './outils.js'

test.describe('Connexion, déconnexion, mot de passe (US-09 web)', () => {
  test('admin : accès protégé, connexion, retour à la page demandée, déconnexion', async ({ page }) => {
    await page.goto('/admin/comptes?role=testeur')
    await expect(page.getByText('Cette page est réservée à l’équipe Nakayo.')).toBeVisible()
    await page.getByRole('link', { name: 'Connectez-vous' }).click()

    await page.getByLabel('Adresse email').fill('admin@nakayo.test')
    await page.getByLabel('Mot de passe', { exact: true }).fill('admin-nakayo-2026')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL('/admin/comptes?role=testeur')
    await expect(page.getByRole('heading', { name: '13 comptes en attente pour ces filtres' })).toBeVisible()

    await page.getByRole('button', { name: 'Se déconnecter' }).click()
    await expect(page).toHaveURL('/connexion')
    await expect(page.getByText('Vous êtes déconnecté.')).toBeVisible()

    await page.goto('/admin/comptes')
    await expect(page.getByText('Cette page est réservée à l’équipe Nakayo.')).toBeVisible()
  })

  test('développeur : arrive sur l’état de son compte, pas sur le back-office', async ({ page }) => {
    await page.goto('/connexion?suite=%2Fadmin%2Fcomptes')
    await page.getByLabel('Adresse email').fill('refuse@exemple.com')
    await page.getByLabel('Mot de passe', { exact: true }).fill('motdepasse-refuse')
    await page.getByRole('button', { name: 'Se connecter' }).click()
    await expect(page).toHaveURL('/mon-compte')
    await expect(page.getByRole('heading', { name: 'Votre compte n’a pas été validé' })).toBeVisible()
    await expect(page.getByText('La fiche Google Play indiquée ne correspond pas')).toBeVisible()
  })

  test('mauvais mot de passe puis bon mot de passe', async ({ page }) => {
    await seConnecter(page, 'valide@exemple.com', 'pas le bon')
    await expect(page.getByRole('alert')).toHaveText('Adresse email ou mot de passe incorrect.')
    await expect(page.getByLabel('Mot de passe', { exact: true })).toHaveValue('')

    await page.getByLabel('Mot de passe', { exact: true }).fill('motdepasse-valide')
    await page.getByRole('button', { name: 'Se connecter' }).click()
    await expect(page.getByRole('heading', { name: 'Votre compte est validé' })).toBeVisible()
  })

  test('5 échecs bloquent la connexion pendant 15 minutes', async ({ page }) => {
    await page.goto('/connexion')
    await page.getByLabel('Adresse email').fill('valide@exemple.com')
    for (let i = 0; i < 6; i++) {
      await page.getByLabel('Mot de passe', { exact: true }).fill(`faux-${i}`)
      await page.getByRole('button', { name: 'Se connecter' }).click()
      await expect(page.getByRole('button', { name: 'Se connecter' })).toBeEnabled()
    }
    await expect(page.getByRole('alert')).toContainText(/Trop de tentatives\. Réessayez dans 1[45] minutes\./)
  })

  test('email non confirmé et compte suspendu', async ({ page }) => {
    await seConnecter(page, 'nonverifie@exemple.com')
    await expect(page.getByText('Adresse email non confirmée')).toBeVisible()
    await page.getByRole('button', { name: 'Renvoyer l’email' }).click()
    await expect(page.getByText(/un nouveau lien vient d’y être envoyé/)).toBeVisible()

    await seConnecter(page, 'suspendu@exemple.com')
    await expect(page.getByText('Compte suspendu')).toBeVisible()
  })

  test('mot de passe oublié : lien, nouveau mot de passe, l’ancien ne marche plus', async ({ page }) => {
    const lien = capturerLienReinitialisation(page)
    await page.goto('/connexion')
    await page.getByRole('link', { name: 'Mot de passe oublié ?' }).click()
    await page.getByLabel('Adresse email').fill('valide@exemple.com')
    await page.getByRole('button', { name: 'Envoyer le lien' }).click()
    await expect(page.getByText(/Si un compte existe pour/)).toBeVisible()

    await page.goto(await lien)
    await page.getByLabel('Nouveau mot de passe').fill('ma nouvelle phrase secrète')
    await page.getByLabel('Confirmer le mot de passe').fill('ma nouvelle phrase secrète')
    await page.getByRole('button', { name: 'Enregistrer le mot de passe' }).click()
    await expect(page).toHaveURL('/connexion')
    await expect(page.getByText(/Votre mot de passe a été modifié/)).toBeVisible()

    await seConnecter(page, 'valide@exemple.com', 'motdepasse-valide')
    await expect(page.getByRole('alert')).toHaveText('Adresse email ou mot de passe incorrect.')
    await seConnecter(page, 'valide@exemple.com', 'ma nouvelle phrase secrète')
    await expect(page.getByRole('heading', { name: 'Votre compte est validé' })).toBeVisible()

    // Le lien ne sert qu'une fois.
    await page.goto(await lien)
    await page.getByLabel('Nouveau mot de passe').fill('encore une autre phrase')
    await page.getByLabel('Confirmer le mot de passe').fill('encore une autre phrase')
    await page.getByRole('button', { name: 'Enregistrer le mot de passe' }).click()
    await expect(page.getByRole('heading', { name: 'Ce lien n’est pas valide' })).toBeVisible()
  })

  test('lien de réinitialisation expiré', async ({ page }) => {
    await page.goto('/reinitialiser-mot-de-passe?jeton=expire')
    await page.getByLabel('Nouveau mot de passe').fill('une nouvelle phrase')
    await page.getByLabel('Confirmer le mot de passe').fill('une nouvelle phrase')
    await page.getByRole('button', { name: 'Enregistrer le mot de passe' }).click()
    await expect(page.getByRole('heading', { name: 'Ce lien a expiré' })).toBeVisible()
    await page.getByRole('link', { name: 'Demander un nouveau lien' }).click()
    await expect(page).toHaveURL('/mot-de-passe-oublie')
  })

  test('accessibilité et affichage mobile des trois écrans', async ({ page }) => {
    await page.goto('/connexion')
    await page.getByRole('button', { name: 'Se connecter' }).click()
    await expect(page.getByText('Saisissez votre mot de passe.')).toBeVisible()
    await verifierAccessibilite(page)
    await verifierSansDefilementHorizontal(page)

    await page.goto('/mot-de-passe-oublie')
    await verifierAccessibilite(page)
    await verifierSansDefilementHorizontal(page)

    await page.goto('/reinitialiser-mot-de-passe?jeton=abc')
    await page.getByRole('button', { name: 'Enregistrer le mot de passe' }).click()
    await expect(page.getByText('Les deux mots de passe ne correspondent pas.')).toBeHidden()
    await expect(page.getByText('Saisissez à nouveau le mot de passe.')).toBeVisible()
    await verifierAccessibilite(page)
    await verifierSansDefilementHorizontal(page)
  })
})
