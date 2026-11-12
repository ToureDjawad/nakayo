import { introuvable } from '../lib/erreurs.js'
import { montantLisible } from '../lib/offres.js'
import { creerPage, documentPdf } from '../lib/pdf.js'

const PAYS = new Intl.DisplayNames(['fr'], { type: 'region' })
const nomPays = (code) => PAYS.of(code) ?? code

const MOYENS = { carte: 'carte bancaire', mobile_money: 'Mobile Money' }

const dateFr = (date) =>
  new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Porto-Novo' }).format(date)

// Facture du développeur (ou de n'importe quel développeur pour un admin).
export async function lireFacture(db, { numero, developpeurId = null }) {
  const { rows } = await db.query(
    `SELECT f.*, p.reference, p.moyen, p.confirme_le, p.statut AS statut_paiement, p.rembourse_le
       FROM factures f JOIN paiements p ON p.id = f.paiement_id
      WHERE f.numero = $1 AND ($2::bigint IS NULL OR f.developpeur_id = $2)`,
    [numero, developpeurId],
  )
  if (!rows.length) throw introuvable('Facture introuvable.')
  return rows[0]
}

// Facture PDF (US-15) : une page A4 avec l'émetteur, le client, la ligne de l'offre et le paiement.
export function facturePdf(f) {
  const page = creerPage()
  const gauche = 56
  const droite = 539

  page.rectangle(0, 806, 595, 36)
  page.texte(gauche, 818, 'nakayo', { taille: 16, gras: true, blanc: true })
  page.texte(gauche, 760, 'Facture', { taille: 24, gras: true })
  page.texte(gauche, 740, f.numero, { taille: 11, gris: true })
  page.texteADroite(droite, 760, `Émise le ${dateFr(f.emise_le)}`, { taille: 10 })

  page.texte(gauche, 696, 'ÉMETTEUR', { taille: 8, gras: true, gris: true })
  page.texte(gauche, 680, 'Nakayo', { taille: 11, gras: true })
  page.texte(gauche, 665, 'Plateforme de tests fermés pour apps Android', { taille: 9, gris: true })
  page.texte(gauche, 652, 'Cotonou, Bénin', { taille: 9, gris: true })

  page.texte(320, 696, 'CLIENT', { taille: 8, gras: true, gris: true })
  page.texte(320, 680, f.client_nom, { taille: 11, gras: true })
  page.texte(320, 665, f.client_email, { taille: 9, gris: true })
  if (f.client_pays) page.texte(320, 652, nomPays(f.client_pays), { taille: 9, gris: true })

  page.trait(gauche, 610, droite)
  page.texte(gauche, 596, 'DÉSIGNATION', { taille: 8, gras: true, gris: true })
  page.texteADroite(droite, 596, 'MONTANT', { taille: 8, gras: true, gris: true })
  page.trait(gauche, 588, droite)
  page.texte(gauche, 568, f.libelle.length > 70 ? `${f.libelle.slice(0, 69)}…` : f.libelle, { taille: 10 })
  page.texte(gauche, 554, '15 testeurs vérifiés pendant 14 jours, rapports quotidiens', { taille: 9, gris: true })
  page.texteADroite(droite, 568, montantLisible(f.montant, f.devise), { taille: 10 })
  page.trait(gauche, 538, droite)
  page.texte(330, 516, 'Total payé', { taille: 11, gras: true })
  page.texteADroite(droite, 516, montantLisible(f.montant, f.devise), { taille: 11, gras: true })

  page.texte(gauche, 470, `Payé le ${dateFr(f.confirme_le)} par ${MOYENS[f.moyen]}.`, { taille: 10 })
  page.texte(gauche, 455, `Référence du paiement : ${f.reference}`, { taille: 9, gris: true })
  if (f.statut_paiement === 'rembourse') {
    page.texte(gauche, 430, `Remboursé le ${dateFr(f.rembourse_le)}.`, { taille: 10, gras: true })
  }

  page.trait(gauche, 90, droite)
  page.texte(gauche, 74, 'Nakayo · une question sur cette facture ? Écrivez-nous depuis votre espace, rubrique « Écrire à l’équipe ».', { taille: 8, gris: true })
  return documentPdf(page, { titre: `Facture ${f.numero}` })
}
