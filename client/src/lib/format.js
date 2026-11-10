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
