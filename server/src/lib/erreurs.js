// Erreurs au format du contrat (docs/api-sprint1.md §1.3).
export class ErreurHttp extends Error {
  constructor(statut, code, { message, champs, retryAfter, ...details } = {}) {
    super(message ?? code)
    this.statut = statut
    this.code = code
    this.champs = champs
    this.retryAfter = retryAfter
    this.details = details
  }
}

export const erreurValidation = (champs) => new ErreurHttp(422, 'validation', { message: 'Certains champs sont invalides.', champs })
export const nonAuthentifie = () => new ErreurHttp(401, 'non_authentifie', { message: 'Session absente ou expirée.' })
export const interdit = () => new ErreurHttp(403, 'interdit', { message: 'Accès refusé.' })
export const introuvable = (message = 'Ressource introuvable.') => new ErreurHttp(404, 'introuvable', { message })

export function corpsErreur(erreur) {
  return {
    erreur: {
      code: erreur.code,
      message: erreur.message,
      ...(erreur.champs ? { champs: erreur.champs } : {}),
      ...erreur.details,
    },
  }
}

// Dernier middleware : transforme toute erreur en réponse JSON du contrat.
export function gestionnaireErreurs(journal = console) {
  return (erreur, _req, res, _next) => {
    if (erreur instanceof ErreurHttp) {
      if (erreur.retryAfter) res.set('Retry-After', String(erreur.retryAfter))
      return res.status(erreur.statut).json(corpsErreur(erreur))
    }
    if (erreur?.type === 'entity.parse.failed') {
      return res.status(400).json(corpsErreur(new ErreurHttp(400, 'json_invalide', { message: 'Corps JSON illisible.' })))
    }
    if (erreur?.type === 'entity.too.large') {
      return res.status(413).json(corpsErreur(new ErreurHttp(413, 'corps_trop_lourd', { message: 'Requête trop volumineuse.' })))
    }
    journal.error(erreur)
    return res.status(500).json(corpsErreur(new ErreurHttp(500, 'erreur_interne', { message: 'Erreur inattendue.' })))
  }
}
