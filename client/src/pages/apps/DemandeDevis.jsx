import { useEffect, useId, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { demanderDevis, lireApp, lireDevis } from "../../api/apps.js";
import { ErreurApi } from "../../api/client.js";
import { Alerte } from "../../components/Alerte.jsx";
import { Bouton, Indicateur } from "../../components/Bouton.jsx";
import { ChampTexte } from "../../components/Champ.jsx";
import { PageCompte, PanneauEtapes } from "../../components/MiseEnPage.jsx";
import { dateCourte } from "../../lib/campagnes.js";
import { LANGUES_DEVIS, nomsDe, PAYS_DEVIS } from "../../lib/devis.js";
import { messageErreurGlobale } from "../../lib/messages.js";
import { useChargement } from "../../lib/useChargement.js";
import { useFormulaire } from "../../lib/useFormulaire.js";
import { EspaceDeveloppeur, RetourCompte } from "../paiements/commun.jsx";

const TITRE = "Devis Offre Plus";

const PAYS_MAX = 6;
const LIMITES = { profils: [10, 1000], scenarios: [10, 2000] };

const PANNEAU = (
  <PanneauEtapes
    titre="Un test sur mesure"
    etapes={[
      {
        titre: "Vous décrivez votre besoin",
        detail:
          "Pays visés, langues, profils de testeurs et scénarios à jouer.",
      },
      {
        titre: "Nous vous proposons un prix",
        detail:
          "Par email, en général sous deux jours ouvrés, à partir de 99 $.",
      },
      {
        titre: "Vous payez et le test démarre",
        detail:
          "20 testeurs, plusieurs villes et réseaux, et un rapport sur l’usage réel.",
      },
    ]}
  />
);

const longueur = ([min, max], v) =>
  !v.trim()
    ? "requis"
    : v.trim().length < min
      ? "trop_court"
      : v.trim().length > max
        ? "trop_long"
        : null;
const VALIDATEURS = {
  pays: (v) =>
    !v.length ? "requis" : v.length > PAYS_MAX ? "trop_nombreux" : null,
  langues: (v) => (v.length ? null : "requis"),
  profils: (v) => longueur(LIMITES.profils, v),
  scenarios: (v) => longueur(LIMITES.scenarios, v),
};
const MESSAGES = {
  pays: {
    requis: "Cochez au moins un pays.",
    trop_nombreux: `Cochez ${PAYS_MAX} pays au plus.`,
    valeur_inconnue: "Cochez des pays de la liste.",
  },
  langues: {
    requis: "Cochez au moins une langue.",
    valeur_inconnue: "Cochez des langues de la liste.",
  },
  profils: {
    requis: "Décrivez les testeurs que vous visez.",
    trop_court: `Écrivez au moins ${LIMITES.profils[0]} caractères.`,
    trop_long: `Écrivez ${LIMITES.profils[1]} caractères au plus.`,
  },
  scenarios: {
    requis: "Décrivez ce que les testeurs doivent faire.",
    trop_court: `Écrivez au moins ${LIMITES.scenarios[0]} caractères.`,
    trop_long: `Écrivez ${LIMITES.scenarios[1]} caractères au plus.`,
  },
};

// Groupe de cases à cocher ; la première porte l'identifiant du champ (focus sur erreur).
function Cases({ nom, libelle, aide, options, valeur, erreur, onChange }) {
  const base = useId();
  const idErreur = `${base}-erreur`;
  const idAide = `${base}-aide`;
  const basculer = (code) =>
    onChange(
      valeur.includes(code)
        ? valeur.filter((c) => c !== code)
        : [...valeur, code],
    );
  return (
    <fieldset
      aria-describedby={
        [aide && idAide, erreur && idErreur].filter(Boolean).join(" ") ||
        undefined
      }
    >
      <legend className="block text-[13px] font-medium text-texte">
        {libelle}
      </legend>
      {aide && (
        <p id={idAide} className="mt-0.5 text-sm text-discret">
          {aide}
        </p>
      )}
      <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {options.map(([code, nomOption], i) => {
          const idCase = i === 0 ? `champ-${nom}` : `champ-${nom}-${code}`;
          return (
            <label
              key={code}
              htmlFor={idCase}
              className={`flex cursor-pointer items-center gap-2.5 rounded-champ border bg-white px-3 py-2.5 text-[15px] text-encre ${
                valeur.includes(code)
                  ? "border-accent"
                  : erreur
                    ? "border-erreur"
                    : "border-trait hover:border-discret"
              }`}
            >
              <input
                id={idCase}
                type="checkbox"
                checked={valeur.includes(code)}
                onChange={() => basculer(code)}
                aria-invalid={erreur ? true : undefined}
                className="size-[18px] shrink-0 accent-accent"
              />
              {nomOption}
            </label>
          );
        })}
      </div>
      {erreur && (
        <p id={idErreur} className="mt-1.5 text-sm text-erreur">
          {MESSAGES[nom][erreur] ?? "Cette valeur n’est pas valide."}
        </p>
      )}
    </fieldset>
  );
}

// Réponse de l'équipe : prix proposé (avec le lien de paiement) ou refus expliqué.
function Reponse({ app, devis }) {
  if (devis.statut === "demande") {
    return (
      <Alerte ton="info">
        Demande envoyée le {dateCourte(devis.demandeLe)}. Notre équipe l’étudie
        et vous répond par email avec un prix. Vous pouvez encore modifier votre
        besoin ci-dessous.
      </Alerte>
    );
  }
  if (devis.statut === "refuse") {
    return (
      <Alerte ton="alerte">
        <p className="font-semibold">
          Nous ne pouvons pas proposer ce test tel que décrit.
        </p>
        <p className="mt-1">Message de l’équipe : {devis.message}</p>
        <p className="mt-1">
          Modifiez votre besoin pour une nouvelle étude, ou choisissez l’Offre
          Standard ou Pro.
        </p>
      </Alerte>
    );
  }
  return (
    <section
      aria-labelledby="titre-proposition"
      className="rounded-carte border border-accent bg-white p-4"
    >
      <h2 id="titre-proposition" className="text-lg font-semibold text-encre">
        Notre proposition
      </h2>
      <p className="mt-2 text-texte">
        <span className="font-semibold text-encre">
          {devis.prix.mobile_money.montantLisible}
        </span>{" "}
        par Mobile Money, ou{" "}
        <span className="font-semibold text-encre">
          {devis.prix.carte.montantLisible}
        </span>{" "}
        par carte bancaire.
      </p>
      {devis.message && (
        <p className="mt-2 text-texte">Message de l’équipe : {devis.message}</p>
      )}
      {app.statut === "brouillon" ? (
        <Link
          to={`/mon-compte/apps/${app.id}/paiement?offre=afrique`}
          className="mt-4 inline-flex h-11 items-center justify-center rounded-champ bg-accent px-[18px] text-[15px] font-semibold text-white hover:bg-accent-fonce"
        >
          Payer ce devis
        </Link>
      ) : (
        <p className="mt-3 text-sm text-discret">Ce devis est payé.</p>
      )}
    </section>
  );
}

function Formulaire({ app, devis, surEnvoi }) {
  const formulaire = useFormulaire(
    {
      pays: devis?.pays ?? [],
      langues: devis?.langues ?? [],
      profils: devis?.profils ?? "",
      scenarios: devis?.scenarios ?? "",
    },
    VALIDATEURS,
  );
  const { valeurs, erreurs, lier } = formulaire;
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const alerte = useRef(null);

  useEffect(() => {
    if (erreur) alerte.current?.focus();
  }, [erreur]);

  async function soumettre(e) {
    e.preventDefault();
    setErreur(null);
    if (!formulaire.validerTout()) return;
    setEnvoi(true);
    try {
      const { devis: nouveau } = await demanderDevis(app.id, {
        pays: valeurs.pays,
        langues: valeurs.langues,
        profils: valeurs.profils.trim(),
        scenarios: valeurs.scenarios.trim(),
      });
      surEnvoi(nouveau);
    } catch (err) {
      if (err instanceof ErreurApi && err.champs)
        formulaire.appliquerErreursServeur(err.champs);
      else if (err instanceof ErreurApi && err.code === "statut_incompatible")
        setErreur(
          "Cette app est déjà payée : son besoin ne peut plus changer.",
        );
      else setErreur(messageErreurGlobale(err));
    } finally {
      setEnvoi(false);
    }
  }

  const modifier = (nom) => (v) => formulaire.modifier(nom, v);
  return (
    <form onSubmit={soumettre} noValidate className="mt-6 space-y-5">
      {erreur && (
        <Alerte ton="erreur" ref={alerte}>
          {erreur}
        </Alerte>
      )}
      <Cases
        nom="pays"
        libelle="Pays visés"
        aide={`Jusqu’à ${PAYS_MAX} pays. Nos testeurs sont aujourd’hui au Bénin : nous vous disons dans le devis ce qui est possible ailleurs.`}
        options={PAYS_DEVIS}
        valeur={valeurs.pays}
        erreur={erreurs.pays}
        onChange={modifier("pays")}
      />
      <Cases
        nom="langues"
        libelle="Langues à tester"
        options={LANGUES_DEVIS}
        valeur={valeurs.langues}
        erreur={erreurs.langues}
        onChange={modifier("langues")}
      />
      <ChampTexte
        {...lier("profils")}
        messages={MESSAGES.profils}
        libelle="Profils de testeurs"
        aide="Par exemple : commerçantes de marché, étudiants, chauffeurs de taxi-moto, personnes peu habituées aux applications."
        max={LIMITES.profils[1]}
        lignes={3}
      />
      <ChampTexte
        {...lier("scenarios")}
        messages={MESSAGES.scenarios}
        libelle="Scénarios à jouer"
        aide="Ce que les testeurs doivent faire, et dans quelles conditions : réseau lent, petit téléphone, paiement Mobile Money…"
        max={LIMITES.scenarios[1]}
        lignes={5}
      />
      <Bouton
        chargement={envoi}
        libelleChargement="Envoi…"
        className="w-full sm:w-auto"
      >
        {devis ? "Envoyer le besoin modifié" : "Demander un devis"}
      </Bouton>
    </form>
  );
}

function Contenu({ id, utilisateur }) {
  const { chargement, donnees, erreur, reessayer } = useChargement(
    async (signal) => {
      const [{ app }, { devis }] = await Promise.all([
        lireApp(id, { signal }),
        lireDevis(id, { signal }),
      ]);
      return { app, devis };
    },
    id,
  );
  const [devisEnvoye, setDevisEnvoye] = useState(null);

  if (chargement) {
    return (
      <PageCompte titre={TITRE} utilisateur={utilisateur} panneau={PANNEAU}>
        <p role="status" className="flex items-center gap-3 text-texte">
          <Indicateur className="size-5 text-accent" />
          Chargement…
        </p>
      </PageCompte>
    );
  }
  if (erreur) {
    const absente = erreur instanceof ErreurApi && erreur.statut === 404;
    return (
      <PageCompte titre={TITRE} utilisateur={utilisateur} panneau={PANNEAU}>
        <Alerte ton="erreur">
          {absente
            ? "Cette app est introuvable. Elle a peut-être été supprimée."
            : messageErreurGlobale(erreur)}
        </Alerte>
        {!absente && (
          <Bouton
            type="button"
            variante="secondaire"
            className="mt-4"
            onClick={reessayer}
          >
            Réessayer
          </Bouton>
        )}
        <RetourCompte />
      </PageCompte>
    );
  }
  const { app } = donnees;
  const devis = devisEnvoye ?? donnees.devis;
  const modifiable = app.statut === "brouillon";

  return (
    <PageCompte
      titre={TITRE}
      utilisateur={utilisateur}
      panneau={PANNEAU}
      intro={
        <p>
          Pour{" "}
          <span className="font-semibold [overflow-wrap:anywhere] text-encre">
            {app.nom}
          </span>
          . 20 testeurs dans plusieurs villes et sur plusieurs réseaux, payés
          chacun 1 500 FCFA, des scénarios sur mesure et un rapport sur le
          réseau lent, les petits téléphones et la compréhension de la langue.
        </p>
      }
    >
      <div className="space-y-6">
        {devisEnvoye && (
          <Alerte ton="succes">
            Votre besoin est envoyé. Nous vous répondons par email.
          </Alerte>
        )}
        {devis && <Reponse app={app} devis={devis} />}
        {!modifiable && !devis && (
          <Alerte ton="info">
            Cette app est déjà payée : le devis se demande avant le paiement.
          </Alerte>
        )}
        {!modifiable && devis && (
          <dl className="space-y-2 rounded-carte border border-trait bg-white p-4 text-sm">
            <div>
              <dt className="font-medium text-texte">Pays visés</dt>
              <dd className="text-encre">{nomsDe(PAYS_DEVIS, devis.pays)}</dd>
            </div>
            <div>
              <dt className="font-medium text-texte">Langues</dt>
              <dd className="text-encre">
                {nomsDe(LANGUES_DEVIS, devis.langues)}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-texte">Profils</dt>
              <dd className="[overflow-wrap:anywhere] whitespace-pre-line text-encre">
                {devis.profils}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-texte">Scénarios</dt>
              <dd className="[overflow-wrap:anywhere] whitespace-pre-line text-encre">
                {devis.scenarios}
              </dd>
            </div>
          </dl>
        )}
      </div>
      {modifiable && (
        <Formulaire
          key={devis?.demandeLe ?? "nouveau"}
          app={app}
          devis={devis}
          surEnvoi={setDevisEnvoye}
        />
      )}
      <RetourCompte />
    </PageCompte>
  );
}

// /mon-compte/apps/:id/devis (US-37) : besoin du développeur et réponse de l'équipe.
export default function DemandeDevis() {
  const { id } = useParams();
  return (
    <EspaceDeveloppeur
      titre={TITRE}
      suite={`/mon-compte/apps/${id}/devis`}
      raison="pour demander un devis Offre Plus."
      contenu={(utilisateur) =>
        utilisateur.statut === "valide" ? (
          <Contenu id={id} utilisateur={utilisateur} />
        ) : (
          <PageCompte titre={TITRE} utilisateur={utilisateur} panneau={PANNEAU}>
            <Alerte ton="alerte">
              Votre compte doit être validé par l’équipe avant de demander un
              devis.
            </Alerte>
            <RetourCompte />
          </PageCompte>
        )
      }
    />
  );
}
