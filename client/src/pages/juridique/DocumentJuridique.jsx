import { Link } from 'react-router'
import { PageCompte } from '../../components/MiseEnPage.jsx'

// Mise en page commune des textes juridiques (US-04) : sommaire, puis sections numérotées.
// Une section a un `titre` et des `blocs` : texte (chaîne) ou liste ({ liste: [...] }).
export function DocumentJuridique({ titre, version, intro, sections }) {
  return (
    <PageCompte titre={titre} panneau={null} intro={<p className="text-sm text-discret">Version du {version}</p>}>
      <div className="space-y-4 text-texte">{intro}</div>
      <nav aria-label="Sommaire" className="mt-8 rounded-carte border border-trait bg-white p-4">
        <p className="font-semibold text-encre">Sommaire</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-accent underline underline-offset-2">
                {s.titre}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      {sections.map((s, i) => (
        <section key={s.id} id={s.id} aria-labelledby={`titre-${s.id}`} className="mt-10 scroll-mt-6">
          <h2 id={`titre-${s.id}`} className="text-xl font-semibold text-encre">
            {i + 1}. {s.titre}
          </h2>
          <div className="mt-3 space-y-3 text-texte">
            {s.blocs.map((b, j) =>
              typeof b === 'string' ? (
                <p key={j}>{b}</p>
              ) : (
                <ul key={j} className="list-disc space-y-1.5 pl-5">
                  {b.liste.map((element) => (
                    <li key={element}>{element}</li>
                  ))}
                </ul>
              ),
            )}
          </div>
        </section>
      ))}
      <p className="mt-12 text-sm text-texte">
        Une question sur ce document ?{' '}
        <Link to="/mon-compte/support" className="font-medium text-accent underline underline-offset-2">
          Écrivez au support
        </Link>
        .
      </p>
    </PageCompte>
  )
}
