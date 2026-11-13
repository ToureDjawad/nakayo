import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { lireContactSupport } from '../api/support.js'
import { Logo, Motif } from '../components/Logo.jsx'
import { lienWhatsapp } from '../lib/whatsapp.js'

// Page d'accueil, maquette D01 « Accueil (landing) ».
// Notes de conception : le titre dit le problème réel et la réponse chiffrée ; un seul bouton
// principal par écran, avec le prix ; aucun compteur de clients ni avis tant qu'il n'y a pas de
// vrais chiffres ; pas de promesse d'accord de Google.

const LIENS = [
  { ancre: 'fonctionnement', libelle: 'Comment ça marche' },
  { ancre: 'offres', libelle: 'Offres' },
  { ancre: 'garantie', libelle: 'Garantie' },
  { ancre: 'devenir-testeur', libelle: 'Devenir testeur' },
  { ancre: 'questions', libelle: 'FAQ' },
]

// Icônes au trait, 24 × 24.
const ICONES = {
  colis: (
    <>
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </>
  ),
  groupe: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  telephone: (
    <>
      <rect width="14" height="20" x="5" y="2" rx="2" />
      <path d="M12 18h.01" />
    </>
  ),
  document: (
    <>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </>
  ),
  horloge: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  reseau: (
    <>
      <path d="M12 20h.01" />
      <path d="M2 8.82a15 15 0 0 1 20 0" />
      <path d="M5 12.86a10 10 0 0 1 14 0" />
      <path d="M8.5 16.43a5 5 0 0 1 7 0" />
    </>
  ),
  bouclier: (
    <>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  cadenas: (
    <>
      <rect width="18" height="11" x="3" y="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  carte: (
    <>
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <path d="M2 10h20" />
    </>
  ),
  coche: <path d="M20 6 9 17l-5-5" />,
  bulle: <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />,
}

function Icone({ nom, className = 'size-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONES[nom]}
    </svg>
  )
}

function Surtitre({ children, clair = false }) {
  return <p className={`text-xs font-semibold tracking-[0.08em] uppercase ${clair ? 'text-ocre' : 'text-argile-fonce'}`}>{children}</p>
}

const ETAPES = [
  {
    icone: 'colis',
    titre: 'Vous décrivez l’app',
    texte: 'Nom, package, lien du test fermé, fonctionnalités à tester et identifiants de test si besoin.',
  },
  {
    icone: 'groupe',
    titre: 'Vous ajoutez un seul groupe',
    texte: 'Une adresse de Groupe Google à coller dans votre test fermé. Les remplacements se font sans vous.',
  },
  {
    icone: 'telephone',
    titre: 'Les testeurs testent',
    texte: 'Chaque jour : au moins 2 minutes dans l’app, un rapport court, des retours détaillés à J3, J7 et J12.',
  },
  {
    icone: 'document',
    titre: 'Vous demandez la production',
    texte: 'Rapport final et brouillon des 9 réponses du formulaire Google, avec les chiffres réels de la campagne.',
  },
]

const VERIFICATIONS = [
  { icone: 'horloge', titre: 'Au moins 2 minutes d’usage', detail: 'Mesuré par l’app compagnon, pas déclaré.' },
  { icone: 'document', titre: 'Un rapport du jour', detail: 'Fonctionnalités utilisées, note, bug éventuel, version testée.' },
  { icone: 'reseau', titre: 'Une connexion dans la journée', detail: 'Heure du serveur, pas celle du téléphone.' },
  { icone: 'bouclier', titre: 'Installation depuis le Play Store', detail: 'Pas d’APK, pas d’émulateur, pas de téléphone rooté.' },
]

// Offres du modèle économique (§3), toutes ouvertes. Lancement Afrique se commande sur devis (US-37).
const OFFRES = [
  {
    code: 'standard',
    nom: 'Standard',
    prix: '29 $',
    fcfa: '17 400 FCFA',
    cible: 'Tout ce qu’il faut pour passer le test fermé de Google.',
    inclus: [
      '15 testeurs vérifiés, 16 jours (14 + 2 de marge)',
      'Remplacement des testeurs inactifs',
      'Suivi quotidien et alertes',
      'Brouillon du formulaire Google et rapport PDF',
      'Nouvelle campagne offerte si refus pour engagement',
    ],
  },
  {
    code: 'pro',
    nom: 'Pro',
    prix: '59 $',
    fcfa: '35 400 FCFA',
    cible: 'Pour corriger avant la sortie, pas seulement passer la règle.',
    inclus: [
      'Tout Standard',
      'Rapports de bugs avec captures (étapes, gravité)',
      'Testeurs les mieux notés',
      'Au moins 5 téléphones d’entrée de gamme (3 Go de RAM ou moins)',
      'Export CSV des bugs',
    ],
    misEnAvant: true,
  },
  {
    code: 'afrique',
    nom: 'Lancement Afrique',
    prix: '99 $',
    aPartirDe: true,
    fcfa: '59 400 FCFA',
    cible: 'Pour les apps qui visent le marché africain.',
    inclus: [
      '20 testeurs, plusieurs villes et opérateurs',
      'Test terrain : réseau lent, petits téléphones',
      'Langues : français, fon, yoruba, anglais',
      'Scénarios sur mesure et devis validé',
      'Rapport sur la compréhension et l’usage réel',
    ],
    action: 'Demander un devis',
  },
]

const QUESTIONS = [
  {
    question: 'Mon compte est-il concerné ?',
    reponse:
      'Oui s’il s’agit d’un compte personnel créé après le 13 novembre 2023. Les comptes organisation ne le sont pas : le formulaire vous le signale.',
  },
  {
    question: 'Les testeurs laissent-ils des avis sur le Play Store ?',
    reponse:
      'Non. Les avis rémunérés sont interdits par Google : nos testeurs s’engagent à ne pas en laisser, et cette règle figure dans leurs conditions d’utilisation. Leurs retours vous arrivent uniquement par Nakayo.',
  },
  {
    question: 'Que se passe-t-il si un testeur abandonne ?',
    reponse:
      'Un jour manqué remet son compteur à zéro et nous prévient. Les 3 testeurs de réserve couvrent les abandons, et nous remplaçons les testeurs inactifs sans que vous ayez à toucher à votre test fermé.',
  },
  {
    question: 'Dois-je publier des mises à jour pendant le test ?',
    reponse:
      'C’est recommandé : Google regarde si l’app évolue pendant le test. Prévoyez au moins 2 nouvelles versions sur les 14 jours, en tenant compte des retours des testeurs.',
  },
  {
    question: 'Pouvez-vous garantir l’accord de Google ?',
    reponse:
      'Non, la décision appartient à Google. Notre garantie porte sur l’engagement des testeurs : si Google refuse pour un nombre de testeurs ou un engagement insuffisant, nous relançons une campagne sans frais, ou nous vous remboursons.',
  },
]

const classeBoutonPrincipal =
  'inline-flex h-12 items-center justify-center gap-2 rounded-champ bg-accent px-5 font-semibold whitespace-nowrap text-white transition-colors duration-150 hover:bg-accent-fonce'
const classeBoutonSecondaire =
  'inline-flex h-12 items-center justify-center gap-2 rounded-champ border border-trait bg-white px-5 font-semibold whitespace-nowrap text-encre transition-colors duration-150 hover:bg-fond-doux'

function Fleche() {
  return <span aria-hidden="true">→</span>
}

function Navigation() {
  return (
    <header className="border-b border-trait bg-papier">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Link to="/" aria-label="Nakayo, accueil">
          <Logo />
        </Link>
        <nav aria-label="Sections de la page" className="ml-auto hidden lg:block">
          <ul className="flex gap-6 text-sm text-texte">
            {LIENS.map((l) => (
              <li key={l.ancre}>
                <a href={`#${l.ancre}`} className="transition-colors duration-150 hover:text-encre">
                  {l.libelle}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-4 lg:ml-6">
          <Link to="/connexion" className="hidden text-sm font-medium whitespace-nowrap text-encre hover:underline sm:inline">
            Se connecter
          </Link>
          <Link
            to="/inscription"
            className="inline-flex h-10 items-center rounded-champ bg-accent px-4 text-sm font-semibold whitespace-nowrap text-white transition-colors duration-150 hover:bg-accent-fonce"
          >
            Soumettre mon app
          </Link>
        </div>
      </div>
    </header>
  )
}

function Offre({ offre }) {
  const fonce = offre.misEnAvant
  return (
    <li
      aria-labelledby={`offre-${offre.code}`}
      className={`flex flex-col rounded-carte border p-6 ${fonce ? 'border-accent-fonce bg-accent-fonce text-white' : 'border-trait bg-white'}`}
    >
      <h3 id={`offre-${offre.code}`} className={`text-lg font-semibold ${fonce ? 'text-white' : 'text-encre'}`}>
        {offre.nom}
      </h3>
      <p className={`mt-4 font-titre text-4xl font-semibold ${fonce ? 'text-white' : 'text-encre'}`}>
        {offre.aPartirDe && 'dès '}
        {offre.prix} <span className={`font-sans text-sm font-normal ${fonce ? 'text-sur-fonce' : 'text-discret'}`}>par app</span>
      </p>
      <p className={`mt-1 text-sm ${fonce ? 'text-sur-fonce' : 'text-discret'}`}>ou {offre.fcfa} par Mobile Money</p>
      <p className={`mt-4 text-sm ${fonce ? 'text-sur-fonce' : 'text-texte'}`}>{offre.cible}</p>
      <ul className={`mt-5 flex-1 space-y-3 border-t pt-5 ${fonce ? 'border-white/20' : 'border-trait'}`}>
        {offre.inclus.map((element) => (
          <li key={element} className={`flex gap-2.5 text-sm ${fonce ? 'text-white' : 'text-texte'}`}>
            <Icone nom="coche" className={`mt-0.5 size-4 ${fonce ? 'text-ocre' : 'text-accent'}`} />
            {element}
          </li>
        ))}
      </ul>
      <Link to="/inscription" className={`mt-6 ${classeBoutonSecondaire}`}>
        {offre.action ?? `Choisir ${offre.nom}`}
      </Link>
    </li>
  )
}

// Bouton WhatsApp de l'appel final, seulement si l'équipe a publié un numéro (§11).
function BoutonWhatsapp() {
  const [numero, setNumero] = useState(null)

  useEffect(() => {
    const controleur = new AbortController()
    lireContactSupport({ signal: controleur.signal })
      .then((r) => setNumero(r?.support?.whatsapp ?? null))
      .catch(() => {})
    return () => controleur.abort()
  }, [])

  if (!numero) return null
  return (
    <a href={lienWhatsapp(numero, 'Bonjour, j’ai une question sur Nakayo :')} target="_blank" rel="noopener noreferrer" className={classeBoutonSecondaire}>
      <Icone nom="bulle" className="size-[18px]" />
      Parler à l’équipe sur WhatsApp
      <span className="sr-only">(nouvel onglet)</span>
    </a>
  )
}

function PiedDePage() {
  const colonnes = [
    {
      titre: 'Produit',
      liens: LIENS.filter((l) => l.ancre !== 'devenir-testeur').map((l) => ({ href: `#${l.ancre}`, libelle: l.libelle })),
    },
    { titre: 'Testeurs', liens: [{ href: '#devenir-testeur', libelle: 'Devenir testeur' }] },
    {
      titre: 'Légal',
      liens: [
        { to: '/conditions-utilisation', libelle: 'Conditions générales (CGU)' },
        { to: '/confidentialite', libelle: 'Politique de confidentialité' },
        { to: '/mentions-legales', libelle: 'Mentions légales' },
        { to: '/mon-compte/support', libelle: 'Contact' },
      ],
    },
  ]
  return (
    <footer className="bg-encre text-sur-fonce">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <Logo clair />
          <p className="mt-4 max-w-xs text-sm">Nakayo veut dire « bienvenue » en dendi. Plateforme de test d’apps Android, testeurs au Bénin.</p>
          <p className="mt-3 text-xs">© 2026 Nakayo</p>
        </div>
        {colonnes.map((c) => (
          <nav key={c.titre} aria-label={c.titre === 'Légal' ? 'Informations légales' : c.titre}>
            <p className="text-sm font-semibold text-white">{c.titre}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {c.liens.map((l) => (
                <li key={l.libelle}>
                  {l.to ? (
                    <Link to={l.to} className="transition-colors duration-150 hover:text-white">
                      {l.libelle}
                    </Link>
                  ) : (
                    <a href={l.href} className="transition-colors duration-150 hover:text-white">
                      {l.libelle}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
    </footer>
  )
}

export default function Accueil() {
  return (
    <div className="min-h-screen bg-papier">
      <Navigation />
      <main>
        <section className="mx-auto max-w-6xl px-4 pt-14 pb-16 sm:pt-20 sm:pb-20">
          <h1 className="text-4xl text-encre sm:text-6xl">12 testeurs pendant 14 jours : on s’en occupe.</h1>
          <p className="mt-6 max-w-5xl text-lg text-texte">
            Google exige que votre app soit testée par au moins 12 personnes, sans interruption, pendant 14 jours avant d’ouvrir la
            production. Nakayo vous fournit 15 testeurs vérifiés au Bénin, suit leur activité chaque jour et vous rend un brouillon de
            réponses pour le formulaire de Google.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/inscription" className={classeBoutonPrincipal}>
              Soumettre mon app · 29 $ <Fleche />
            </Link>
            <a href="#fonctionnement" className={classeBoutonSecondaire}>
              Voir comment ça marche
            </a>
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-texte">
            <li className="flex items-center gap-2">
              <Icone nom="bouclier" className="size-4 text-accent" />
              Nouvelle campagne offerte si Google refuse
            </li>
            <li className="flex items-center gap-2">
              <Icone nom="carte" className="size-4 text-accent" />
              Carte ou Mobile Money
            </li>
          </ul>
        </section>

        <section aria-labelledby="regle-google" className="bg-accent-fonce text-white">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div className="sm:col-span-3 md:col-span-1">
              <h2 id="regle-google" className="font-sans text-xs font-semibold tracking-[0.08em] text-ocre uppercase">
                La règle, en clair
              </h2>
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

        <section id="fonctionnement" aria-labelledby="titre-fonctionnement" className="scroll-mt-4">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
            <Surtitre>Comment ça marche</Surtitre>
            <h2 id="titre-fonctionnement" className="mt-2 max-w-2xl text-3xl text-encre sm:text-4xl">
              Quatre étapes, et vous gardez la main sur la Play Console
            </h2>
            <ol className="mt-10 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {ETAPES.map((etape, i) => (
                <li key={etape.titre} className="rounded-carte border border-trait bg-white p-5">
                  <div className="flex items-start justify-between">
                    <span className="font-accent text-4xl leading-none text-argile italic" aria-hidden="true">
                      {i + 1}
                    </span>
                    <span className="grid size-8 place-items-center rounded-md bg-accent-clair text-accent">
                      <Icone nom={etape.icone} className="size-[18px]" />
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-encre">
                    <span className="sr-only">Étape {i + 1} : </span>
                    {etape.titre}
                  </h3>
                  <p className="mt-2 text-sm text-texte">{etape.texte}</p>
                </li>
              ))}
            </ol>
            <p className="mt-8 inline-flex items-start gap-2 rounded-champ bg-ocre-clair px-4 py-3 text-sm text-alerte">
              <Icone nom="cadenas" className="mt-0.5 size-4" />
              Nakayo ne vous demande jamais l’accès à votre Play Console ni à vos clés de signature.
            </p>
          </div>
        </section>

        <section aria-labelledby="titre-verifications" className="bg-sable">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:py-20 lg:grid-cols-2">
            <div>
              <Surtitre>Chaque jour, chaque testeur</Surtitre>
              <h2 id="titre-verifications" className="mt-2 text-3xl text-encre sm:text-4xl">
                Un jour ne compte que s’il est vraiment fait
              </h2>
              <p className="mt-4 text-texte">
                Notre app compagnon mesure le temps passé dans votre app (avec l’accord du testeur) et vérifie qu’elle vient bien du Play
                Store. Un jour manqué remet le compteur du testeur à zéro, et nous le remplaçons si besoin.
              </p>
            </div>
            <ul className="space-y-3">
              {VERIFICATIONS.map((v) => (
                <li key={v.titre} className="flex items-center gap-4 rounded-carte border border-trait bg-white px-4 py-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-md bg-accent-clair text-accent">
                    <Icone nom={v.icone} className="size-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-encre">{v.titre}</p>
                    <p className="text-sm text-texte">{v.detail}</p>
                  </div>
                  <Icone nom="coche" className="size-4 text-accent" />
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="offres" aria-labelledby="titre-offres" className="scroll-mt-4">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
            <Surtitre>Offres</Surtitre>
            <h2 id="titre-offres" className="mt-2 text-3xl text-encre sm:text-4xl">
              Un prix par app, payé une fois
            </h2>
            <p className="mt-3 text-texte">Carte bancaire en dollars ou en euros, ou Mobile Money en FCFA.</p>
            <ul className="mt-10 grid gap-4 lg:grid-cols-3">
              {OFFRES.map((offre) => (
                <Offre key={offre.code} offre={offre} />
              ))}
            </ul>
          </div>
        </section>

        <section aria-label="Garantie et testeurs" className="mx-auto grid max-w-6xl items-start gap-5 px-4 pb-16 sm:pb-20 lg:grid-cols-2">
          <div id="garantie" className="scroll-mt-4 rounded-carte bg-argile-clair p-6 sm:p-8">
            <Icone nom="bouclier" className="size-6 text-argile" />
            <h2 className="mt-4 text-2xl text-encre sm:text-3xl">Si Google refuse, on recommence</h2>
            <p className="mt-3 text-texte">
              Refus pour engagement ou nombre de testeurs insuffisant ? Envoyez-nous l’email de Google dans les 7 jours : nous relançons une
              campagne sans frais, ou nous vous remboursons. Condition : la liste de vérification avant lancement était entièrement cochée.
            </p>
            <Link to="/conditions-utilisation" className="mt-4 inline-block font-semibold text-argile-fonce underline-offset-2 hover:underline">
              Lire les conditions de la garantie
            </Link>
          </div>
          <div id="devenir-testeur" className="scroll-mt-4 flex flex-col overflow-hidden rounded-carte bg-accent-fonce text-white">
            <div className="p-6 sm:p-8">
              <Icone nom="groupe" className="size-6 text-ocre" />
              <h2 className="mt-4 text-2xl text-white sm:text-3xl">Vous êtes au Bénin ? Devenez testeur</h2>
              <p className="mt-3 text-sur-fonce">
                Testez des apps sur votre téléphone quelques minutes par jour et recevez 500 FCFA par app sur votre compte MTN MoMo ou Moov
                Money à la fin de chaque campagne.
              </p>
              <p className="mt-5 inline-flex items-center gap-2 rounded-champ bg-argile-fonce px-4 py-2.5 text-sm font-semibold text-white">
                <Icone nom="telephone" className="size-4" />
                L’app testeur arrive bientôt sur Google Play
              </p>
            </div>
            <Motif className="mt-auto" />
          </div>
        </section>

        <section id="questions" aria-labelledby="titre-questions" className="scroll-mt-4 bg-sable">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:py-20 lg:grid-cols-[1fr_2fr]">
            <div>
              <Surtitre>Questions fréquentes</Surtitre>
              <h2 id="titre-questions" className="mt-2 text-3xl text-encre sm:text-4xl">
                Ce qu’on nous demande avant de payer
              </h2>
            </div>
            <div className="divide-y divide-trait border-b border-trait">
              {QUESTIONS.map(({ question, reponse }, i) => (
                <details key={question} className="group py-4" open={i === 0}>
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-lg font-medium text-encre [&::-webkit-details-marker]:hidden">
                    {question}
                    <span className="mt-0.5 text-2xl leading-none text-texte transition-transform duration-150 group-open:rotate-45" aria-hidden="true">
                      +
                    </span>
                  </summary>
                  <p className="mt-2 text-texte">{reponse}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="titre-appel" className="px-4 py-16 text-center sm:py-24">
          <h2 id="titre-appel" className="text-3xl text-encre sm:text-5xl">
            Votre app mérite d’arriver en production.
          </h2>
          <p className="mt-3 font-accent text-3xl text-argile italic sm:text-4xl">On s’occupe des 14 jours.</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/inscription" className={classeBoutonPrincipal}>
              Soumettre mon app <Fleche />
            </Link>
            <BoutonWhatsapp />
          </div>
        </section>
      </main>
      <PiedDePage />
    </div>
  )
}
