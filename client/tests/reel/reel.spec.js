import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

const JOURNAL = process.env.JOURNAL_API
const API = 'http://127.0.0.1:3100'

async function dernierDuJournal(motif) {
  for (let i = 0; i < 50; i++) {
    const tous = [...readFileSync(JOURNAL, 'utf8').matchAll(motif)]
    if (tous.length) return tous.at(-1)
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(`Rien dans le journal pour ${motif}`)
}

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(300, 1)])

test.describe.configure({ mode: 'serial' })

test('développeur : inscription, lien de l’email, compte en attente (API réelle)', async ({ page }) => {
  await page.goto('/inscription')
  await page.getByLabel('Nom de développeur Google Play').fill('Studio Lagune')
  await page.getByLabel('Adresse email').fill('lagune@studio.bj')
  await page.getByLabel('Mot de passe').fill('une phrase longue')
  await page.getByLabel('Pays').selectOption('BJ')
  await page.getByLabel('Lien de votre fiche développeur Google Play').fill('play.google.com/store/apps/dev?id=555')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Créer mon compte' }).click()
  await expect(page.getByRole('heading', { name: 'Vérifiez votre adresse email' })).toBeVisible()

  const lien = await dernierDuJournal(/http:\/\/127\.0\.0\.1:5180(\/verification-email\?jeton=[\w-]+)/g)
  await page.goto(lien[1])
  await expect(page.getByRole('heading', { name: 'Votre compte est en attente de validation' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Votre compte est en attente de validation' })).toBeVisible()
})

test('testeur inscrit par l’API Android, visible côté admin avec ses photos', async ({ request }) => {
  await request.post(`${API}/api/auth/sms/envoi`, { data: { telephone: '+2290197000000' } })
  const code = (await dernierDuJournal(/votre code est (\d{6})/g))[1]
  const appareil = { fabricant: 'Tecno', modele: 'Spark 20', versionAndroid: '14', niveauApi: 34, identifiant: 'app-123456789' }
  const verif = await (await request.post(`${API}/api/auth/sms/verification`, { data: { telephone: '+2290197000000', code, appareil } })).json()
  const r = await request.post(`${API}/api/testeurs/inscription`, {
    headers: { Authorization: `Bearer ${verif.jetonInscription}` },
    multipart: {
      nom: 'Koffi Agbo',
      ville: 'Cotonou',
      gmail: 'koffi.agbo@gmail.com',
      numeroMomo: '+2290196000000',
      operateurMomo: 'mtn',
      consentementSuivi: 'true',
      accepteConditions: 'true',
      appareil: JSON.stringify(appareil),
      pieceIdentite: { name: 'piece.jpg', mimeType: 'image/jpeg', buffer: JPEG },
      selfie: { name: 'selfie.jpg', mimeType: 'image/jpeg', buffer: JPEG },
    },
  })
  expect(r.status()).toBe(201)
})

test('admin : liste, photos, refus d’un développeur, validation d’un testeur', async ({ page }) => {
  await page.goto('/connexion')
  await page.getByLabel('Adresse email').fill('admin@nakayo.bj')
  await page.getByLabel('Mot de passe', { exact: true }).fill('admin-nakayo-2026')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page).toHaveURL('/admin/comptes')
  await expect(page.getByRole('heading', { name: /2 comptes en attente/ })).toBeVisible()

  const testeur = page.getByRole('article', { name: 'Koffi Agbo' })
  await expect(testeur.getByText('Titulaire Mobile Money identique au nom saisi')).toBeVisible()
  await testeur.getByRole('button', { name: 'Afficher la pièce d’identité et le selfie' }).click()
  const photo = testeur.getByRole('img', { name: 'Pièce d’identité de Koffi Agbo' })
  await expect(photo).toBeVisible()
  expect(await photo.evaluate((img) => img.complete && img.naturalWidth >= 0)).toBe(true)

  const dev = page.getByRole('article', { name: 'Studio Lagune' })
  await dev.getByRole('button', { name: 'Refuser le compte de Studio Lagune' }).click()
  await dev.getByLabel('Motif du refus').fill('La fiche Google Play indiquée n’existe pas.')
  await dev.getByRole('button', { name: /Confirmer le refus|Refuser/ }).last().click()
  await expect(page.getByText('Compte de Studio Lagune refusé. Le motif est envoyé par email.')).toBeVisible()

  await testeur.getByRole('button', { name: 'Valider le compte de Koffi Agbo' }).click()
  await expect(page.getByText('Compte de Koffi Agbo validé. La personne est prévenue par SMS.')).toBeVisible()
  await page.reload()
  await expect(page.getByText(/Aucun compte en attente/)).toBeVisible()
})

test('développeur refusé : voit le motif ; mot de passe oublié puis reconnexion', async ({ page }) => {
  await page.goto('/connexion')
  await page.getByLabel('Adresse email').fill('lagune@studio.bj')
  await page.getByLabel('Mot de passe', { exact: true }).fill('une phrase longue')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('heading', { name: 'Votre compte n’a pas été validé' })).toBeVisible()
  await expect(page.getByText('La fiche Google Play indiquée n’existe pas.')).toBeVisible()
  await page.getByRole('button', { name: /Se déconnecter/ }).click()

  await page.goto('/mot-de-passe-oublie')
  await page.getByLabel('Adresse email').fill('lagune@studio.bj')
  await page.getByRole('button', { name: 'Envoyer le lien' }).click()
  await expect(page.getByText(/Si un compte existe pour/)).toBeVisible()
  const lien = await dernierDuJournal(/http:\/\/127\.0\.0\.1:5180(\/reinitialiser-mot-de-passe\?jeton=[\w-]+)/g)
  await page.goto(lien[1])
  await page.getByLabel('Nouveau mot de passe').fill('ma nouvelle phrase secrète')
  await page.getByLabel('Confirmer le mot de passe').fill('ma nouvelle phrase secrète')
  await page.getByRole('button', { name: 'Enregistrer le mot de passe' }).click()
  await expect(page).toHaveURL('/connexion')

  await page.getByLabel('Adresse email').fill('lagune@studio.bj')
  await page.getByLabel('Mot de passe', { exact: true }).fill('une phrase longue')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('alert')).toHaveText('Adresse email ou mot de passe incorrect.')
})
