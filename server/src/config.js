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
    dossierDocuments: env.DOSSIER_DOCUMENTS ?? fileURLToPath(new URL('../stockage/documents/', import.meta.url)),
  }
}
