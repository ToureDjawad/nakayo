// Domaines d'adresses jetables les plus courants. Liste courte et volontairement modeste :
// le contrôle donne une alerte, la décision reste à l'admin.
export const DOMAINES_JETABLES = new Set([
  '10minutemail.com',
  '20minutemail.com',
  'dispostable.com',
  'emailondeck.com',
  'fakeinbox.com',
  'getairmail.com',
  'getnada.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamailblock.com',
  'jetable.org',
  'maildrop.cc',
  'mailinator.com',
  'mailnesia.com',
  'mintemail.com',
  'mohmal.com',
  'moakt.com',
  'sharklasers.com',
  'spamgourmet.com',
  'temp-mail.org',
  'tempail.com',
  'tempmail.com',
  'tempmailo.com',
  'throwawaymail.com',
  'trashmail.com',
  'yopmail.com',
  'yopmail.fr',
])

export function estJetable(email) {
  const domaine = String(email ?? '').split('@')[1]?.toLowerCase()
  return Boolean(domaine && DOMAINES_JETABLES.has(domaine))
}
