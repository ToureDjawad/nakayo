import { expect, test } from '@playwright/test'
import { connecterAdmin, verifierAccessibilite, verifierSansDefilementHorizontal } from './outils.js'

test.describe('Back-office : tableau de bord (US-24)', () => {
  test('/admin ouvre le tableau de bord, accessible et sans défilement horizontal', async ({ page }) => {
    await connecterAdmin(page)
    await page.goto('/admin')
    await expect(page).toHaveURL('/admin/tableau-de-bord')
    await expect(page.getByRole('heading', { name: 'Tableau de bord', level: 1 })).toBeVisible()
    for (const titre of ['Campagnes', 'Testeurs', 'Finances', 'Versements MoMo échoués']) {
      await expect(page.getByRole('heading', { name: titre, level: 2 })).toBeVisible()
    }
    await expect(page.getByText('Aucun versement en échec.')).toBeVisible()
    await verifierAccessibilite(page)
    await verifierSansDefilementHorizontal(page)
  })
})
