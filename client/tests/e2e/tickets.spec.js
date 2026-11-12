import { expect, test } from '@playwright/test'
import { connecterAdmin, seConnecter, verifierAccessibilite, verifierSansDefilementHorizontal } from './outils.js'

test.describe('Messages au support (US-40)', () => {
  test('le développeur écrit, l’admin traite, le développeur voit le statut', async ({ page }) => {
    await seConnecter(page, 'valide@exemple.com')
    await page.waitForURL('/mon-compte')
    await page.getByRole('link', { name: 'Écrire à l’équipe' }).click()
    await expect(page).toHaveURL('/mon-compte/support')
    await verifierAccessibilite(page)
    await verifierSansDefilementHorizontal(page)

    await page.getByLabel('Sujet').fill('Lancement de campagne')
    await page.getByLabel('Votre message').fill('Bonjour,\nquand puis-je lancer ma campagne ?')
    await page.getByRole('button', { name: 'Envoyer le message' }).click()
    await expect(page.getByText('Message envoyé')).toBeVisible()
    await expect(page.getByText('Envoyé', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Se déconnecter' }).click()
    await page.waitForURL(/\/connexion/)

    await connecterAdmin(page)
    await page.getByRole('link', { name: 'Messages reçus' }).click()
    await expect(page.getByRole('heading', { name: '1 message à traiter' })).toBeVisible()
    const carte = page.getByRole('article', { name: 'Lancement de campagne' })
    await expect(carte).toContainText('Studio Exemple · Développeur · valide@exemple.com')
    await verifierAccessibilite(page)
    await verifierSansDefilementHorizontal(page)
    await carte.getByRole('button', { name: 'Marquer comme traité' }).click()
    await expect(page.getByText('Message marqué comme traité.')).toBeVisible()
    await page.getByRole('button', { name: 'Traités' }).click()
    await expect(page.getByRole('heading', { name: '1 message traité' })).toBeVisible()
    await page.getByRole('button', { name: 'Se déconnecter' }).click()
    await page.waitForURL(/\/connexion/)

    await seConnecter(page, 'valide@exemple.com')
    await page.waitForURL('/mon-compte')
    await page.goto('/mon-compte/support')
    await expect(page.getByText('Traité', { exact: true })).toBeVisible()
  })
})
