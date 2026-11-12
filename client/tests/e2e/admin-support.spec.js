import { expect, test } from '@playwright/test'
import { connecterAdmin, seConnecter, verifierAccessibilite, verifierSansDefilementHorizontal } from './outils.js'

test.describe('Back-office : contact du support (US-40)', () => {
  test('l’admin enregistre, publie puis retire le numéro WhatsApp', async ({ page }) => {
    await connecterAdmin(page)
    await page.getByRole('link', { name: 'Contact du support' }).click()
    await expect(page).toHaveURL('/admin/support')
    await expect(page.getByText(/Aucun numéro publié/)).toBeVisible()
    await verifierAccessibilite(page)
    await verifierSansDefilementHorizontal(page)

    await page.getByLabel('Numéro WhatsApp du support').fill('+229 01 97 00 00 00')
    await page.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(page.getByText(/pas encore publié/)).toBeVisible()

    const publicAvant = await page.evaluate(() => fetch('/api/support').then((r) => r.json()))
    expect(publicAvant.support.whatsapp).toBeNull()

    await page.getByRole('button', { name: 'Publier ce numéro' }).click()
    await expect(page.getByText('+229 01 97 00 00 00', { exact: true })).toBeVisible()
    const publicApres = await page.evaluate(() => fetch('/api/support').then((r) => r.json()))
    expect(publicApres.support.whatsapp).toBe('+2290197000000')
    await verifierAccessibilite(page)

    await page.getByRole('button', { name: 'Retirer la publication' }).click()
    await expect(page.getByText(/Aucun numéro publié/)).toBeVisible()
  })
})

test('le numéro publié apparaît sur l’espace du développeur', async ({ page }) => {
  await connecterAdmin(page)
  await page.goto('/admin/support')
  await page.getByLabel('Numéro WhatsApp du support').fill('+229 01 97 00 00 00')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await page.getByRole('button', { name: 'Publier ce numéro' }).click()
  await expect(page.getByText(/Numéro publié : les testeurs/)).toBeVisible()
  await page.getByRole('button', { name: 'Se déconnecter' }).click()

  await seConnecter(page, 'valide@exemple.com')
  await page.waitForURL('/mon-compte')
  const lien = page.getByRole('link', { name: /Écrire au support sur WhatsApp/ })
  await expect(lien).toHaveAttribute('href', /^https:\/\/wa\.me\/2290197000000\?text=/)
  const message = new URL(await lien.getAttribute('href')).searchParams.get('text')
  expect(message).toBe('Bonjour, je suis Studio Exemple, développeur sur Nakayo (valide@exemple.com). J’ai une question :')
  await verifierAccessibilite(page)
  await verifierSansDefilementHorizontal(page)
})
