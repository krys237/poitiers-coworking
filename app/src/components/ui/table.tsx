import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Le tableau « Registre ».
 *
 * C'est LE composant de la plateforme : 32 tableaux, 290 cellules, et le
 * recapitulatif salaires en compte 18 colonnes. Trois partis pris :
 *
 *  - `bandes` (par defaut) alterne le fond des lignes comme un papier de
 *    listing comptable. Ce n'est pas decoratif : sur 18 colonnes, c'est ce qui
 *    empeche l'oeil de changer de ligne en route.
 *  - l'en-tete est COLLANT des qu'on fixe `hauteurMax`, pour garder les
 *    libelles de colonne visibles sur un effectif long.
 *  - le pied de tableau porte le FILET DOUBLE : la convention comptable du
 *    total arrete.
 *
 * Les chiffres : passer `numerique` sur `TableHead` et `TableCell`. Cela
 * aligne a droite et force les chiffres tabulaires, pour que les unites,
 * dizaines et centaines se superposent d'une ligne a l'autre.
 */

type TableProps = React.ComponentProps<"table"> & {
  /** Hauteur maximale du conteneur ; active l'en-tete collant. Ex. "60vh". */
  hauteurMax?: string;
  /** Classes appliquees au conteneur defilant. */
  classNameConteneur?: string;
};

function Table({
  className,
  hauteurMax,
  classNameConteneur,
  ...props
}: TableProps) {
  return (
    <div
      data-slot="table-container"
      className={cn(
        "relative w-full overflow-x-auto border border-filet bg-surface",
        "print:overflow-visible print:border-0",
        classNameConteneur
      )}
      style={hauteurMax ? { maxHeight: hauteurMax, overflowY: "auto" } : undefined}
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom border-collapse text-sm", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        "sticky top-0 z-10 bg-sceau text-primary-foreground",
        "print:static print:bg-bande print:text-encre",
        className
      )}
      {...props}
    />
  );
}

type TableBodyProps = React.ComponentProps<"tbody"> & {
  /** Alterne le fond des lignes (papier de listing). Actif par defaut. */
  bandes?: boolean;
};

function TableBody({ className, bandes = true, ...props }: TableBodyProps) {
  return (
    <tbody
      data-slot="table-body"
      className={cn(
        bandes && "[&>tr:nth-child(even)]:bg-bande",
        "[&>tr:last-child]:border-0",
        className
      )}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        // Le geste signature : filet double sous le total arrete.
        // 4 px minimum, sinon les deux traits se confondent en un seul epais.
        "sticky bottom-0 z-10 border-t-4 border-double border-encre bg-surface font-semibold",
        "print:static",
        className
      )}
      {...props}
    />
  );
}

type TableRowProps = React.ComponentProps<"tr"> & {
  /** Ligne mise en avant (selection, ligne en cours d'edition). */
  active?: boolean;
};

function TableRow({ className, active, ...props }: TableRowProps) {
  return (
    <tr
      data-slot="table-row"
      data-active={active || undefined}
      className={cn(
        "border-b border-filet-clair transition-colors",
        "hover:bg-sceau-clair/70 data-[active]:bg-sceau-clair",
        "print:hover:bg-transparent",
        className
      )}
      {...props}
    />
  );
}

type CelluleProps = {
  /** Aligne a droite en chiffres tabulaires. Pour toute colonne de montants. */
  numerique?: boolean;
  /** Centre le contenu. */
  centre?: boolean;
};

function TableHead({
  className,
  numerique,
  centre,
  ...props
}: React.ComponentProps<"th"> & CelluleProps) {
  return (
    <th
      data-slot="table-head"
      scope="col"
      className={cn(
        "h-auto px-2.5 py-2 align-bottom text-xs font-semibold leading-tight",
        "border-r border-white/15 last:border-r-0 print:border-filet",
        numerique ? "text-right tabular-nums" : centre ? "text-center" : "text-left",
        className
      )}
      {...props}
    />
  );
}

function TableCell({
  className,
  numerique,
  centre,
  ...props
}: React.ComponentProps<"td"> & CelluleProps) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-2.5 py-1.5 align-middle",
        numerique ? "text-right tabular-nums" : centre ? "text-center" : "text-left",
        className
      )}
      {...props}
    />
  );
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-3 text-xs text-encre-douce", className)}
      {...props}
    />
  );
}

/**
 * Ligne « aucun resultat » a l'interieur d'un tableau.
 * Evite le <tr><td colSpan={18}>Aucun…</td></tr> recopie dans chaque page.
 */
function TableVide({
  colonnes,
  children = "Aucune donnee.",
}: {
  colonnes: number;
  children?: React.ReactNode;
}) {
  return (
    <tr>
      <td
        colSpan={colonnes}
        className="px-2.5 py-8 text-center text-sm text-encre-douce"
      >
        {children}
      </td>
    </tr>
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  TableVide,
};
