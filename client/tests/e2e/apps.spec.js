import { expect, test } from '@playwright/test'
import { seConnecter, verifierAccessibilite, verifierSansDefilementHorizontal } from './outils.js'

test.describe('Soumettre une app (US-11)', () => {
  test('le développeur soumet son app, la corrige puis supprime le brouillon', async ({ page }) => {
    await seConnecter(page, 'valide@exemple.com')
    await page.waitForURL('/mon-compte')
    await expect(page.getByText('Vous n’avez pas encore soumis d’app.')).toBeVisible()
    await page.getByRole('link', { name: 'Soumettre une app' }).click()
    await expect(page).toHaveURL('/mon-compte/apps/nouvelle')

    await page.getByRole('button', { name: 'Enregistrer le brouillon' }).click()
    await expect(page.getByText('Saisissez le nom de votre app.')).toBeVisible()
    await verifierAccessibilite(page)
    await verifierSansDefilementHorizontal(page)

    await page.getByLabel('Nom de l’app').fill('Marché Facile')
    await page.getByLabel('Nom du package').fill('bj.studioawa.marche')
    await page.getByLabel('Description').fill('Une app pour commander au marché de Dantokpa et se faire livrer.')
    await page.getByLabel('Lien d’inscription au test fermé').fill('play.google.com/apps/testing/bj.studioawa.marche')
    await page.getByRole('radio', { name: /Compte personnel créé après/ }).check()
    await page.getByLabel('Instructions de test').fill('Chaque jour, ouvrez l’app, cherchez un produit et ajoutez-le au panier.')
    await page.getByLabel('Fonctionnalité 1').fill('Recherche de produits')
    await page.getByLabel('Fonctionnalité 2').fill('Panier')
    await page.getByLabel('Fonctionnalité 3').fill('Suivi de livraison')
    await page.getByRole('radio', { name: /Oui, il faut un compte/ }).check()
    await page.getByLabel('Identifiants de test').fill('Compte : test@marche.bj\nMot de passe : marche2026')
    await verifierAccessibilite(page)
    await page.getByRole('button', { name: 'Enregistrer le brouillon' }).click()

    await page.waitForURL('/mon-compte')
    await expect(page.getByText('« Marché Facile » est enregistrée.', { exact: false })).toBeVisible()
    const carte = page.getByRole('listitem').filter({ hasText: 'bj.studioawa.marche' })
    await expect(carte.getByText('Brouillon')).toBeVisible()
    await verifierAccessibilite(page)

    await carte.getByRole('link', { name: 'Modifier Marché Facile' }).click()
    await expect(page.getByLabel('Nom de l’app')).toHaveValue('Marché Facile')
    await page.getByLabel('Nom de l’app').fill('Marché Facile Pro')
    await page.getByRole('button', { name: 'Enregistrer les modifications' }).click()
    await page.waitForURL('/mon-compte')
    await expect(page.getByText('Modifications enregistrées')).toBeVisible()

    await page.getByRole('link', { name: 'Modifier Marché Facile Pro' }).click()
    await page.getByRole('button', { name: 'Supprimer ce brouillon' }).click()
    await page.getByRole('button', { name: 'Supprimer définitivement' }).click()
    await page.waitForURL('/mon-compte')
    await expect(page.getByText('« Marché Facile Pro » a été supprimée.')).toBeVisible()
    await expect(page.getByText('Vous n’avez pas encore soumis d’app.')).toBeVisible()
  })
})
