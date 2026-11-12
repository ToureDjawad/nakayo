// Formats d'affichage. Les dates sont montrées à l'heure du Bénin.
export const FUSEAU_BENIN = 'Africa/Porto-Novo'

const formatDateHeure = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: FUSEAU_BENIN,
})

export function dateHeure(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return formatDateHeure.format(date).replace(',', ' à')
}

// Date du jour au format AAAA-MM-JJ, à l'heure du Bénin (pour les champs date).
export function aujourdhuiBenin(maintenant = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSEAU_BENIN }).format(maintenant)
}

// +2290197000000 devient +229 01 97 00 00 00.
export function telephone(e164) {
  if (!e164) return ''
  const m = /^\+229(\d{10})$/.exec(e164)
  if (!m) return e164
  return `+229 ${m[1].match(/\d{2}/g).join(' ')}`
}

export const OPERATEURS = { mtn: 'MTN', moov: 'Moov' }

export function operateur(code) {
  return OPERATEURS[code] ?? code ?? ''
}

export const ROLES = { developpeur: 'Développeur', testeur: 'Testeur', admin: 'Administrateur' }

export function pluriel(n, singulier, plurielForme = `${singulier}s`) {
  return `${n} ${n > 1 ? plurielForme : singulier}`
}

// Montant en plus petite unité : 2900 USD devient « 29,00 $ US », 17500 XOF devient « 17 500 FCFA ».
export function montantLisible(montant, devise) {
  if (devise === 'XOF') return `${new Intl.NumberFormat('fr-FR').format(montant).replace(/\s/g, ' ')} FCFA`
  return `${(montant / 100).toFixed(2).replace('.', ',')} $ US`
}
