// Niveaux des testeurs (US-38, docs/api-niveaux.md) : Bronze au départ, puis Argent et Or selon
// les campagnes menées au bout, les bugs acceptés et l'assiduité. Le niveau est recalculé à chaque
// lecture : un testeur souvent remplacé peut redescendre.
// Les offres Pro et Plus prennent d'abord les testeurs Or, puis Argent, puis Bronze.
export const NIVEAUX = [
  { code: 'bronze', nom: 'Bronze', conditions: {} },
  { code: 'argent', nom: 'Argent', conditions: { campagnes: 1 } },
  { code: 'or', nom: 'Or', conditions: { campagnes: 3, bugs: 2, assiduite: 75 } },
]

// Assiduité : part des affectations menées au bout, lissée pour qu'un nouveau testeur parte à 0,5.
export function assiduite({ terminees = 0, remplacees = 0, remises = 0 }) {
  return (terminees + 1) / (terminees + remplacees + remises + 2)
}

// Assiduité en pourcentage entier (0 à 100), lissée comme pour l'affectation.
export const pourcentageAssiduite = (stats) => Math.floor(assiduite(stats) * 100 + 1e-9)

const valeurs = ({ terminees = 0, bugsAcceptes = 0, ...stats }) => ({
  campagnes: terminees,
  bugs: bugsAcceptes,
  assiduite: pourcentageAssiduite({ terminees, ...stats }),
})

const atteint = (niveau, actuel) => Object.entries(niveau.conditions).every(([cle, requis]) => actuel[cle] >= requis)

// Rang du niveau : 0 Bronze, 1 Argent, 2 Or.
// stats : { terminees, remplacees, remises, bugsAcceptes }
export function rangNiveau(stats) {
  const actuel = valeurs(stats)
  let rang = 0
  NIVEAUX.forEach((niveau, i) => {
    if (i === rang + 1 && atteint(niveau, actuel)) rang = i
  })
  return rang
}

// Niveau pour l'API : le niveau atteint, les chiffres du testeur et ce qu'il manque pour le suivant.
export function niveauTesteur(stats) {
  const actuel = valeurs(stats)
  const rang = rangNiveau(stats)
  const prochain = NIVEAUX[rang + 1]
  return {
    code: NIVEAUX[rang].code,
    nom: NIVEAUX[rang].nom,
    campagnesTerminees: actuel.campagnes,
    bugsAcceptes: actuel.bugs,
    assiduite: actuel.assiduite,
    suivant: prochain
      ? {
          code: prochain.code,
          nom: prochain.nom,
          conditions: Object.entries(prochain.conditions).map(([code, requis]) => ({
            code,
            requis,
            actuel: actuel[code],
            rempli: actuel[code] >= requis,
          })),
        }
      : null,
  }
}
