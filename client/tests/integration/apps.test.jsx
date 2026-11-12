import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { rendreA, simulerApi } from './outils.jsx'

const DEV = { id: '2', role: 'developpeur', statut: 'valide', email: 'awa@studio.bj', emailVerifie: true, nom: 'Studio Awa', pays: 'BJ' }
const APP = {
  id: '7',
  nom: 'Marché Facile',
  package: 'bj.studioawa.marche',
  lienTestFerme: 'https://play.google.com/apps/testing/bj.studioawa.marche',
  description: 'Une app pour commander au marché de Dantokpa et se faire livrer.',
  instructions: 'Chaque jour, ouvrez l’app, cherchez un produit et ajoutez-le au panier.',
  fonctionnalites: ['Recherche de produits', 'Panier', 'Suivi de livraison'],
  connexionRequise: false,
  identifiantsTest: null,
  comptePlay: 'personnel_recent',
  testObligatoire: true,
  statut: 'brouillon',
  creeLe: '2026-11-12T09:00:00.000Z',
  modifieLe: '2026-11-12T09:00:00.000Z',
}
const BASE = {
  'GET /api/auth/moi': { corps: { utilisateur: DEV } },
  'GET /api/support': { corps: { support: { whatsapp: null } } },
}

// Coller les textes longs : la frappe caractère par caractère est lente quand tous les tests tournent.
async function coller(user, champ, texte) {
  await user.click(champ)
  await user.paste(texte)
}

async function remplir(user, { connexion = false } = {}) {
  await user.type(await screen.findByLabelText('Nom de l’app'), 'Marché Facile')
  await user.type(screen.getByLabelText('Nom du package'), ' bj.studioawa.marche ')
  await coller(user, screen.getByLabelText('Description'), APP.description)
  await coller(user, screen.getByLabelText('Lien d’inscription au test fermé'), 'play.google.com/apps/testing/bj.studioawa.marche')
  await user.click(screen.getByRole('radio', { name: /Compte personnel créé après/ }))
  await coller(user, screen.getByLabelText('Instructions de test'), APP.instructions)
  await user.type(screen.getByLabelText('Fonctionnalité 1'), 'Recherche de produits')
  await user.type(screen.getByLabelText('Fonctionnalité 2'), 'Panier')
  await user.type(screen.getByLabelText('Fonctionnalité 3'), 'Suivi de livraison')
  await user.click(screen.getByRole('radio', { name: connexion ? /Oui, il faut un compte/ : 'Non' }))
}

describe('Soumettre une app (US-11)', () => {
  it('le compte validé liste ses apps et propose d’en soumettre une', async () => {
    simulerApi({ ...BASE, 'GET /api/apps': { corps: { apps: [APP] } } })
    rendreA('/mon-compte')
    const carte = (await screen.findByText('Marché Facile', { selector: 'p' })).closest('li')
    expect(within(carte).getByText('Brouillon')).toBeInTheDocument()
    expect(within(carte).getByRole('link', { name: 'Modifier Marché Facile' })).toHaveAttribute('href', '/mon-compte/apps/7/modifier')
    expect(screen.getByRole('link', { name: 'Soumettre une app' })).toHaveAttribute('href', '/mon-compte/apps/nouvelle')
  })

  it('soumet le formulaire avec les valeurs nettoyées puis revient au compte', async () => {
    const user = userEvent.setup()
    const serveur = simulerApi({
      ...BASE,
      'POST /api/apps': { statut: 201, corps: { app: APP } },
      'GET /api/apps': { corps: { apps: [APP] } },
    })
    rendreA('/mon-compte/apps/nouvelle')
    await remplir(user)
    await user.click(screen.getByRole('button', { name: 'Ajouter une fonctionnalité' }))
    await user.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }))

    expect(await screen.findByText(/« Marché Facile » est enregistrée/, {}, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.getByText('Brouillon enregistré', { selector: 'p.font-semibold' })).toBeInTheDocument()
    expect(serveur.appelsVers('POST', '/api/apps')[0].corps).toEqual({
      nom: 'Marché Facile',
      package: 'bj.studioawa.marche',
      lienTestFerme: 'https://play.google.com/apps/testing/bj.studioawa.marche',
      description: APP.description,
      instructions: APP.instructions,
      fonctionnalites: APP.fonctionnalites,
      connexionRequise: false,
      identifiantsTest: null,
      comptePlay: 'personnel_recent',
    })
  })

  it('demande des identifiants quand l’app exige une connexion', async () => {
    const user = userEvent.setup()
    const serveur = simulerApi(BASE)
    rendreA('/mon-compte/apps/nouvelle')
    await remplir(user, { connexion: true })
    await user.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }))
    expect(await screen.findByText('Donnez un compte de test : les testeurs doivent pouvoir se connecter.')).toBeInTheDocument()
    expect(screen.getByLabelText('Identifiants de test')).toHaveFocus()
    expect(serveur.appelsVers('POST', '/api/apps')).toHaveLength(0)
  })

  it('vérifie les champs : lien qui vise une autre app, fonctionnalités manquantes', async () => {
    const user = userEvent.setup()
    simulerApi(BASE)
    rendreA('/mon-compte/apps/nouvelle')
    await user.type(await screen.findByLabelText('Nom du package'), 'com.exemple.app')
    expect(screen.getByText(/https:\/\/play\.google\.com\/apps\/testing\/com\.exemple\.app/)).toBeInTheDocument()
    await user.type(screen.getByLabelText('Lien d’inscription au test fermé'), 'https://play.google.com/apps/testing/com.autre.app')
    await user.type(screen.getByLabelText('Fonctionnalité 1'), 'Panier')
    await user.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }))
    expect(await screen.findByText(/Ce lien vise une autre app/)).toBeInTheDocument()
    expect(screen.getByText('Indiquez au moins 3 fonctionnalités à tester.')).toBeInTheDocument()
    expect(screen.getByText('Indiquez le type de votre compte développeur Google Play.')).toBeInTheDocument()
    expect(screen.getByLabelText('Nom de l’app')).toHaveFocus()
  })

  it('prévient un compte non soumis au test obligatoire, sans bloquer', async () => {
    const user = userEvent.setup()
    simulerApi(BASE)
    rendreA('/mon-compte/apps/nouvelle')
    await user.click(await screen.findByRole('radio', { name: 'Compte d’organisation (entreprise)' }))
    expect(screen.getByText('Le test de 14 jours n’est pas obligatoire pour vous')).toBeInTheDocument()
  })

  it('package déjà inscrit : erreur sur le champ', async () => {
    const user = userEvent.setup()
    simulerApi({
      ...BASE,
      'POST /api/apps': { statut: 409, corps: { erreur: { code: 'conflit', champs: { package: 'deja_utilise' } } } },
    })
    rendreA('/mon-compte/apps/nouvelle')
    await remplir(user)
    await user.click(screen.getByRole('button', { name: 'Enregistrer le brouillon' }))
    expect(await screen.findByText(/Ce package est déjà inscrit sur Nakayo/)).toBeInTheDocument()
    expect(screen.getByLabelText('Nom du package')).toHaveFocus()
  })

  it('compte en attente : le formulaire n’est pas proposé', async () => {
    simulerApi({ ...BASE, 'GET /api/auth/moi': { corps: { utilisateur: { ...DEV, statut: 'en_attente' } } } })
    rendreA('/mon-compte/apps/nouvelle')
    expect(await screen.findByText('Votre compte doit être validé par l’équipe avant de soumettre une app.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Nom de l’app')).not.toBeInTheDocument()
  })
})

describe('Modifier ou supprimer un brouillon (US-11)', () => {
  it('pré-remplit le formulaire et enregistre les modifications', async () => {
    const user = userEvent.setup()
    const serveur = simulerApi({
      ...BASE,
      'GET /api/apps/7': { corps: { app: APP } },
      'PUT /api/apps/7': ({ corps }) => ({ corps: { app: { ...APP, ...corps } } }),
      'GET /api/apps': { corps: { apps: [APP] } },
    })
    rendreA('/mon-compte/apps/7/modifier')
    const nom = await screen.findByLabelText('Nom de l’app')
    expect(nom).toHaveValue('Marché Facile')
    expect(screen.getByRole('radio', { name: 'Non' })).toBeChecked()
    await user.clear(nom)
    await user.type(nom, 'Marché Facile Pro')
    await user.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }))
    expect(await screen.findByText('Modifications enregistrées', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(serveur.appelsVers('PUT', '/api/apps/7')[0].corps.nom).toBe('Marché Facile Pro')
  })

  it('supprime un brouillon après confirmation dans la page', async () => {
    const user = userEvent.setup()
    const serveur = simulerApi({
      ...BASE,
      'GET /api/apps/7': { corps: { app: APP } },
      'DELETE /api/apps/7': { statut: 204 },
      'GET /api/apps': { corps: { apps: [] } },
    })
    rendreA('/mon-compte/apps/7/modifier')
    await user.click(await screen.findByRole('button', { name: 'Supprimer ce brouillon' }))
    await user.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(serveur.appelsVers('DELETE', '/api/apps/7')).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: 'Supprimer ce brouillon' }))
    await user.click(screen.getByRole('button', { name: 'Supprimer définitivement' }))
    expect(await screen.findByText('« Marché Facile » a été supprimée.', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(await screen.findByText('Vous n’avez pas encore soumis d’app.')).toBeInTheDocument()
  })

  it('une app sortie du brouillon ne se modifie plus', async () => {
    simulerApi({ ...BASE, 'GET /api/apps/7': { corps: { app: { ...APP, statut: 'en_verification' } } } })
    rendreA('/mon-compte/apps/7/modifier')
    expect(await screen.findByText('Cette app n’est plus en brouillon : elle ne peut plus être modifiée.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Nom de l’app')).not.toBeInTheDocument()
  })

  it('app introuvable', async () => {
    simulerApi({ ...BASE, 'GET /api/apps/99': { statut: 404, corps: { erreur: { code: 'introuvable' } } } })
    rendreA('/mon-compte/apps/99/modifier')
    expect(await screen.findByText('Cette app est introuvable. Elle a peut-être été supprimée.')).toBeInTheDocument()
  })
})
