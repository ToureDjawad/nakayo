// Petit générateur PDF (pages A4, texte et traits) pour les factures et les rapports, sans dépendance.
// Polices standard Helvetica en WinAnsiEncoding : les accents français sont pris en charge.

// Caractères hors Latin-1 présents dans nos textes, et leur code WinAnsi.
const WIN_ANSI = { '’': 0x92, '‘': 0x91, '“': 0x93, '”': 0x94, '…': 0x85, '–': 0x96, '—': 0x97, '€': 0x80, ' ': 0xa0 }

function octets(texte) {
  const sortie = []
  for (const c of texte) {
    const code = c.codePointAt(0)
    if (WIN_ANSI[c] !== undefined) sortie.push(WIN_ANSI[c])
    else if (code < 256) sortie.push(code)
    else sortie.push(0x3f) // « ? » pour un caractère impossible à afficher
  }
  return sortie
}

// Chaîne littérale PDF : parenthèses et barres obliques échappées.
function chaine(texte) {
  return octets(texte)
    .map((o) => (o === 0x28 || o === 0x29 || o === 0x5c ? `\\${String.fromCharCode(o)}` : String.fromCharCode(o)))
    .join('')
}

// Largeur approximative d'un texte en points (Helvetica ≈ 0,5 em par caractère), pour aligner à droite.
export const largeurApprochee = (texte, taille) => [...texte].length * taille * 0.5

export function creerPage() {
  const instructions = []
  return {
    texte(x, y, contenu, { taille = 10, gras = false, gris = false, blanc = false } = {}) {
      const couleur = blanc ? '1 1 1 rg' : gris ? '0.42 0.40 0.36 rg' : '0.11 0.10 0.09 rg'
      instructions.push(`BT ${couleur} /${gras ? 'F2' : 'F1'} ${taille} Tf ${x} ${y} Td (${chaine(contenu)}) Tj ET`)
    },
    texteADroite(xDroite, y, contenu, options = {}) {
      this.texte(xDroite - largeurApprochee(contenu, options.taille ?? 10), y, contenu, options)
    },
    trait(x1, y, x2, { epaisseur = 0.6 } = {}) {
      instructions.push(`0.85 0.83 0.78 RG ${epaisseur} w ${x1} ${y} m ${x2} ${y} l S`)
    },
    rectangle(x, y, largeur, hauteur, couleur = '0.09 0.33 0.25') {
      instructions.push(`${couleur} rg ${x} ${y} ${largeur} ${hauteur} re f`)
    },
    contenu: () => instructions.join('\n'),
  }
}

// Assemble le document : catalogue, pages A4, deux polices et un flux de contenu par page.
// `pages` est une page de creerPage() ou une liste de pages.
export function documentPdf(pages, { titre }) {
  const liste = Array.isArray(pages) ? pages : [pages]
  // Objets : 1 catalogue, 2 arbre des pages, 3-4 polices, 5 infos, puis (page, flux) pour chaque page.
  const premiere = 6
  const objets = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${liste.map((_, i) => `${premiere + 2 * i} 0 R`).join(' ')}] /Count ${liste.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Title (${chaine(titre)}) /Producer (Nakayo) >>`,
  ]
  liste.forEach((page, i) => {
    objets.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${premiere + 2 * i + 1} 0 R >>`,
    )
    objets.push(Buffer.from(octets(page.contenu())))
  })
  const morceaux = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')]
  const positions = []
  let taille = morceaux[0].length
  objets.forEach((objet, i) => {
    positions.push(taille)
    const morceau = Buffer.isBuffer(objet)
      ? Buffer.concat([Buffer.from(`${i + 1} 0 obj\n<< /Length ${objet.length} >>\nstream\n`, 'latin1'), objet, Buffer.from('\nendstream\nendobj\n', 'latin1')])
      : Buffer.from(`${i + 1} 0 obj\n${objet}\nendobj\n`, 'latin1')
    morceaux.push(morceau)
    taille += morceau.length
  })
  const xref = [
    'xref',
    `0 ${objets.length + 1}`,
    '0000000000 65535 f ',
    ...positions.map((p) => `${String(p).padStart(10, '0')} 00000 n `),
    'trailer',
    `<< /Size ${objets.length + 1} /Root 1 0 R /Info 5 0 R >>`,
    'startxref',
    String(taille),
    '%%EOF',
  ].join('\n')
  morceaux.push(Buffer.from(`${xref}\n`, 'latin1'))
  return Buffer.concat(morceaux)
}

// Coupe un texte en lignes d'au plus `largeur` points (largeur approchée).
export function couperLignes(texte, largeur, taille) {
  const lignes = []
  for (const paragraphe of String(texte).split('\n')) {
    let ligne = ''
    for (const mot of paragraphe.split(/\s+/).filter(Boolean)) {
      const essai = ligne ? `${ligne} ${mot}` : mot
      if (ligne && largeurApprochee(essai, taille) > largeur) {
        lignes.push(ligne)
        ligne = mot
      } else {
        ligne = essai
      }
    }
    lignes.push(ligne)
  }
  return lignes
}

// Document à plusieurs pages écrit de haut en bas : titres, paragraphes coupés, nouvelle page au besoin.
export function creerRedaction({ marge = 56, piedDePage = '' } = {}) {
  const pages = []
  const largeur = 595 - 2 * marge
  let page
  let y
  const nouvellePage = () => {
    page = creerPage()
    pages.push(page)
    y = 790
  }
  const place = (hauteur) => {
    if (y - hauteur < 70) nouvellePage()
  }
  nouvellePage()
  return {
    get page() {
      return page
    },
    get y() {
      return y
    },
    descendre(points) {
      y -= points
    },
    titre(texte, { taille = 14 } = {}) {
      place(taille + 30)
      y -= 10
      page.texte(marge, y, texte, { taille, gras: true })
      y -= taille + 6
    },
    paragraphe(texte, { taille = 10, gras = false, gris = false, retrait = 0 } = {}) {
      for (const ligne of couperLignes(texte, largeur - retrait, taille)) {
        place(taille + 4)
        page.texte(marge + retrait, y, ligne, { taille, gras, gris })
        y -= taille + 4
      }
      y -= 4
    },
    // Ligne « libellé ............ valeur ».
    ligneInfo(libelle, valeur, { taille = 10 } = {}) {
      place(taille + 6)
      page.texte(marge, y, libelle, { taille, gris: true })
      page.texteADroite(marge + largeur, y, valeur, { taille })
      y -= taille + 6
    },
    trait() {
      place(10)
      page.trait(marge, y + 4, marge + largeur)
      y -= 8
    },
    terminer(titreDocument) {
      pages.forEach((p, i) => {
        p.trait(marge, 56, marge + largeur)
        p.texte(marge, 42, piedDePage, { taille: 8, gris: true })
        p.texteADroite(marge + largeur, 42, `Page ${i + 1} sur ${pages.length}`, { taille: 8, gris: true })
      })
      return documentPdf(pages, { titre: titreDocument })
    },
  }
}
