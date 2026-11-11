// Envoi des emails et des SMS. En Sprint 1, aucun fournisseur n'est choisi (question
// ouverte du contrat) : les messages sont écrits dans le journal du serveur et gardés en
// mémoire, ce qui permet de suivre les liens en développement et de les lire dans les tests.
// Pour brancher un fournisseur, il suffit de fournir un objet { envoyer(message) }.
export function creerMessagerieJournal({ canal, journal = console, garder = 50 } = {}) {
  const envoyes = []
  return {
    envoyes,
    async envoyer(message) {
      envoyes.push({ ...message, envoyeLe: new Date().toISOString() })
      if (envoyes.length > garder) envoyes.shift()
      journal.info(`[${canal}] à ${message.a} : ${message.sujet ?? ''}\n${message.texte}`)
    },
    dernierPour(destinataire) {
      return [...envoyes].reverse().find((m) => m.a === destinataire) ?? null
    },
    vider() {
      envoyes.length = 0
    },
  }
}
