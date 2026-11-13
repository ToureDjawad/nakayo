import { expect, test } from '@playwright/test'
import { connecterAdmin, verifierAccessibilite, verifierSansDefilementHorizontal } from './outils.js'

const aujourdhui = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Porto-Novo' }).format(new Date())

test.describe('Back-office : comptes en attente (US-08)', () => {
  test('sans session, la page demande de se connecter', async ({ page }) => {
    await page.goto('/admin/comptes')
    await expect(page.getByText('Cette page est réservée à l’équipe Nakayo.')).toBeVisible()
  })

  test('un développeur connecté n’a pas accès au back-office', async ({ page }) => {
    await connecterAdmin(page, 'valide@exemple.com')
    await page.goto('/admin/comptes')
    await expect(page.getByText('Accès réservé aux administrateurs')).toBeVisible()
  })

  test('liste, pagination et filtres', async ({ page }) => {
    await connecterAdmin(page)
    await page.goto('/admin/comptes')
    await expect(page.getByRole('heading', { name: '23 comptes en attente' })).toBeVisible()
    await expect(page.getByRole('article')).toHaveCount(20)

    await page.getByRole('button', { name: 'Suivant' }).click()
    await expect(page).toHaveURL('/admin/comptes?page=2')
    await expect(page.getByText('Page 2 sur 2')).toBeVisible()
    await expect(page.getByRole('article')).toHaveCount(3)
    await page.goBack()
    await expect(page.getByText('Page 1 sur 2')).toBeVisible()

    await page.getByLabel('Rôle', { exact: true }).selectOption('testeur')
    await expect(page.getByRole('heading', { name: '13 comptes en attente pour ces filtres' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Pagination' })).toBeHidden()

    await page.getByLabel('Inscrit à partir du').fill(aujourdhui())
    await expect(page.getByRole('heading', { name: 'Aucun compte en attente' })).toBeVisible()
    await expect(page.getByText(/Aucun compte ne correspond à ces filtres/)).toBeVisible()

    await page.getByLabel('Inscrit jusqu’au').fill('2020-01-01')
    await expect(page.getByText('La date de fin doit être après la date de début.')).toBeVisible()

    await page.getByRole('button', { name: 'Effacer les filtres' }).click()
    await expect(page.getByRole('heading', { name: '23 comptes en attente' })).toBeVisible()
  })

  test('valider un compte le retire de la liste, même après rechargement', async ({ page }) => {
    await connecterAdmin(page)
    await page.goto('/admin/comptes?role=developpeur')
    const carte = page.getByRole('article', { name: 'Studio Lagune' })
    await expect(carte.getByText('Contrôles conformes')).toBeVisible()

    await carte.getByRole('button', { name: 'Valider le compte de Studio Lagune' }).click()
    await expect(page.getByText('Compte de Studio Lagune validé. La personne est prévenue par email.')).toBeVisible()
    await expect(carte).toBeHidden()
    await expect(page.getByRole('heading', { name: '9 comptes en attente pour ces filtres' })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('heading', { name: '9 comptes en attente pour ces filtres' })).toBeVisible()
    await expect(page.getByRole('article', { name: 'Studio Lagune' })).toBeHidden()
  })

  test('refuser au clavier, avec motif obligatoire', async ({ page }) => {
    await connecterAdmin(page)
    await page.goto('/admin/comptes?role=testeur')
    const carte = page.getByRole('article', { name: 'Abdou Salami' })
    await expect(carte.getByText('Le selfie est illisible (trop sombre).')).toBeVisible()

    await carte.getByRole('button', { name: 'Refuser le compte de Abdou Salami' }).focus()
    await page.keyboard.press('Enter')
    await expect(carte.getByLabel('Motif du refus')).toBeFocused()

    await page.keyboard.press('Tab')
    await page.keyboard.press('Enter')
    await expect(carte.getByText('Indiquez le motif du refus. Il sera envoyé à la personne.')).toBeVisible()
    await expect(carte.getByLabel('Motif du refus')).toBeFocused()

    await page.keyboard.type('Le selfie est trop sombre, merci de vous réinscrire avec une photo nette.')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Enter')
    await expect(page.getByText('Compte de Abdou Salami refusé. Le motif est envoyé par SMS.')).toBeVisible()
    await expect(carte).toBeHidden()
  })

  test('un compte déjà traité ailleurs est signalé et retiré', async ({ page }) => {
    await connecterAdmin(page)
    await page.goto('/admin/comptes?role=testeur&tri=recent')
    const carte = page.getByRole('article', { name: 'Carine Tossou' })
    await carte.getByRole('button', { name: 'Valider le compte de Carine Tossou' }).click()
    await expect(page.getByText(/Carine Tossou a déjà été traité par un autre administrateur/)).toBeVisible()
    await expect(carte).toBeHidden()
  })

  test('photos d’identité affichées à la demande', async ({ page }) => {
    await connecterAdmin(page)
    await page.goto('/admin/comptes?role=testeur')
    const carte = page.getByRole('article', { name: 'Koffi Agbo' })
    await carte.getByRole('button', { name: 'Afficher la pièce d’identité et le selfie' }).click()
    await expect(carte.getByRole('img', { name: 'Pièce d’identité de Koffi Agbo' })).toBeVisible()
    await expect(carte.getByRole('img', { name: 'Selfie de Koffi Agbo' })).toBeVisible()
  })

  test('accessibilité et affichage mobile', async ({ page }) => {
    await connecterAdmin(page)
    await page.goto('/admin/comptes')
    await expect(page.getByRole('heading', { name: '23 comptes en attente' })).toBeVisible()
    await verifierAccessibilite(page)
    await verifierSansDefilementHorizontal(page)

    const carte = page.getByRole('article', { name: /Petit Studio Indépendant/ })
    await carte.getByRole('button', { name: /Refuser le compte/ }).click()
    await carte.getByRole('button', { name: 'Confirmer le refus' }).click()
    await expect(carte.getByText('Indiquez le motif du refus. Il sera envoyé à la personne.')).toBeVisible()
    await verifierAccessibilite(page)
    await verifierSansDefilementHorizontal(page)
  })
})
