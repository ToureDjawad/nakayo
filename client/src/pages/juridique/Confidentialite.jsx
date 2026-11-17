import { Link } from 'react-router'
import { DocumentJuridique } from './DocumentJuridique.jsx'

// US-04 : politique de confidentialité. Elle décrit ce que la plateforme collecte réellement,
// notamment le suivi du temps d'utilisation et de la position par l'app Android.
const SECTIONS = [
  {
    id: 'responsable',
    titre: 'Qui est responsable de vos données',
    blocs: [
      'Nakayo est responsable des données collectées sur le site et dans l’app Nakayo. Pour toute question ou demande, écrivez au support depuis votre espace.',
    ],
  },
  {
    id: 'developpeurs',
    titre: 'Données des développeurs',
    blocs: [
      {
        liste: [
          'Compte : nom ou nom du studio, email, pays, lien de la fiche développeur Google Play.',
          'Apps : nom, nom du package, lien du test fermé et informations de lancement.',
          'Paiements : montant, moyen de paiement, numéro Mobile Money s’il sert à payer, factures. Le numéro de carte est saisi chez notre prestataire de paiement : Nakayo ne le voit jamais.',
        ],
      },
    ],
  },
  {
    id: 'testeurs',
    titre: 'Données des testeurs',
    blocs: [
      {
        liste: [
          'Compte : nom, numéro de téléphone, ville, adresse Gmail, numéro et opérateur Mobile Money.',
          'Vérification d’identité : photo d’une pièce d’identité et selfie. Ces photos ne sont vues que par l’équipe de vérification.',
          'Téléphone : fabricant, modèle, version d’Android, mémoire, et des indices simples d’émulateur ou de téléphone modifié.',
          'Campagnes : rapports quotidiens, captures d’écran des bugs signalés, réponses aux questionnaires.',
        ],
      },
    ],
  },
  {
    id: 'suivi',
    titre: 'Temps d’utilisation et position',
    blocs: [
      'Ces deux mesures servent à prouver au développeur, et à Google, que le test a vraiment eu lieu. Vous y consentez à l’inscription, et Android vous demande aussi votre accord.',
      {
        liste: [
          'Temps d’utilisation : grâce à l’accès aux statistiques d’usage d’Android, l’app mesure le temps passé dans les apps que vous testez, et seulement celles-là. Rien n’est collecté sur vos autres apps.',
          'Position : une position approximative, arrondie à environ un kilomètre, est demandée au moment où vous envoyez un rapport, l’app ouverte. Elle n’est jamais suivie en arrière-plan.',
          'Réseau : pour repérer plusieurs comptes sur le même réseau, nous gardons une empreinte chiffrée de l’adresse du réseau Wi-Fi, jamais l’adresse elle-même.',
        ],
      },
      'Vous pouvez retirer ces autorisations dans les réglages d’Android. Sans elles, les jours de test ne peuvent plus être comptés.',
    ],
  },
  {
    id: 'usages',
    titre: 'À quoi servent vos données',
    blocs: [
      {
        liste: [
          'vérifier les comptes et lutter contre la fraude ;',
          'organiser les campagnes, envoyer les rappels et les rapports ;',
          'payer les testeurs et facturer les développeurs ;',
          'répondre au support et respecter nos obligations légales et comptables.',
        ],
      },
      'Nous ne vendons pas vos données et ne les utilisons pas pour de la publicité.',
    ],
  },
  {
    id: 'partage',
    titre: 'Avec qui elles sont partagées',
    blocs: [
      {
        liste: [
          'Le développeur d’une app que vous testez reçoit votre adresse Gmail, pour vous ajouter à son test fermé sur Google Play, ainsi que vos rapports et vos bugs signalés. Il ne reçoit ni votre téléphone, ni votre pièce d’identité, ni votre position précise.',
          'Notre prestataire de paiement (FedaPay) traite les paiements et les versements Mobile Money.',
          'Nos prestataires d’envoi d’emails et de SMS reçoivent l’adresse ou le numéro à qui écrire.',
          'Google reçoit votre adresse Gmail quand vous êtes ajouté au groupe de test d’une app.',
        ],
      },
    ],
  },
  {
    id: 'conservation',
    titre: 'Combien de temps nous les gardons',
    blocs: [
      'Vos données sont gardées tant que votre compte est actif. Quand vous demandez la suppression de votre compte, nous supprimons vos photos d’identité et vos données de compte, sauf ce que la loi nous oblige à garder : les factures et les traces de paiement sont conservées 10 ans.',
    ],
  },
  {
    id: 'droits',
    titre: 'Vos droits',
    blocs: [
      'Vous pouvez demander l’accès à vos données, leur correction ou leur suppression, et vous opposer à un traitement, en écrivant au support. Nous répondons sous 30 jours.',
      'Si notre réponse ne vous satisfait pas, vous pouvez saisir l’Autorité de protection des données à caractère personnel (APDP) du Bénin.',
    ],
  },
  {
    id: 'securite',
    titre: 'Sécurité',
    blocs: [
      'Les échanges avec Nakayo sont chiffrés. Les mots de passe ne sont jamais stockés en clair, et les photos d’identité ne sont accessibles qu’à l’équipe, sans cache.',
    ],
  },
]

// /confidentialite
export default function Confidentialite() {
  return (
    <DocumentJuridique
      titre="Politique de confidentialité"
      version="17 novembre 2026"
      sections={SECTIONS}
      intro={
        <p>
          Cette politique explique quelles données Nakayo collecte, pourquoi, et comment exercer vos droits. Elle complète les{' '}
          <Link to="/conditions-utilisation" className="font-medium text-accent underline underline-offset-2">
            conditions générales d’utilisation
          </Link>
          .
        </p>
      }
    />
  )
}
