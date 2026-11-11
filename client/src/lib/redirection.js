// Page où envoyer quelqu'un après sa connexion.
// `suite` vient de l'adresse (?suite=/admin/comptes) : on n'accepte qu'un chemin interne,
// pour qu'un lien piégé ne puisse pas renvoyer vers un autre site.
export function suiteSure(suite) {
  if (typeof suite !== 'string' || !suite.startsWith('/') || suite.startsWith('//') || suite.includes('\\')) return null
  if (/^\/(connexion|mot-de-passe-oublie|reinitialiser-mot-de-passe)(\/|\?|$)/.test(suite)) return null
  return suite
}

export function destinationApresConnexion(utilisateur, suite) {
  const sure = suiteSure(suite)
  const admin = utilisateur?.role === 'admin'
  if (sure && (admin || !sure.startsWith('/admin'))) return sure
  return admin ? '/admin/comptes' : '/mon-compte'
}
