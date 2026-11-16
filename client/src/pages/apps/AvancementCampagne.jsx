import { useEffect, useState } from "react";
import { lireAvancement } from "../../api/apps.js";
import { Alerte } from "../../components/Alerte.jsx";
import { Bouton, Indicateur } from "../../components/Bouton.jsx";
import {
  duree,
  jourCourt,
  jourLong,
  pourcentage,
} from "../../lib/campagnes.js";
import { messageErreurGlobale } from "../../lib/messages.js";

const RAPPORTS_PAR_PAGE = 20;
const FILTRES = [
  { id: "tous", libelle: "Tous" },
  { id: "bugs", libelle: "Problèmes signalés" },
  { id: "avis", libelle: "Avis détaillés" },
];

function Chiffre({ valeur, libelle, detail }) {
  return (
    <div className="rounded-carte border border-trait bg-white p-4">
      <p className="font-titre text-2xl font-semibold text-encre">{valeur}</p>
      <p className="mt-1 text-sm text-texte">{libelle}</p>
      {detail && <p className="mt-1 text-xs text-discret">{detail}</p>}
    </div>
  );
}

function Section({ id, titre, intro, children }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-lg font-semibold text-encre">
        {titre}
      </h2>
      {intro && <p className="mt-1 text-sm text-texte">{intro}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Resume({ a }) {
  const { resume, objectif } = a;
  let fin;
  if (objectif.atteint)
    fin = {
      valeur: "Atteint",
      detail: `${objectif.testeursAtteints} testeurs ont leurs ${a.joursExiges} jours.`,
    };
  else if (objectif.dateEstimee)
    fin = {
      valeur: jourCourt(objectif.dateEstimee),
      detail: `Le ${jourLong(objectif.dateEstimee)}, si aucun jour n’est manqué.`,
    };
  else
    fin = {
      valeur: "À venir",
      detail: "Estimée dès que 12 testeurs ont installé l’app.",
    };
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Chiffre
        valeur={`${resume.testeursActifs} sur ${resume.installes}`}
        libelle="testeurs actifs"
        detail="Rapport ou temps de test aujourd’hui ou hier."
      />
      <Chiffre
        valeur={duree(resume.tempsTotalSecondes)}
        libelle="de test au total"
      />
      <Chiffre
        valeur={String(resume.rapports)}
        libelle={`rapport${resume.rapports > 1 ? "s" : ""} reçu${resume.rapports > 1 ? "s" : ""}`}
        detail={
          resume.noteMoyenne !== null
            ? `Note moyenne ${String(resume.noteMoyenne).replace(".", ",")} sur 5`
            : undefined
        }
      />
      <Chiffre
        valeur={fin.valeur}
        libelle={`fin des ${a.joursExiges} jours pour 12 testeurs`}
        detail={fin.detail}
      />
    </div>
  );
}

// Temps de test par jour : une barre par jour, valeur au survol et au clavier, tableau à côté.
function TempsParJour({ jours }) {
  const max = Math.max(...jours.map((j) => j.tempsSecondes), 1);
  return (
    <>
      <div className="rounded-carte border border-trait bg-white p-4">
        <div
          className="flex h-40 items-end gap-[2px]"
          role="list"
          aria-label="Temps de test par jour"
        >
          {jours.map((j) => {
            const texte = `Jour ${j.numero}, ${jourCourt(j.jour)} : ${duree(j.tempsSecondes)}, ${j.rapports} rapport${j.rapports > 1 ? "s" : ""}`;
            return (
              <div
                key={j.jour}
                role="listitem"
                className="group relative flex h-full min-w-0 flex-1 items-end"
                tabIndex={0}
                aria-label={texte}
              >
                <div
                  className="w-full rounded-t-[4px] bg-accent transition-opacity duration-150 group-hover:opacity-80 group-focus:opacity-80"
                  style={{
                    height: `${Math.max((j.tempsSecondes / max) * 100, j.tempsSecondes ? 2 : 0)}%`,
                  }}
                />
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden w-max max-w-48 -translate-x-1/2 rounded-champ bg-encre px-2 py-1 text-xs text-white group-hover:block group-focus:block">
                  {texte}
                </span>
              </div>
            );
          })}
        </div>
        <div
          className="mt-1 flex justify-between border-t border-trait pt-1 text-xs text-discret"
          aria-hidden="true"
        >
          <span>Jour 1</span>
          <span>Jour {jours.at(-1)?.numero}</span>
        </div>
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-semibold text-encre">
          Voir le détail par jour
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-texte">
            <thead className="text-xs text-discret">
              <tr>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Jour
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Temps de test
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Testeurs
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Rapports
                </th>
                <th scope="col" className="py-2 font-medium">
                  Jours validés
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-trait">
              {jours.map((j) => (
                <tr key={j.jour}>
                  <th scope="row" className="py-2 pr-3 font-medium text-encre">
                    {j.numero}{" "}
                    <span className="font-normal text-discret">
                      · {jourCourt(j.jour)}
                    </span>
                  </th>
                  <td className="py-2 pr-3">{duree(j.tempsSecondes)}</td>
                  <td className="py-2 pr-3">{j.testeursAvecUsage}</td>
                  <td className="py-2 pr-3">{j.rapports}</td>
                  <td className="py-2">
                    {j.testeursValides ?? "Vérifié cette nuit"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

function Couverture({ couverture }) {
  return (
    <ul className="space-y-3 rounded-carte border border-trait bg-white p-4">
      {couverture.map((c) => (
        <li key={c.fonctionnalite}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium text-encre [overflow-wrap:anywhere]">
              {c.fonctionnalite}
            </span>
            <span className="shrink-0 text-texte">
              {pourcentage(c.part)}{" "}
              <span className="text-discret">
                · {c.testeurs} testeur{c.testeurs > 1 ? "s" : ""}
              </span>
            </span>
          </div>
          <div
            className="mt-1 h-2 overflow-hidden rounded-full bg-fond-doux"
            aria-hidden="true"
          >
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.min(c.part, 1) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Appareils({ appareils, entreeDeGamme = 0 }) {
  if (!appareils.length)
    return (
      <p className="text-sm text-texte">
        Aucun téléphone connu pour l’instant.
      </p>
    );
  return (
    <>
      {entreeDeGamme > 0 && (
        <p className="mb-3 text-sm text-texte">
          {entreeDeGamme} {entreeDeGamme > 1 ? "testeurs ont" : "testeur a"} un
          téléphone d’entrée de gamme (3 Go de mémoire vive ou moins).
        </p>
      )}
      <ul className="divide-y divide-trait rounded-carte border border-trait bg-white text-sm">
        {appareils.map((p) => (
          <li
            key={`${p.modele}-${p.versionAndroid}`}
            className="flex items-baseline justify-between gap-3 px-4 py-2"
          >
            <span className="text-encre">
              {p.modele ?? "Modèle inconnu"}
              {p.versionAndroid && (
                <span className="text-discret">
                  {" "}
                  · Android {p.versionAndroid}
                </span>
              )}
              {p.entreeDeGamme && (
                <span className="text-discret"> · entrée de gamme</span>
              )}
            </span>
            <span className="shrink-0 text-texte">
              {p.testeurs} testeur{p.testeurs > 1 ? "s" : ""}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

function Rapport({ r }) {
  return (
    <li className="px-4 py-3 text-sm">
      <p className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="font-semibold text-encre">
          {r.testeur ? `Testeur ${r.testeur}` : "Testeur remplacé"}{" "}
          <span className="font-normal text-discret">· {r.ville}</span>
        </span>
        <span className="text-discret">
          Jour {r.jourCampagne} · {jourCourt(r.jour)} · version {r.versionApp}
        </span>
      </p>
      <p className="mt-1 text-texte">
        <span className="font-medium text-encre">Note {r.note} sur 5.</span>{" "}
        {r.actions}
      </p>
      {r.bug && (
        <p className="mt-2 rounded-champ bg-erreur-clair px-3 py-2 text-[#7A1A12]">
          <span className="font-semibold">Problème signalé : </span>
          {r.commentaireBug}
        </p>
      )}
      {r.retourDetaille && (
        <p className="mt-2 rounded-champ bg-fond-doux px-3 py-2 text-texte">
          <span className="font-semibold text-encre">Avis détaillé : </span>
          {r.retourDetaille}
        </p>
      )}
      <p className="mt-1 text-xs text-discret">
        Fonctionnalités utilisées : {r.fonctionnalites.join(", ")}
      </p>
    </li>
  );
}

function Rapports({ rapports }) {
  const [filtre, setFiltre] = useState("tous");
  const [nombre, setNombre] = useState(RAPPORTS_PAR_PAGE);
  if (!rapports.length)
    return (
      <p className="text-sm text-texte">
        Aucun rapport pour l’instant. Les testeurs envoient le leur chaque jour.
      </p>
    );
  const filtres = rapports.filter((r) =>
    filtre === "bugs"
      ? r.bug
      : filtre === "avis"
        ? Boolean(r.retourDetaille)
        : true,
  );
  return (
    <>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Filtrer les rapports"
      >
        {FILTRES.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filtre === f.id}
            onClick={() => {
              setFiltre(f.id);
              setNombre(RAPPORTS_PAR_PAGE);
            }}
            className={`rounded-champ border px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
              filtre === f.id
                ? "border-accent bg-accent-clair text-accent"
                : "border-trait bg-white text-texte hover:border-discret"
            }`}
          >
            {f.libelle}
          </button>
        ))}
      </div>
      {filtres.length ? (
        <ul className="mt-3 divide-y divide-trait rounded-carte border border-trait bg-white">
          {filtres.slice(0, nombre).map((r) => (
            <Rapport key={r.id} r={r} />
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-texte">Aucun rapport de ce type.</p>
      )}
      {filtres.length > nombre && (
        <Bouton
          type="button"
          variante="secondaire"
          className="mt-3"
          onClick={() => setNombre((n) => n + RAPPORTS_PAR_PAGE)}
        >
          Afficher plus de rapports
        </Bouton>
      )}
    </>
  );
}

// US-21 : avancement de la campagne au jour le jour, sous le suivi des testeurs.
export function AvancementCampagne({ appId }) {
  const [essai, setEssai] = useState(0);
  const [etat, setEtat] = useState({
    cle: null,
    avancement: null,
    erreur: null,
  });
  const cle = `${appId}:${essai}`;

  useEffect(() => {
    const controleur = new AbortController();
    lireAvancement(appId, { signal: controleur.signal })
      .then(({ avancement }) => setEtat({ cle, avancement, erreur: null }))
      .catch((erreur) => {
        if (!controleur.signal.aborted)
          setEtat({ cle, avancement: null, erreur });
      });
    return () => controleur.abort();
  }, [appId, cle]);

  if (etat.cle !== cle) {
    return (
      <p role="status" className="flex items-center gap-3 text-texte">
        <Indicateur className="size-5 text-accent" />
        Chargement de l’avancement…
      </p>
    );
  }
  if (etat.erreur) {
    return (
      <div>
        <Alerte ton="erreur">{messageErreurGlobale(etat.erreur)}</Alerte>
        <Bouton
          type="button"
          variante="secondaire"
          className="mt-4"
          onClick={() => setEssai((n) => n + 1)}
        >
          Réessayer
        </Bouton>
      </div>
    );
  }
  const a = etat.avancement;
  return (
    <div className="space-y-8">
      <Section id="resume" titre="Où en est le test">
        <Resume a={a} />
      </Section>
      <Section
        id="par-jour"
        titre="Temps de test par jour"
        intro="Temps passé dans votre app par l’ensemble des testeurs, mesuré par l’app Nakayo."
      >
        <TempsParJour jours={a.parJour} />
      </Section>
      <Section
        id="couverture"
        titre="Fonctionnalités testées"
        intro="Part des testeurs ayant installé l’app qui ont utilisé chaque fonctionnalité au moins une fois."
      >
        <Couverture couverture={a.couverture} />
      </Section>
      <Section id="appareils" titre="Téléphones des testeurs">
        <Appareils
          appareils={a.appareils}
          entreeDeGamme={a.resume.appareilsEntreeDeGamme ?? 0}
        />
      </Section>
      <Section
        id="rapports"
        titre="Rapports des testeurs"
        intro="Du plus récent au plus ancien. Ces réponses vous aideront à remplir le formulaire d’accès à la production."
      >
        <Rapports rapports={a.rapports} />
      </Section>
    </div>
  );
}
