import AxeBuilder from '@axe-core/playwright'
import { expect } from '@playwright/test'

export async function remplirInscription(page, valeurs = {}) {
  const v = {
    nom: 'Studio Awa',
    email: `awa.${Date.now()}@studio.bj`,
    motDePasse: 'une phrase longue',
    pays: 'BJ',
    lien: 'play.google.com/store/apps/dev?id=1234567890',
    ...valeurs,
  }
  await page.getByLabel('Nom de développeur Google Play').fill(v.nom)
  await page.getByLabel('Adresse email').fill(v.email)
  await page.getByLabel('Mot de passe').fill(v.motDePasse)
  await page.getByLabel('Pays').selectOption(v.pays)
  await page.getByLabel('Lien de votre fiche développeur Google Play').fill(v.lien)
  await page.getByRole('checkbox').check()
  return v
}

// L'API simulée écrit le lien de vérification dans la console du navigateur.
export function capturerLienVerification(page) {
  return new Promise((resoudre) => {
    page.on('console', (message) => {
      const trouve = message.text().match(/(\/verification-email\?jeton=\w+)/)
      if (trouve) resoudre(trouve[1])
    })
  })
}

export async function verifierAccessibilite(page) {
  const resultat = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  const violations = resultat.violations.map(
    (v) => `${v.id} : ${v.help} (${v.nodes.map((n) => n.target.join(' ') + ' ' + (n.any[0]?.message ?? '')).join(' | ')})`,
  )
  expect(violations).toEqual([])
}

export async function verifierSansDefilementHorizontal(page) {
  const deborde = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(deborde).toBe(false)
}

// Ouvre une session dans l'API simulée (l'écran de connexion arrive avec US-09).
export async function connecterAdmin(page, email = 'admin@nakayo.test') {
  await page.goto('/')
  await page.waitForFunction(() => window.nakayoMocks)
  await page.evaluate((adresse) => window.nakayoMocks.connecter(adresse), email)
}
