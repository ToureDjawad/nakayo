// Résultats des contrôles automatiques (US-07). Libellés et détails viennent de l'API.
const RESULTATS = {
  echec: { libelle: 'Échec', classe: 'text-erreur', ordre: 0 },
  alerte: { libelle: 'À vérifier', classe: 'text-alerte', ordre: 1 },
  indisponible: { libelle: 'Non vérifié', classe: 'text-discret', ordre: 2 },
  ok: { libelle: 'Conforme', classe: 'text-succes', ordre: 3 },
}

// Une forme différente par résultat, pour ne pas dépendre de la couleur seule.
function Icone({ resultat }) {
  const commun = { className: 'mt-0.5 size-4 shrink-0', viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true }
  const trait = { stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (resultat === 'ok') return <svg {...commun}><path d="M3 8.5l3 3 7-7" {...trait} /></svg>
  if (resultat === 'echec') return <svg {...commun}><path d="M4 4l8 8M12 4l-8 8" {...trait} /></svg>
  if (resultat === 'alerte') return <svg {...commun}><path d="M8 2.5l6 11H2l6-11z M8 7v2.5 M8 11.5v.01" {...trait} /></svg>
  return <svg {...commun}><path d="M4 8h8" {...trait} /></svg>
}

export function Controles({ controles, idTitre }) {
  const liste = [...(controles?.liste ?? [])].sort(
    (a, b) => (RESULTATS[a.resultat]?.ordre ?? 9) - (RESULTATS[b.resultat]?.ordre ?? 9),
  )

  return (
    <section aria-labelledby={idTitre}>
      <h4 id={idTitre} className="text-sm font-semibold text-encre">
        Contrôles automatiques
      </h4>
      {controles?.etat === 'en_cours' && (
        <p className="mt-1 text-sm text-discret">Contrôles en cours : les résultats peuvent être incomplets.</p>
      )}
      {liste.length === 0 ? (
        <p className="mt-1 text-sm text-discret">Aucun résultat pour le moment.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {liste.map((c) => {
            const r = RESULTATS[c.resultat] ?? RESULTATS.indisponible
            return (
              <li key={c.code} className="flex gap-2 text-sm">
                <span className={r.classe}>
                  <Icone resultat={c.resultat} />
                </span>
                <div>
                  <span className={`font-medium ${r.classe}`}>{r.libelle}</span>
                  <span className="text-encre"> : {c.libelle}</span>
                  {c.detail && <p className="text-texte">{c.detail}</p>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
