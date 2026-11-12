import { expect, test } from '@playwright/test'
import { verifierAccessibilite, verifierSansDefilementHorizontal } from './outils.js'

test.describe('Accueil', () => {
  test('présente toute la page et mène à l’inscription', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: /12 testeurs pendant 14 jours/ })).toBeVisible()
    await page.getByRole('link', { name: 'Voir comment ça marche' }).click()
    await expect(page.getByRole('heading', { name: 'Quatre étapes, et vous gardez la main sur la Play Console' })).toBeInViewport()
    await expect(page.getByRole('heading', { name: 'Un prix par app, payé une fois' })).toBeVisible()
    await page.getByText('Que se passe-t-il si un testeur abandonne ?').click()
    await expect(page.getByText(/Les 3 testeurs de réserve couvrent les abandons/)).toBeVisible()
    await verifierAccessibilite(page)
    await verifierSansDefilementHorizontal(page)
    await page.getByRole('link', { name: 'Choisir Standard' }).click()
    await expect(page.getByRole('heading', { name: 'Créer votre compte développeur' })).toBeVisible()
  })
})
