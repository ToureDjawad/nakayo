// Usage : npm run admin:creer -- --email admin@nakayo.bj [--nom "Prénom Nom"]
// Le mot de passe est demandé au clavier (non affiché), ou lu dans NAKAYO_ADMIN_MOT_DE_PASSE.
import { createInterface } from 'node:readline'
import { parseArgs } from 'node:util'
import { pool } from '../db/pool.js'
import { creerAdmin } from '../services/admins.js'

function demanderCache(question) {
  return new Promise((resoudre) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    rl._writeToOutput = (chaine) => {
      if (chaine.startsWith(question)) process.stdout.write(question)
    }
    rl.question(question, (reponse) => {
      rl.close()
      process.stdout.write('\n')
      resoudre(reponse)
    })
  })
}

const { values } = parseArgs({ options: { email: { type: 'string' }, nom: { type: 'string' } } })
if (!values.email) {
  console.error('Usage : npm run admin:creer -- --email admin@exemple.bj [--nom "Prénom Nom"]')
  process.exit(1)
}

try {
  const motDePasse = process.env.NAKAYO_ADMIN_MOT_DE_PASSE ?? (await demanderCache('Mot de passe (10 caractères min.) : '))
  const { id, cree } = await creerAdmin(pool, { email: values.email, nom: values.nom, motDePasse })
  console.log(cree ? `Admin créé (id ${id}).` : `Admin existant (id ${id}) : mot de passe mis à jour.`)
} catch (erreur) {
  console.error(erreur.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
