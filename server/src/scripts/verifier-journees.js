// Usage : npm run journees:verifier [-- --jour 2026-11-12]
// Vérifie un jour à la main (par défaut : les jours récents pas encore vérifiés).
import { parseArgs } from 'node:util'
import { pool } from '../db/pool.js'
import { creerMessagerieJournal } from '../services/messagerie.js'
import { joursEnRetard, verifierJour } from '../services/verificationQuotidienne.js'

const { values } = parseArgs({ options: { jour: { type: 'string' } } })
if (values.jour && !/^\d{4}-\d{2}-\d{2}$/.test(values.jour)) {
  console.error('Usage : npm run journees:verifier -- --jour AAAA-MM-JJ')
  process.exit(1)
}

const deps = { pool, sms: creerMessagerieJournal({ canal: 'sms' }), journal: console }
try {
  const jours = values.jour ? [values.jour] : await joursEnRetard(pool, { maintenant: new Date() })
  if (!jours.length) console.log('Rien à vérifier : les jours récents sont déjà faits.')
  for (const jour of jours) {
    const bilan = await verifierJour(deps, { jour, maintenant: new Date() })
    console.log(`${jour} : ${bilan.affectations} affectations, ${bilan.joursValides} jours validés, ${bilan.remises} remises à zéro.`)
  }
} finally {
  await pool.end()
}
