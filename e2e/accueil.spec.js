import { test, expect } from '@playwright/test'

test.describe("Page d'accueil", () => {
  test('affiche le nom de la plateforme', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle('Nakayo')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nakayo')
  })

  test("confirme que le front, l'API et PostgreSQL communiquent", async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('API', { exact: true })).toBeVisible()
    await expect(page.getByText('ok', { exact: true })).toHaveCount(2)
  })
})
