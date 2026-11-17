import { Link } from 'react-router'
import { DocumentJuridique } from './DocumentJuridique.jsx'

// US-04 : conditions générales d'utilisation, pour les développeurs et pour les testeurs.
const SECTIONS = [
  {
    id: 'objet',
    titre: 'Ce que propose Nakayo',
    blocs: [
      'Nakayo met en relation des développeurs d’apps Android et des testeurs vérifiés en Afrique de l’Ouest. Google demande aux nouveaux comptes développeur personnels qu’une app soit testée par au moins 12 testeurs pendant 14 jours avant d’ouvrir la production. Nakayo organise ce test fermé : recrutement et vérification des testeurs, suivi quotidien, rapports et rémunération des testeurs par Mobile Money.',
      'Ces conditions s’appliquent à toute personne qui crée un compte, sur le site ou dans l’app Nakayo. En cochant la case prévue à l’inscription, vous les acceptez.',
    ],
  },
  {
    id: 'comptes',
    titre: 'Comptes et vérification',
    blocs: [
      {
        liste: [
          'Un compte par personne. Les informations données à l’inscription doivent être exactes et à jour.',
          'Chaque compte est vérifié par notre équipe avant d’être utilisé. Nous pouvons refuser un compte en indiquant le motif.',
          'Vous êtes responsable de la confidentialité de votre mot de passe et de votre téléphone.',
        ],
      },
    ],
  },
  {
    id: 'developpeurs',
    titre: 'Conditions propres aux développeurs',
    blocs: [
      'Nakayo ne demande jamais l’accès à votre Play Console ni à vos clés de signature. Vous gardez seul le contrôle de votre app et de votre compte Google Play : c’est vous qui ajoutez les testeurs à votre test fermé.',
      'Nakayo ne peut pas garantir la décision de Google. L’accès à la production dépend de Google seul, qui peut tenir compte d’autres critères que le nombre de testeurs.',
      {
        liste: [
          'Le prix de chaque offre est affiché avant le paiement. L’offre est payée avant le lancement de la campagne.',
          'Chaque app est vérifiée par notre équipe avant le lancement. Une app refusée est remboursée, ou sa campagne est rendue à l’abonnement.',
          'Si Google refuse l’accès à la production à cause d’un manque d’engagement des testeurs, vous pouvez demander une nouvelle campagne offerte dans les 7 jours qui suivent la fin du test.',
          'L’abonnement mensuel se renouvelle à votre initiative. Après l’échéance, vous avez 3 jours pour le renouveler ; ensuite, il est suspendu. Les campagnes déjà lancées continuent.',
          'Votre app ne doit pas être illégale, trompeuse ou dangereuse pour les testeurs. Nous pouvons refuser une app qui ne respecte pas les règles de Google Play.',
          'Vous ne demandez pas aux testeurs de noter ou de commenter votre app sur Google Play.',
        ],
      },
    ],
  },
  {
    id: 'testeurs',
    titre: 'Conditions propres aux testeurs',
    blocs: [
      'En participant à une campagne, vous vous engagez à :',
      {
        liste: [
          'installer l’app depuis le lien du test fermé et l’utiliser chaque jour pendant les 14 jours de la campagne ;',
          'envoyer chaque jour un rapport court et sincère, écrit par vous ;',
          'ne publier aucune note ni aucun avis public sur l’app testée : Google interdit les avis rémunérés ;',
          'ne pas vous désinscrire du test fermé avant la clôture de la campagne ;',
          'utiliser votre propre téléphone, sans émulateur ni appareil modifié, et votre propre compte Gmail ;',
          'garder pour vous ce que vous découvrez des apps testées, qui ne sont pas encore publiques.',
        ],
      },
      'Rémunération : chaque testeur qui va au bout de ses 14 jours est payé par Mobile Money à la clôture de la campagne, selon l’offre de l’app (500 FCFA en Offre Standard). Un bug accepté par le développeur rapporte 200 FCFA de plus. Le montant est indiqué dans l’app avant que vous acceptiez une campagne.',
    ],
  },
  {
    id: 'sanctions',
    titre: 'Fraude et sanctions',
    blocs: [
      'Nous contrôlons la cohérence des rapports et de l’utilisation des apps pour protéger les développeurs. En cas de manquement à ces conditions (faux rapports, plusieurs comptes, avis public, désinscription, téléphone partagé ou modifié), nous pouvons suspendre ou bannir un compte. Les gains d’un compte suspendu ou banni sont retenus : ils ne sont versés que si le compte est réactivé.',
      'Chaque décision est motivée et vous pouvez la contester en écrivant au support.',
    ],
  },
  {
    id: 'responsabilite',
    titre: 'Responsabilité',
    blocs: [
      'Nakayo fait ses meilleurs efforts pour fournir des testeurs actifs et un service disponible, sans pouvoir garantir une disponibilité sans interruption. Notre responsabilité envers un développeur est limitée au montant payé pour la campagne concernée.',
      'Les paiements sont traités par notre prestataire de paiement. Nakayo ne voit jamais votre numéro de carte.',
    ],
  },
  {
    id: 'donnees',
    titre: 'Données personnelles',
    blocs: ['Les données que nous collectons et vos droits sont décrits dans la politique de confidentialité.'],
  },
  {
    id: 'modifications',
    titre: 'Modification et droit applicable',
    blocs: [
      'Nous pouvons modifier ces conditions. Toute modification importante vous est annoncée par email ou dans l’app au moins 15 jours avant d’entrer en vigueur.',
      'Ces conditions sont soumises au droit béninois. En cas de désaccord, nous cherchons d’abord une solution amiable avec vous.',
    ],
  },
]

// /conditions-utilisation
export default function ConditionsUtilisation() {
  return (
    <DocumentJuridique
      titre="Conditions générales d’utilisation"
      version="17 novembre 2026"
      sections={SECTIONS}
      intro={
        <p>
          Ces conditions encadrent l’utilisation de Nakayo par les développeurs et par les testeurs. Lisez aussi notre{' '}
          <Link to="/confidentialite" className="font-medium text-accent underline underline-offset-2">
            politique de confidentialité
          </Link>
          .
        </p>
      }
    />
  )
}
