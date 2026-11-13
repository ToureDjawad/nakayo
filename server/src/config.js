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
    // Paiement (US-12) : « simulation » en développement et en test, « fedapay » une fois le compte
    // marchand ouvert (US-03) ; en production, rien n'est ouvert tant qu'aucun fournisseur n'est branché.
    paiementMode: env.PAIEMENT_MODE ?? (production ? 'aucun' : 'simulation'),
    // Versements aux testeurs (US-22) : « simulation » hors production, « fedapay » une fois les
    // dépôts activés ; en production, les versements attendent tant qu'aucun fournisseur n'est branché.
    versementMode: env.VERSEMENT_MODE ?? (production ? 'aucun' : 'simulation'),
    // Agrégateur FedaPay (docs/fedapay.md) : clé secrète, environnement (« sandbox » ou
    // « live ») et secret de signature du webhook, donnés par le tableau de bord FedaPay.
    fedapay: {
      cleSecrete: env.FEDAPAY_CLE_SECRETE || null,
      environnement: env.FEDAPAY_ENVIRONNEMENT === 'live' ? 'live' : 'sandbox',
      secretWebhook: env.FEDAPAY_SECRET_WEBHOOK || null,
    },
    // US-25 : SMS de secours à 22 h quand un rapport manque (désactivable, chaque SMS a un coût).
    rappelsSms: env.RAPPELS_SMS ? env.RAPPELS_SMS === 'true' : true,
    // Secret partagé avec les fournisseurs pour signer leurs webhooks (docs/api-sprint2.md §2.4).
    paiementWebhookSecret: env.PAIEMENT_WEBHOOK_SECRET ?? (production ? null : 'secret-webhook-developpement'),
    // Groupe Google des testeurs Nakayo (US-13), que le développeur ajoute à son test fermé.
    // Vide tant que le groupe n'est pas créé : l'équipe donne alors l'adresse par email.
    groupeTesteurs: env.GROUPE_GOOGLE_TESTEURS || null,
    dossierDocuments: env.DOSSIER_DOCUMENTS ?? fileURLToPath(new URL('../stockage/documents/', import.meta.url)),
  }
}
