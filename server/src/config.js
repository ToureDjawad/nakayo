import { fileURLToPath } from 'node:url'

// Configuration lue une fois au démarrage. Valeurs par défaut adaptées au développement.
export function lireConfig(env = process.env) {
  const production = env.NODE_ENV === 'production'
  return {
    production,
    port: Number(env.PORT ?? 3000),
    clientUrl: env.CLIENT_URL ?? 'http://localhost:5173',
    // Cookie « Secure » obligatoire en production (HTTPS), désactivé en local (HTTP).
    cookieSecurise: env.COOKIE_SECURISE ? env.COOKIE_SECURISE === 'true' : production,
    // Contrôles qui appellent Internet (fiche Google Play). Coupés en test pour ne pas
    // dépendre du réseau ; le contrôle est alors marqué « indisponible ».
    controlesReseau: env.CONTROLES_RESEAU ? env.CONTROLES_RESEAU === 'true' : env.NODE_ENV !== 'test',
    // Paiement (US-12) : « simulation » en développement et en test ; en production, rien
    // n'est ouvert tant que les fournisseurs (carte, agrégateur Mobile Money) ne sont pas branchés.
    paiementMode: env.PAIEMENT_MODE ?? (production ? 'aucun' : 'simulation'),
    // Secret partagé avec les fournisseurs pour signer leurs webhooks (docs/api-sprint2.md §2.4).
    paiementWebhookSecret: env.PAIEMENT_WEBHOOK_SECRET ?? (production ? null : 'secret-webhook-developpement'),
    // Groupe Google des testeurs Nakayo (US-13), que le développeur ajoute à son test fermé.
    // Vide tant que le groupe n'est pas créé : l'équipe donne alors l'adresse par email.
    groupeTesteurs: env.GROUPE_GOOGLE_TESTEURS || null,
    dossierDocuments: env.DOSSIER_DOCUMENTS ?? fileURLToPath(new URL('../stockage/documents/', import.meta.url)),
  }
}
