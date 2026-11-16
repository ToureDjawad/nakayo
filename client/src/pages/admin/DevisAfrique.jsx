import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { listerDevis, proposerDevis, refuserDevis } from "../../api/admin.js";
import { ErreurApi } from "../../api/client.js";
import { Alerte } from "../../components/Alerte.jsx";
import { Bouton, Indicateur } from "../../components/Bouton.jsx";
import { Champ, ChampTexte } from "../../components/Champ.jsx";
import { PageAdmin } from "../../components/MiseEnPage.jsx";
import { dateHeure, pluriel } from "../../lib/format.js";
import { messageErreurGlobale } from "../../lib/messages.js";
import { useFormulaire } from "../../lib/useFormulaire.js";
import { LANGUES_DEVIS, nomsDe, PAYS_DEVIS } from "../../lib/devis.js";
import { AccesAdmin } from "./AccesAdmin.jsx";

const TITRE = "Devis Offre Plus";
const ONGLETS = [
  { statut: "demande", libelle: "À étudier" },
  { statut: "propose", libelle: "Proposés" },
  { statut: "refuse", libelle: "Refusés" },
];
// Prix de départ de l'offre (docs/api-offres.md §4.2) : 99 $ ou 59 400 FCFA.
const DEPART = { carte: 99, mobileMoney: 59400 };
const MESSAGE_MAX = 1000;

// « 149 » ou « 149,50 » dollars → centimes ; null si la saisie n'est pas un montant.
function centimes(saisie) {
  const texte = String(saisie).trim().replace(",", ".");
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(texte)) return null;
  return Math.round(Number(texte) * 100);
}
const francs = (saisie) =>
  /^\d{1,9}$/.test(String(saisie).replace(/\s/g, ""))
    ? Number(String(saisie).replace(/\s/g, ""))
    : null;

const VALIDATEURS = {
  prixCarte: (v) =>
    !String(v).trim()
      ? "requis"
      : centimes(v) === null
        ? "format_invalide"
        : centimes(v) < DEPART.carte * 100
          ? "trop_petit"
          : null,
  prixMobileMoney: (v) =>
    !String(v).trim()
      ? "requis"
      : francs(v) === null
        ? "format_invalide"
        : francs(v) < DEPART.mobileMoney
          ? "trop_petit"
          : null,
  message: (v) => (v.trim().length > MESSAGE_MAX ? "trop_long" : null),
};
const MESSAGES = {
  prixCarte: {
    requis: "Indiquez le prix par carte.",
    format_invalide: "Saisissez un montant en dollars, par exemple 149.",
    trop_petit: `Au moins ${DEPART.carte} $.`,
  },
  prixMobileMoney: {
    requis: "Indiquez le prix par Mobile Money.",
    format_invalide: "Saisissez un montant en FCFA, sans décimale.",
    trop_petit: "Au moins 59 400 FCFA.",
  },
  message: {
    requis: "Expliquez au développeur pourquoi.",
    trop_long: `${MESSAGE_MAX} caractères au plus.`,
  },
};

function Ligne({ terme, children }) {
  return (
    <div className="py-2 sm:grid sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm text-discret">{terme}</dt>
      <dd className="mt-0.5 [overflow-wrap:anywhere] whitespace-pre-line text-encre sm:mt-0">
        {children}
      </dd>
    </div>
  );
}

function Proposition({ devis, onRepondu }) {
  const formulaire = useFormulaire(
    {
      prixCarte: String(DEPART.carte),
      prixMobileMoney: String(DEPART.mobileMoney),
      message: "",
    },
    VALIDATEURS,
    { prefixe: `devis-${devis.id}-` },
  );
  const { valeurs, lier } = formulaire;
  const [envoi, setEnvoi] = useState(null);
  const [refus, setRefus] = useState(false);
  const [erreur, setErreur] = useState(null);
  const refMessage = useRef(null);

  useEffect(() => {
    if (refus) refMessage.current?.focus();
  }, [refus]);

  async function envoyer(action) {
    setErreur(null);
    setEnvoi(action);
    try {
      const { devis: repondu } =
        action === "refus"
          ? await refuserDevis(devis.id, valeurs.message.trim())
          : await proposerDevis(devis.id, {
              prixCarte: centimes(valeurs.prixCarte),
              prixMobileMoney: francs(valeurs.prixMobileMoney),
              message: valeurs.message.trim() || undefined,
            });
      onRepondu(
        repondu,
        action === "refus"
          ? `Demande refusée pour « ${devis.app.nom} ». Le développeur est prévenu par email.`
          : `Prix proposé pour « ${devis.app.nom} ». Le développeur est prévenu par email.`,
      );
    } catch (err) {
      setEnvoi(null);
      if (err instanceof ErreurApi && err.champs)
        return formulaire.appliquerErreursServeur(err.champs);
      if (
        err instanceof ErreurApi &&
        ["deja_repondu", "statut_incompatible"].includes(err.code)
      ) {
        return setErreur(
          "Ce devis a déjà reçu une réponse, ou l’app a été payée entre-temps. Rechargez la page.",
        );
      }
      setErreur(messageErreurGlobale(err));
    }
  }

  function proposer(e) {
    e.preventDefault();
    if (formulaire.validerTout()) envoyer("proposition");
  }

  function refuser(e) {
    e.preventDefault();
    // Seul le message compte pour un refus : les prix ne sont pas envoyés.
    const texte = valeurs.message.trim();
    if (!texte || texte.length > MESSAGE_MAX)
      return formulaire.appliquerErreursServeur({
        message: texte ? "trop_long" : "requis",
      });
    envoyer("refus");
  }

  return (
    <form
      onSubmit={refus ? refuser : proposer}
      noValidate
      className="mt-4 space-y-4 border-t border-trait pt-4"
    >
      {erreur && <Alerte ton="erreur">{erreur}</Alerte>}
      {!refus && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Champ
            {...lier("prixCarte")}
            messages={MESSAGES.prixCarte}
            libelle="Prix par carte (en $)"
            inputMode="decimal"
            aide="À partir de 99 $."
          />
          <Champ
            {...lier("prixMobileMoney")}
            messages={MESSAGES.prixMobileMoney}
            libelle="Prix par Mobile Money (en FCFA)"
            inputMode="numeric"
            aide="À partir de 59 400 FCFA (1 $ = 600 FCFA)."
          />
        </div>
      )}
      <ChampTexte
        {...lier("message")}
        ref={refMessage}
        messages={MESSAGES.message}
        libelle={
          refus ? "Pourquoi refuser" : "Message au développeur (facultatif)"
        }
        aide={
          refus
            ? "Envoyé au développeur, qui peut corriger son besoin."
            : "Ce que comprend le prix : villes, langues, scénarios."
        }
        max={MESSAGE_MAX}
        lignes={3}
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        {refus ? (
          <>
            <Bouton
              chargement={envoi === "refus"}
              libelleChargement="Envoi…"
              aria-label={`Confirmer le refus : ${devis.app.nom}`}
            >
              Confirmer le refus
            </Bouton>
            <Bouton
              type="button"
              variante="secondaire"
              disabled={Boolean(envoi)}
              onClick={() => setRefus(false)}
            >
              Annuler
            </Bouton>
          </>
        ) : (
          <>
            <Bouton
              chargement={envoi === "proposition"}
              libelleChargement="Envoi…"
              aria-label={`Proposer ce prix : ${devis.app.nom}`}
            >
              Proposer ce prix
            </Bouton>
            <Bouton
              type="button"
              variante="secondaire"
              disabled={Boolean(envoi)}
              onClick={() => setRefus(true)}
              aria-label={`Refuser : ${devis.app.nom}`}
            >
              Refuser
            </Bouton>
          </>
        )}
      </div>
    </form>
  );
}

function CarteDevis({ devis, onRepondu }) {
  return (
    <article
      aria-labelledby={`devis-${devis.id}`}
      className="rounded-carte border border-trait bg-white p-4 sm:p-5"
    >
      <h3
        id={`devis-${devis.id}`}
        className="text-lg font-semibold [overflow-wrap:anywhere] text-encre"
      >
        {devis.app.nom}
      </h3>
      <p className="mt-0.5 font-mono text-sm [overflow-wrap:anywhere] text-texte">
        {devis.app.package}
      </p>
      <dl className="mt-3 divide-y divide-trait">
        <Ligne terme="Développeur">
          {devis.developpeur.nom} · {devis.developpeur.email}
        </Ligne>
        <Ligne terme="Demandé le">{dateHeure(devis.demandeLe)}</Ligne>
        <Ligne terme="Pays visés">{nomsDe(PAYS_DEVIS, devis.pays)}</Ligne>
        <Ligne terme="Langues">{nomsDe(LANGUES_DEVIS, devis.langues)}</Ligne>
        <Ligne terme="Profils">{devis.profils}</Ligne>
        <Ligne terme="Scénarios">{devis.scenarios}</Ligne>
        {devis.prix && (
          <Ligne terme="Prix proposé">
            {devis.prix.carte.montantLisible} ou{" "}
            {devis.prix.mobile_money.montantLisible}
          </Ligne>
        )}
        {devis.message && <Ligne terme="Message">{devis.message}</Ligne>}
        {devis.reponduLe && (
          <Ligne terme="Répondu le">{dateHeure(devis.reponduLe)}</Ligne>
        )}
      </dl>
      {devis.statut === "demande" && (
        <Proposition devis={devis} onRepondu={onRepondu} />
      )}
    </article>
  );
}

function ListeDevis() {
  const [parametres, setParametres] = useSearchParams();
  const statut = ONGLETS.some((o) => o.statut === parametres.get("statut"))
    ? parametres.get("statut")
    : "demande";
  const [essai, setEssai] = useState(0);
  const [resultat, setResultat] = useState({
    cle: null,
    devis: null,
    erreur: null,
  });
  const [annonce, setAnnonce] = useState(null);
  const cle = `${statut}:${essai}`;

  useEffect(() => {
    const controleur = new AbortController();
    listerDevis({ statut }, { signal: controleur.signal })
      .then(({ devis }) => setResultat({ cle, devis, erreur: null }))
      .catch((erreur) => {
        if (!controleur.signal.aborted)
          setResultat({ cle, devis: null, erreur });
      });
    return () => controleur.abort();
  }, [statut, cle]);

  function retirer(repondu, message) {
    setAnnonce(message);
    setResultat((r) =>
      r.devis ? { ...r, devis: r.devis.filter((d) => d.id !== repondu.id) } : r,
    );
  }

  const chargement = resultat.cle !== cle;
  const { devis, erreur } = resultat;
  const titreListe = () => {
    if (!devis.length)
      return statut === "demande"
        ? "Aucun devis à étudier"
        : statut === "propose"
          ? "Aucun devis proposé"
          : "Aucun devis refusé";
    if (statut === "demande")
      return `${pluriel(devis.length, "devis", "devis")} à étudier`;
    return statut === "propose"
      ? pluriel(devis.length, "devis proposé", "devis proposés")
      : pluriel(devis.length, "devis refusé", "devis refusés");
  };

  return (
    <div>
      <nav aria-label="Statut des devis" className="flex flex-wrap gap-2">
        {ONGLETS.map((o) => (
          <button
            key={o.statut}
            type="button"
            aria-current={statut === o.statut ? "page" : undefined}
            onClick={() => {
              setAnnonce(null);
              setParametres(o.statut === "demande" ? {} : { statut: o.statut });
            }}
            className={`h-10 rounded-champ border px-4 text-sm font-semibold ${
              statut === o.statut
                ? "border-encre bg-encre text-white"
                : "border-trait bg-white text-encre hover:bg-fond-doux"
            }`}
          >
            {o.libelle}
          </button>
        ))}
      </nav>

      <div aria-live="polite" className="mt-4">
        {annonce && <Alerte ton="succes">{annonce}</Alerte>}
      </div>

      {erreur && !chargement && (
        <div className="mt-4">
          <Alerte ton="erreur">{messageErreurGlobale(erreur)}</Alerte>
          <Bouton
            type="button"
            variante="secondaire"
            className="mt-3"
            onClick={() => setEssai((n) => n + 1)}
          >
            Réessayer
          </Bouton>
        </div>
      )}

      {chargement && !devis && (
        <p role="status" className="mt-4 flex items-center gap-3 text-texte">
          <Indicateur className="size-5 text-accent" />
          Chargement…
        </p>
      )}

      {devis && (
        <section
          aria-labelledby="titre-liste"
          className={`mt-4 ${chargement ? "opacity-60" : ""}`}
        >
          <h2 id="titre-liste" className="text-lg text-encre">
            {titreListe()}
          </h2>
          <ul className="mt-4 space-y-4">
            {devis.map((d) => (
              <li key={d.id}>
                <CarteDevis devis={d} onRepondu={retirer} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// /admin/devis : devis de l'Offre Plus (US-37).
export default function DevisAfrique() {
  return (
    <AccesAdmin titre={TITRE}>
      {(utilisateur) => (
        <PageAdmin
          titre={TITRE}
          utilisateur={utilisateur}
          intro={
            <p>
              Les besoins décrits par les développeurs, des plus anciens aux
              plus récents. Proposez un prix (au moins 99 $ ou 59 400 FCFA), ou
              refusez avec un message : le développeur est prévenu par email.
            </p>
          }
        >
          <ListeDevis />
        </PageAdmin>
      )}
    </AccesAdmin>
  );
}
