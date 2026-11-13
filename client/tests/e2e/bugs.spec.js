import { expect, test } from '@playwright/test'
import { seConnecter, verifierAccessibilite, verifierSansDefilementHorizontal } from './outils.js'

async function deconnecter(page) {
  await page.getByRole('button', { name: 'Se déconnecter' }).click()
  await page.waitForURL(/\/connexion|\/$/)
}

test.describe('Bugs signalés, offre Pro (US-32, US-34)', () => {
  test('campagne Pro : le développeur accepte un bug, refuse l’autre et exporte la liste', async ({ page }) => {
    test.setTimeout(120_000)
    await seConnecter(page, 'valide@exemple.com')
    await page.waitForURL('/mon-compte')
    await page.getByRole('link', { name: 'Soumettre une app' }).click()
    await page.getByLabel('Nom de l’app').fill('Marché Pro')
    await page.getByLabel('Nom du package').fill('bj.studioawa.marchepro')
    await page.getByLabel('Description').fill('Une app pour commander au marché de Dantokpa et se faire livrer.')
    await page.getByLabel('Lien d’inscription au test fermé').fill('https://play.google.com/apps/testing/bj.studioawa.marchepro')
    await page.getByRole('radio', { name: /Compte personnel créé après/ }).check()
    await page.getByLabel('Instructions de test').fill('Chaque jour, ouvrez l’app, cherchez un produit et ajoutez-le au panier.')
    await page.getByLabel('Fonctionnalité 1').fill('Recherche de produits')
    await page.getByLabel('Fonctionnalité 2').fill('Panier')
    await page.getByLabel('Fonctionnalité 3').fill('Suivi de livraison')
    await page.getByRole('radio', { name: 'Non' }).check()
    await page.getByRole('button', { name: 'Enregistrer le brouillon' }).click()
    await page.waitForURL('/mon-compte')

    // Paiement directement en Pro.
    await page.getByRole('link', { name: 'Payer l’offre pour Marché Pro' }).click()
    await page.getByRole('radio', { name: /^Offre Pro/ }).check()
    await page.getByRole('radio', { name: /Carte bancaire/ }).check()
    await page.getByRole('button', { name: /^Payer 59,00/ }).click()
    await page.getByRole('button', { name: 'Confirmer le paiement' }).click()
    await page.getByRole('link', { name: 'Retour à mon compte' }).click()
    await page.getByRole('link', { name: 'Préparer le lancement de Marché Pro' }).click()
    await expect(page.getByRole('checkbox')).toHaveCount(6)
    await expect(async () => {
      for (const caseACocher of await page.getByRole('checkbox').all()) await caseACocher.check()
      await expect(page.getByText('6 sur 6 points vérifiés')).toBeVisible({ timeout: 1000 })
    }).toPass({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(page.getByText('Votre liste est complète.', { exact: false })).toBeVisible()
    await page.goto('/mon-compte')
    await deconnecter(page)

    await seConnecter(page, 'admin@nakayo.test')
    await page.waitForURL('/admin/tableau-de-bord')
    await page.getByRole('link', { name: 'Apps à vérifier' }).click()
    await page.getByRole('button', { name: 'Valider Marché Pro' }).click()
    await expect(page.getByText('« Marché Pro » est validée.', { exact: false })).toBeVisible()
    await deconnecter(page)

    await seConnecter(page, 'valide@exemple.com')
    await page.waitForURL('/mon-compte')
    await page.getByRole('link', { name: 'Préparer le lancement de Marché Pro' }).click()
    await page.getByRole('button', { name: 'Démarrer la campagne' }).click()
    await page.waitForURL(/\/mon-compte\/apps\/[^/]+\/campagne$/)
    await page.getByRole('link', { name: 'Voir les bugs signalés' }).click()
    await expect(page.getByRole('heading', { name: 'Bugs signalés' })).toBeVisible()
    await expect(page.getByText(/2 bugs signalés : 2 à examiner/)).toBeVisible()
    await verifierAccessibilite(page)
    await verifierSansDefilementHorizontal(page)

    await page.getByRole('button', { name: /^Accepter le bug « L’app se ferme/ }).click()
    await expect(page.getByText(/1 à examiner, 1 accepté, 0 refusé/)).toBeVisible()
    await page.getByRole('button', { name: /^Refuser le bug « Texte coupé/ }).click()
    await page.getByLabel('Motif du refus, vu par le testeur').fill('Corrigé dans la version 1.0.1.')
    await verifierAccessibilite(page)
    await page.getByRole('button', { name: 'Confirmer le refus' }).click()
    await expect(page.getByText(/0 à examiner, 1 accepté, 1 refusé/)).toBeVisible()
    await expect(page.getByText('Corrigé dans la version 1.0.1.')).toBeVisible()

    await page.getByRole('button', { name: 'Bloquantes' }).click()
    await expect(page.getByRole('heading', { name: 'Texte coupé sur l’écran d’accueil' })).toHaveCount(0)

    const telechargement = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Exporter en CSV' }).click()
    expect((await telechargement).suggestedFilename()).toMatch(/^bugs-.+\.csv$/)
  })
})
