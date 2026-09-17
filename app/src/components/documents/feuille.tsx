import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Briques des documents imprimables.
 *
 * Elles ne visent pas l'ecran mais la FEUILLE A4 que le directeur signe. Les
 * mesures sont donc en millimetres et en points (voir `styles/documents.css`),
 * et chaque brique se comporte correctement a la coupure de page.
 *
 * Ce fichier fournit le contenant. Le contenu du bulletin de paie — la liste
 * codee des rubriques, l'ordre des lignes, les formules — reste une affaire
 * metier decrite dans CLAUDE.md, et se reconstruit par-dessus ces briques.
 */

/**
 * Une feuille A4. Chaque feuille commence une nouvelle page a l'impression.
 *
 * `provisoire` appose un filigrane, a l'ecran comme au papier : un bulletin
 * calcule sur un mois non cloture peut encore bouger, et ne doit pas circuler
 * comme un document arrete.
 */
export function Feuille({
  provisoire,
  mentionProvisoire = "PROVISOIRE",
  children,
  className,
}: {
  provisoire?: boolean;
  mentionProvisoire?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <article
      className={cn("feuille", className)}
      data-filigrane={provisoire ? "" : undefined}
    >
      {provisoire ? (
        <div className="doc-filigrane" aria-hidden="true">
          {mentionProvisoire}
        </div>
      ) : null}
      {children}
    </article>
  );
}

/**
 * En-tete de document : qui emet a gauche, quel acte a droite.
 */
export function EnTeteDocument({
  raisonSociale,
  coordonnees,
  nature,
  periode,
}: {
  raisonSociale: React.ReactNode;
  /** Adresse, NIU, numero CNPS — les mentions legales de l'emetteur. */
  coordonnees?: React.ReactNode;
  /** Nature de l'acte : « Bulletin de paie », « Liste des salaires »… */
  nature: React.ReactNode;
  /** Periode ou date couverte par le document. */
  periode?: React.ReactNode;
}) {
  return (
    <header className="doc-entete">
      <div>
        <div className="raison">{raisonSociale}</div>
        {coordonnees ? <div className="coordonnees">{coordonnees}</div> : null}
      </div>
      <div className="nature">
        {nature}
        {periode ? <span className="periode">{periode}</span> : null}
      </div>
    </header>
  );
}

/** Bandeau de rubrique a l'interieur d'un document. */
export function BandeauDocument({ children }: { children: React.ReactNode }) {
  return <div className="doc-bandeau">{children}</div>;
}

/** Tableau borde de document. Bordures sur toutes les cellules. */
export function TableauDocument({
  className,
  ...props
}: React.ComponentProps<"table">) {
  return <table className={cn("doc-table", className)} {...props} />;
}

/**
 * Le montant qui conclut le document : net a payer, total arrete.
 * Le montant est aussi donne en toutes lettres quand `enLettres` est fourni —
 * mention d'usage sur les pieces de paie.
 */
export function TotalDocument({
  intitule,
  montant,
  enLettres,
}: {
  intitule: React.ReactNode;
  montant: React.ReactNode;
  enLettres?: React.ReactNode;
}) {
  return (
    <div className="doc-total">
      <span>
        {intitule}
        {enLettres ? (
          <span className="ml-2 text-[8pt] font-normal opacity-80">
            ({enLettres})
          </span>
        ) : null}
      </span>
      <span className="montant">{montant}</span>
    </div>
  );
}

/** Rangee de cases de bas de page (visa, signature, observations). */
export function CasesDocument({ children }: { children: React.ReactNode }) {
  return <div className="doc-cases">{children}</div>;
}

export function CaseDocument({
  intitule,
  children,
}: {
  intitule: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="doc-case">
      <div className="intitule">{intitule}</div>
      {children}
    </div>
  );
}

/**
 * Mention d'etat du document.
 * Un document non cloture le dit explicitement, en toutes lettres.
 */
export function MentionDocument({
  valide,
  dateValidation,
}: {
  valide: boolean;
  dateValidation?: string;
}) {
  return (
    <p className="doc-mention" data-etat={valide ? "valide" : "provisoire"}>
      {valide
        ? `DOCUMENT VALIDE${dateValidation ? ` le ${dateValidation}` : ""}`
        : "NON VALIDE — document provisoire, susceptible de modification"}
    </p>
  );
}
