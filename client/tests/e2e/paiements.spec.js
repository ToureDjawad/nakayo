import { expect, test } from '@playwright/test'
import { seConnecter, verifierAccessibilite, verifierSansDefilementHorizontal } from './outils.js'

async function soumettreApp(page, nom, pkg) {
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
}

test.describe('Payer l’offre et retrouver la facture (US-12, US-15)', () => {
  test('un refus puis un paiement Mobile Money réussi : l’app passe en vérification et la facture se télécharge', async ({ page }) => {
    // Parcours long (deux paiements, avec le délai de l'API simulée) : plus de temps que le défaut de 30 s.
    test.setTimeout(90_000)
    await seConnecter(page, 'valide@exemple.com')
    await page.waitForURL('/mon-compte')
    await soumettreApp(page, 'Marché Facile', 'bj.studioawa.marche')

    await page.getByRole('link', { name: 'Payer l’offre pour Marché Facile' }).click()
    await expect(page.getByRole('heading', { name: 'Offre Standard', exact: true })).toBeVisible()
    await expect(page.getByText('Notre garantie')).toBeVisible()
    await verifierAccessibilite(page)
    await verifierSansDefilementHorizontal(page)

    // Premier essai par carte, refusé.
    await page.getByRole('radio', { name: /Carte bancaire/ }).check()
    await page.getByRole('button', { name: /^Payer 29,00/ }).click()
    await page.waitForURL(/\/paiement\/simulation\/PAY-[0-9A-F]{16}$/)
    await expect(page.getByText('Environnement de test')).toBeVisible()
    await verifierAccessibilite(page)
    await page.getByRole('button', { name: 'Refuser le paiement' }).click()
    await expect(page.getByRole('heading', { name: 'Le paiement n’a pas abouti' })).toBeVisible()
    await verifierAccessibilite(page)

    // Second essai par Mobile Money, confirmé.
    await page.getByRole('link', { name: 'Réessayer le paiement' }).click()
    await page.getByRole('radio', { name: /Mobile Money/ }).check()
    await page.getByLabel('Numéro Mobile Money').fill('+229 01 97 00 00 00')
    await verifierAccessibilite(page)
    await page.getByRole('button', { name: /^Payer 17\s500/ }).click()
    await page.waitForURL(/\/paiement\/simulation\//)
    await page.getByRole('button', { name: 'Confirmer le paiement' }).click()
    await expect(page.getByRole('heading', { name: 'Paiement reçu, merci' })).toBeVisible()
    await verifierAccessibilite(page)
    await verifierSansDefilementHorizontal(page)

    const telechargement = page.waitForEvent('download')
    await page.getByRole('button', { name: /^Télécharger la facture NKY-\d{4}-00001$/ }).click()
    expect((await telechargement).suggestedFilename()).toMatch(/^facture-NKY-\d{4}-00001\.pdf$/)

    await page.getByRole('link', { name: 'Retour à mon compte' }).click()
    const carte = page.getByRole('listitem').filter({ hasText: 'bj.studioawa.marche' })
    await expect(carte.getByText('En vérification')).toBeVisible()
    await expect(carte.getByRole('link', { name: /Payer l’offre/ })).toHaveCount(0)

    await page.getByRole('link', { name: 'Vos paiements et factures' }).click()
    await expect(page.getByRole('heading', { name: 'Paiements et factures' })).toBeVisible()
    await expect(page.getByText('1 paiement réussi.')).toBeVisible()
    await expect(page.getByText('Échoué')).toBeVisible()
    await verifierAccessibilite(page)
    await verifierSansDefilementHorizontal(page)
  })
})
