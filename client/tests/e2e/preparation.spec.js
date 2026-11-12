import { expect, test } from '@playwright/test'
import { seConnecter, verifierAccessibilite, verifierSansDefilementHorizontal } from './outils.js'

test.describe('Préparer le lancement (US-42, US-13)', () => {
  test('après le paiement, le développeur coche la liste jusqu’au bout', async ({ page }) => {
    test.setTimeout(90_000)
    await seConnecter(page, 'valide@exemple.com')
    await page.waitForURL('/mon-compte')
    await page.getByRole('link', { name: 'Soumettre une app' }).click()
    await page.getByLabel('Nom de l’app').fill('Marché Facile')
    await page.getByLabel('Nom du package').fill('bj.studioawa.marche')
    await page.getByLabel('Description').fill('Une app pour commander au marché de Dantokpa et se faire livrer.')
    await page.getByLabel('Lien d’inscription au test fermé').fill('https://play.google.com/apps/testing/bj.studioawa.marche')
    await page.getByRole('radio', { name: /Compte personnel créé après/ }).check()
    await page.getByLabel('Instructions de test').fill('Chaque jour, ouvrez l’app, cherchez un produit et ajoutez-le au panier.')
    await page.getByLabel('Fonctionnalité 1').fill('Recherche de produits')
    await page.getByLabel('Fonctionnalité 2').fill('Panier')
    await page.getByLabel('Fonctionnalité 3').fill('Suivi de livraison')
    await page.getByRole('radio', { name: 'Non' }).check()
    await page.getByRole('button', { name: 'Enregistrer le brouillon' }).click()
    await page.waitForURL('/mon-compte')
    await page.getByRole('link', { name: 'Payer l’offre pour Marché Facile' }).click()
    await page.getByRole('radio', { name: /Carte bancaire/ }).check()
    await page.getByRole('button', { name: /^Payer 29,00/ }).click()
    await page.getByRole('button', { name: 'Confirmer le paiement' }).click()
    await page.getByRole('link', { name: 'Retour à mon compte' }).click()

    await page.getByRole('link', { name: 'Préparer le lancement de Marché Facile' }).click()
    await expect(page.getByText('0 sur 6 points vérifiés')).toBeVisible()
    await expect(page.getByText('testeurs@nakayo.test')).toBeVisible()
    await verifierAccessibilite(page)
    await verifierSansDefilementHorizontal(page)

    await page.getByRole('checkbox', { name: /Le groupe des testeurs Nakayo/ }).check()
    await page.getByRole('checkbox', { name: /La fiche Play Store est complète/ }).check()
    await page.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(page.getByText(/Il reste 4 points à vérifier/)).toBeVisible()

    for (const caseACocher of await page.getByRole('checkbox').all()) await caseACocher.check()
    await page.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(page.getByText('Votre liste est complète.', { exact: false })).toBeVisible()
    await verifierAccessibilite(page)

    await page.getByRole('link', { name: 'Retour à mon compte' }).click()
    await expect(page.getByText('Liste de vérification complète.')).toBeVisible()
  })
})
