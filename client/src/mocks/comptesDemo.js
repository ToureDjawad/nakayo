// Comptes en attente de démonstration pour le back-office (US-08). Données inventées.
const JOUR = 86400000

const DEVELOPPEURS = [
  ['Studio Lagune', 'BJ', 'contact@studiolagune.bj'],
  ['Kente Apps', 'GH', 'hello@kenteapps.com'],
  ['Dakar Mobile', 'SN', 'equipe@dakarmobile.sn'],
  ['Apps du Sahel', 'BF', 'dev@appsdusahel.bf'],
  ['Lomé Code', 'TG', 'bonjour@lomecode.tg'],
  ['Abidjan Labs', 'CI', 'contact@abidjanlabs.ci'],
  ['Atelier Pixel', 'FR', 'atelier.pixel@yopmail.com'],
  ['Maple Code', 'CA', 'team@maplecode.ca'],
  ['Nairobi Devs', 'KE', 'devs@nairobidevs.co.ke'],
  ['Petit Studio Indépendant au Nom Particulièrement Long pour Tester', 'BJ', 'nom.long@exemple.com'],
]

const TESTEURS = [
  ['Koffi Agbo', 'Cotonou', 'Tecno', 'Spark 20', '14', 34],
  ['Aïcha Dossou', 'Porto-Novo', 'Samsung', 'Galaxy A15', '14', 34],
  ['Mathieu Hounkpè', 'Abomey-Calavi', 'Infinix', 'Hot 40i', '13', 33],
  ['Rachidatou Bio', 'Parakou', 'itel', 'A70', '13', 33],
  ['Sèna Ahouansou', 'Ouidah', 'Xiaomi', 'Redmi 13C', '13', 33],
  ['Ulrich Zinsou', 'Bohicon', 'Tecno', 'Pop 8', '13', 33],
  ['Fifamè Kpadonou', 'Cotonou', 'Samsung', 'Galaxy A05', '13', 33],
  ['Abdou Salami', 'Djougou', 'itel', 'P55', '12', 31],
  ['Grâce Adjovi', 'Lokossa', 'Infinix', 'Smart 8', '13', 33],
  ['Romaric Houngbédji', 'Natitingou', 'Tecno', 'Spark 10', '12', 31],
  ['Nafissatou Yessoufou', 'Cotonou', 'Xiaomi', 'Redmi A3', '14', 34],
  ['Désiré Gbaguidi', 'Abomey', 'Samsung', 'Galaxy A04e', '12', 31],
  ['Carine Tossou', 'Porto-Novo', 'Tecno', 'Spark 20', '14', 34],
]

function c(code, libelle, resultat, detail = null) {
  return { code, libelle, resultat, detail }
}

function controlesDeveloppeur(i, email) {
  const jetable = email.endsWith('@yopmail.com')
  return {
    etat: i === 3 ? 'en_cours' : 'termine',
    liste:
      i === 3
        ? [c('email_jetable', 'Adresse email non jetable', 'ok')]
        : [
            c('email_jetable', 'Adresse email non jetable', jetable ? 'alerte' : 'ok', jetable ? 'Domaine connu comme jetable (yopmail.com).' : null),
            c(
              'fiche_play_accessible',
              'Fiche développeur Google Play accessible',
              i === 5 ? 'echec' : i === 8 ? 'indisponible' : 'ok',
              i === 5 ? 'La page renvoie une erreur 404.' : i === 8 ? 'Google Play n’a pas répondu à temps.' : null,
            ),
            c('fiche_play_doublon', 'Fiche liée à aucun autre compte', 'ok'),
          ],
  }
}

function controlesTesteur(i) {
  const doublonAppareil = i === 2 || i === 9
  return {
    etat: 'termine',
    liste: [
      c('momo_doublon', 'Numéro Mobile Money unique', i === 4 ? 'echec' : 'ok', i === 4 ? 'Déjà lié au compte de Ulrich Zinsou.' : null),
      c(
        'momo_titulaire',
        'Titulaire Mobile Money identique au nom saisi',
        i === 6 ? 'alerte' : i === 11 ? 'indisponible' : 'ok',
        i === 6 ? 'Titulaire enregistré : « F. KPADONOU EPSE AGOSSOU ».' : i === 11 ? 'Service de l’opérateur indisponible.' : null,
      ),
      c('gmail_doublon', 'Gmail unique', 'ok'),
      c('appareil_doublon', 'Appareil utilisé par aucun autre compte', doublonAppareil ? 'alerte' : 'ok', doublonAppareil ? 'Même appareil qu’un compte inscrit la même semaine.' : null),
      c('photos_presentes', 'Pièce d’identité et selfie reçus', i === 7 ? 'echec' : 'ok', i === 7 ? 'Le selfie est illisible (trop sombre).' : null),
    ],
  }
}

function numero(i, decalage) {
  return `+22901${String(90000000 + i * 1371 + decalage).slice(0, 8)}`
}

function gmail(nom) {
  return `${nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, '.')}@gmail.com`
}

export function comptesDemo(maintenant = Date.now()) {
  const comptes = []
  DEVELOPPEURS.forEach(([nom, pays, email], i) => {
    comptes.push({
      id: String(200 + i),
      role: 'developpeur',
      statut: 'en_attente',
      emailVerifie: true,
      email,
      motDePasse: 'motdepasse-demo',
      nom,
      pays,
      lienFicheDeveloppeur: `https://play.google.com/store/apps/dev?id=${7000000000000000000n + BigInt(i * 7919)}`,
      motifRefus: null,
      creeLe: new Date(maintenant - (i * 2 + 1) * JOUR - i * 3600000).toISOString(),
      controles: controlesDeveloppeur(i, email),
    })
  })
  TESTEURS.forEach(([nom, ville, fabricant, modele, versionAndroid, niveauApi], i) => {
    comptes.push({
      id: String(300 + i),
      role: 'testeur',
      statut: 'en_attente',
      telephone: numero(i, 11),
      nom,
      ville,
      gmail: gmail(nom),
      numeroMomo: numero(i, i % 3 === 0 ? 11 : 52),
      operateurMomo: i % 3 === 1 ? 'moov' : 'mtn',
      appareil: { fabricant, modele, versionAndroid, niveauApi },
      motifRefus: null,
      creeLe: new Date(maintenant - (i * 1.5 + 0.2) * JOUR).toISOString(),
      controles: controlesTesteur(i),
      // Simule une décision prise entre-temps par un autre administrateur.
      simulerConflit: i === 12,
    })
  })
  return comptes
}

// Image de remplacement pour les photos des testeurs.
export function photoDemo(libelle, nom) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="220" viewBox="0 0 320 220">
<rect width="320" height="220" fill="#f5f5f4"/><rect x="8" y="8" width="304" height="204" fill="none" stroke="#a8a29e" stroke-dasharray="6 4"/>
<text x="160" y="104" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#44403c">${libelle}</text>
<text x="160" y="130" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#78716c">${nom} (photo simulée)</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
