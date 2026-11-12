import { Link } from 'react-router'
import { EnTete } from '../components/MiseEnPage.jsx'

const ETAPES = [
  {
    titre: 'Créez votre compte',
    texte: 'Indiquez votre nom de développeur et le lien de votre fiche Google Play. Notre équipe vérifie votre compte sous 24 h ouvrées.',
  },
  {
    titre: 'Soumettez votre app',
    texte: 'Package, lien du test fermé, description, instructions et fonctionnalités à tester. Vous payez l’offre Standard, puis nous vérifions l’app.',
  },
  {
    titre: 'Préparez le test fermé',
    texte: 'Une liste de vérification évite les erreurs qui font perdre 14 jours. Vous ajoutez l’adresse de notre groupe de testeurs une seule fois.',
  },
  {
    titre: '14 jours suivis chaque jour',
    texte: '15 testeurs vérifiés au Bénin utilisent votre app tous les jours. À la fin, vous recevez un brouillon de réponses pour le formulaire de Google.',
  },
]

// Offres du modèle économique (§3). Seule la Standard est ouverte ; Pro et Lancement Afrique
// arrivent ensuite (phase 4 du plan de lancement).
const OFFRES = [
  {
    code: 'standard',
    nom: 'Standard',
    prix: '29 $',
    fcfa: '17 400 FCFA',
    cible: 'Pour les développeurs indépendants du monde entier.',
    inclus: [
      '15 testeurs : les 12 exigés et 3 de réserve',
      '14 jours garantis, abandons remplacés',
      'Suivi quotidien visible et rapport court chaque jour',
      'Modèle de réponse pour le formulaire de Google',
      'Nouvelle campagne offerte si Google refuse',
    ],
    disponible: true,
  },
  {
    code: 'pro',
    nom: 'Pro',
    prix: '59 $',
    fcfa: '35 400 FCFA',
    cible: 'Pour les développeurs et petites équipes qui veulent un vrai retour.',
    inclus: [
      'Tout ce que contient l’offre Standard',
      'Rapports de bugs détaillés, avec captures',
      'Tests sur téléphones d’entrée de gamme',
      'Aide personnalisée pour le formulaire de Google',
    ],
  },
  {
    code: 'afrique',
    nom: 'Lancement Afrique',
    prix: '99 $',
    aPartirDe: true,
    fcfa: '59 400 FCFA',
    cible: 'Pour les startups et entreprises qui visent l’Afrique de l’Ouest.',
    inclus: [
      '20 testeurs choisis selon votre public',
      '14 jours, ou une durée sur mesure',
      'Test en conditions réelles : réseau lent, petits téléphones, langue, Mobile Money',
      'Rapport de synthèse et aide personnalisée',
    ],
  },
]

const QUESTIONS = [
  {
    question: 'Mon compte développeur est-il concerné par la règle des 12 testeurs ?',
    reponse:
      'La règle vise les comptes développeur personnels créés après le 13 novembre 2023. Un compte organisation, ou un compte personnel plus ancien, n’y est pas soumis : nous vous le signalons dès la soumission de votre app.',
  },
  {
    question: 'Qui sont les testeurs ?',
    reponse:
      'Des personnes vivant au Bénin, inscrites sur l’app Nakayo avec un compte Google vérifié. Chaque jour, nous contrôlons qu’elles ouvrent et utilisent votre app.',
  },
  {
    question: 'Comment payer ?',
    reponse: 'Par carte bancaire (29 $) ou par Mobile Money (17 400 FCFA). La facture est disponible dans votre espace dès que le paiement est confirmé.',
  },
  {
    question: 'Que se passe-t-il si Google refuse l’accès à la production ?',
    reponse:
      'Si le refus vient d’un manque d’engagement des testeurs, nous relançons une nouvelle campagne sans frais. Si nous refusons votre app avant le lancement, vous êtes remboursé.',
  },
  {
    question: 'Quelles apps sont refusées ?',
    reponse:
      'Les apps frauduleuses, interdites par les règles de Google Play, ou dont le lien de test fermé ne fonctionne pas. Chaque app est vérifiée par notre équipe avant le lancement de la campagne.',
  },
]

function Coche() {
  return (
    <svg viewBox="0 0 20 20" className="mt-0.5 size-5 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 10.5 3 3 7-7" />
    </svg>
  )
}

// Page d'accueil (D01) : la promesse, la règle de Google, le fonctionnement, l'offre et la FAQ.
export default function Accueil() {
  return (
    <div className="min-h-screen bg-papier">
      <EnTete
        actions={
          <>
            <Link to="/connexion" className="hidden h-10 items-center rounded-champ border whitespace-nowrap sm:inline-flex border-trait bg-white px-4 text-sm font-semibold text-encre hover:bg-fond-doux">
              Se connecter
            </Link>
            <Link to="/inscription" className="inline-flex h-10 items-center rounded-champ bg-accent px-4 whitespace-nowrap text-sm font-semibold text-white hover:bg-accent-fonce">
              Soumettre mon app
            </Link>
          </>
        }
      />
      <main>
        <section className="mx-auto max-w-6xl px-4 pt-14 pb-16 sm:pt-20">
          <h1 className="max-w-4xl text-4xl text-encre sm:text-6xl">12 testeurs pendant 14 jours : on s’en occupe.</h1>
          <p className="mt-6 max-w-3xl text-lg text-texte">
            Google exige que votre app soit testée par au moins 12 personnes, sans interruption, pendant 14 jours avant d’ouvrir la
            production. Nakayo vous fournit des testeurs vérifiés au Bénin, suit leur activité chaque jour et vous rend un brouillon de
            réponses pour le formulaire de Google.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/inscription" className="inline-flex h-12 items-center justify-center gap-2 rounded-champ bg-accent px-5 font-semibold text-white hover:bg-accent-fonce">
              Créer un compte développeur <span aria-hidden="true">→</span>
            </Link>
            <Link to="/connexion" className="inline-flex h-12 items-center justify-center rounded-champ border border-trait bg-white px-5 font-semibold text-encre hover:bg-fond-doux">
              Se connecter
            </Link>
          </div>
        </section>

        <section aria-labelledby="regle-google" className="bg-accent-fonce text-white">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div>
              <p id="regle-google" className="text-xs font-semibold tracking-[0.07em] text-ocre uppercase">
                La règle, en clair
              </p>
              <p className="mt-2 text-sur-fonce">Concerne les comptes développeur personnels créés après le 13 novembre 2023.</p>
            </div>
            {[
              ['12', 'testeurs inscrits au test fermé'],
              ['14', 'jours d’affilée, sans désinscription'],
              ['3', 'parties dans le formulaire d’accès à la production'],
            ].map(([chiffre, texte]) => (
              <div key={chiffre}>
                <p className="font-titre text-5xl font-semibold text-ocre">{chiffre}</p>
                <p className="mt-2 text-sm text-sur-fonce">{texte}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="fonctionnement" className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <h2 id="fonctionnement" className="text-3xl text-encre sm:text-4xl">
            Comment ça marche
          </h2>
          <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {ETAPES.map((etape, i) => (
              <li key={etape.titre} className="rounded-carte border border-trait bg-white p-6">
                <span className="flex size-9 items-center justify-center rounded-full bg-accent-clair font-titre font-semibold text-accent" aria-hidden="true">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-lg font-semibold text-encre">{etape.titre}</h3>
                <p className="mt-2 text-sm text-texte">{etape.texte}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="offre" className="bg-sable">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
            <h2 id="offre" className="text-3xl text-encre sm:text-4xl">
              Nos offres
            </h2>
            <p className="mt-4 max-w-3xl text-lg text-texte">
              Pas d’abonnement : vous payez une fois par app, par carte bancaire ou par Mobile Money en FCFA. Si Google refuse l’accès à la
              production, nous relançons une nouvelle campagne sans frais.
            </p>
            <ul className="mt-10 grid gap-6 lg:grid-cols-3">
              {OFFRES.map((offre) => (
                <li
                  key={offre.code}
                  aria-labelledby={`offre-${offre.code}`}
                  className={`flex flex-col rounded-carte border bg-white p-6 sm:p-8 ${offre.disponible ? 'border-accent ring-1 ring-accent' : 'border-trait'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 id={`offre-${offre.code}`} className="text-xl font-semibold text-encre">
                      {offre.nom}
                    </h3>
                    {!offre.disponible && (
                      <span className="rounded-full bg-fond-doux px-3 py-1 text-xs font-semibold whitespace-nowrap text-alerte">Bientôt disponible</span>
                    )}
                  </div>
                  <p className="mt-4 font-titre text-4xl font-semibold text-encre">
                    {offre.aPartirDe && <span className="font-sans text-base font-normal text-discret">à partir de </span>}
                    {offre.prix}
                  </p>
                  <p className="mt-1 text-sm text-discret">
                    ou {offre.fcfa} par Mobile Money
                  </p>
                  <p className="mt-4 text-sm text-texte">{offre.cible}</p>
                  <ul className="mt-6 flex-1 space-y-3">
                    {offre.inclus.map((element) => (
                      <li key={element} className="flex gap-3 text-sm text-texte">
                        <Coche />
                        {element}
                      </li>
                    ))}
                  </ul>
                  {offre.disponible && (
                    <Link
                      to="/inscription"
                      className="mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-champ bg-accent px-5 font-semibold text-white hover:bg-accent-fonce"
                    >
                      Commencer <span aria-hidden="true">→</span>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="questions" className="mx-auto max-w-3xl px-4 py-16 sm:py-20">
          <h2 id="questions" className="text-3xl text-encre sm:text-4xl">
            Questions fréquentes
          </h2>
          <div className="mt-8 divide-y divide-trait border-y border-trait">
            {QUESTIONS.map(({ question, reponse }) => (
              <details key={question} className="group py-5">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-semibold text-encre [&::-webkit-details-marker]:hidden">
                  {question}
                  <span className="mt-0.5 text-xl leading-none text-discret transition-transform group-open:rotate-45" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-texte">{reponse}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="bg-accent-fonce text-white">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-14 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-xl font-titre text-2xl font-semibold sm:text-3xl">Prêt à lancer votre test fermé ?</p>
            <Link to="/inscription" className="inline-flex h-12 items-center justify-center gap-2 rounded-champ bg-ocre px-5 font-semibold text-encre hover:bg-ocre-clair">
              Créer mon compte <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-trait">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-discret sm:flex-row sm:items-center sm:justify-between">
          <p>© Nakayo. Testeurs vérifiés au Bénin.</p>
          <nav aria-label="Informations légales" className="flex gap-5">
            <Link to="/conditions-utilisation" className="hover:text-encre hover:underline">
              Conditions d’utilisation
            </Link>
            <Link to="/confidentialite" className="hover:text-encre hover:underline">
              Politique de confidentialité
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
