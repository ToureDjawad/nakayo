import { expect, test } from '@playwright/test'
import { seConnecter, verifierAccessibilite, verifierSansDefilementHorizontal } from './outils.js'

async function soumettreEtPayer(page, nom, pkg) {
  await page.getByRole('link', { name: 'Soumettre une app' }).click()
  await page.getByLabel('Nom de l’app').fill(nom)
  await page.getByLabel('Nom du package').fill(pkg)
  await page.getByLabel('Description').fill('Une app pour commander au marché de Dantokpa et se faire livrer.')
  await page.getByLabel('Lien d’inscription au test fermé').fill(`https://play.google.com/apps/testing/${pkg}`)
  await page.getByRole('radio', { name: /Compte personnel créé après/ }).check()
  await page.getByLabel('Instructions de test').fill('Chaque jour, ouvrez l’app, cherchez un produit et ajoutez-le au panier.')
  await page.getByLabel('Fonctionnalité 1').fill('Recherche de produits')
  await page.getByLabel('Fonctionnalité 2').fill('Panier')
  await page.getByLabel('Fonctionnalité 3').fill('Suivi de livraison')
  await page.getByRole('radio', { name: 'Non' }).check()
  await page.getByRole('button', { name: 'Enregistrer le brouillon' }).click()
  await page.waitForURL('/mon-compte')
  await page.getByRole('link', { name: `Payer l’offre pour ${nom}` }).click()
  await page.getByRole('radio', { name: /Carte bancaire/ }).check()
  await page.getByRole('button', { name: /^Payer 29,00/ }).click()
  await page.getByRole('button', { name: 'Confirmer le paiement' }).click()
  await expect(page.getByRole('heading', { name: 'Paiement reçu, merci' })).toBeVisible()
}

async function deconnecter(page) {
  await page.getByRole('button', { name: 'Se déconnecter' }).click()
  await page.waitForURL(/\/connexion|\/$/)
}

test.describe('Vérification des apps payées (US-14)', () => {
  test('l’admin valide une app, refuse l’autre ; le développeur voit le motif', async ({ page }) => {
    test.setTimeout(120_000)
    await seConnecter(page, 'valide@exemple.com')
    await page.waitForURL('/mon-compte')
    await soumettreEtPayer(page, 'Marché Facile', 'bj.studioawa.marche')
    await page.goto('/mon-compte')
    await soumettreEtPayer(page, 'Taxi Moto', 'bj.studioawa.taxi')
    await page.goto('/mon-compte')
    await deconnecter(page)

    await seConnecter(page, 'admin@nakayo.test')
    await page.waitForURL('/admin/tableau-de-bord')
    await page.getByRole('link', { name: 'Apps à vérifier' }).click()
    await expect(page.getByRole('heading', { name: '2 apps à vérifier' })).toBeVisible()
    await verifierAccessibilite(page)
    await verifierSansDefilementHorizontal(page)

    await page.getByRole('button', { name: 'Valider Marché Facile' }).click()
    await expect(page.getByText('« Marché Facile » est validée.', { exact: false })).toBeVisible()

    await page.getByRole('button', { name: 'Refuser Taxi Moto' }).click()
    await page.getByRole('button', { name: 'Refuser et rembourser' }).click()
    await expect(page.getByText('Indiquez le motif du refus.', { exact: false })).toBeVisible()
    await page.getByLabel('Motif du refus').fill('Le lien du test fermé ne s’ouvre pas : publiez la version.')
    await verifierAccessibilite(page)
    await page.getByRole('button', { name: 'Refuser et rembourser' }).click()
    await expect(page.getByText('« Taxi Moto » est refusée.', { exact: false })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Aucune app à vérifier' })).toBeVisible()

    await page.getByRole('button', { name: 'Refusées' }).click()
    await expect(page.getByText('Le lien du test fermé ne s’ouvre pas : publiez la version.')).toBeVisible()
    await expect(page.getByText(/remboursé le/)).toBeVisible()
    await verifierAccessibilite(page)
    await deconnecter(page)

    await seConnecter(page, 'valide@exemple.com')
    await page.waitForURL('/mon-compte')
    const taxi = page.getByRole('listitem').filter({ hasText: 'bj.studioawa.taxi' })
    await expect(taxi.getByText('Refusée', { exact: true })).toBeVisible()
    await expect(taxi.getByText('Le lien du test fermé ne s’ouvre pas : publiez la version.')).toBeVisible()
    const marche = page.getByRole('listitem').filter({ hasText: 'bj.studioawa.marche' })
    await expect(marche.getByText('Validée', { exact: true })).toBeVisible()
    await verifierAccessibilite(page)
  })
})
