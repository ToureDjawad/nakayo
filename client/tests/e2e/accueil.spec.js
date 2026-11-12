import { expect, test } from '@playwright/test'
import { verifierAccessibilite, verifierSansDefilementHorizontal } from './outils.js'

test.describe('Accueil', () => {
  test('présente toute la page et mène à l’inscription', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Comment ça marche' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Une seule offre, tout compris' })).toBeVisible()
    await expect(page.getByText('Environnement de développement')).toHaveCount(0)
    await page.getByText('Comment payer ?').click()
    await expect(page.getByText(/Par carte bancaire \(29 \$\)/)).toBeVisible()
    await verifierAccessibilite(page)
    await verifierSansDefilementHorizontal(page)
    await page.getByRole('link', { name: 'Commencer' }).click()
    await expect(page.getByRole('heading', { name: 'Créer votre compte développeur' })).toBeVisible()
  })
})
