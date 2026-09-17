import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Ecran vide.
 *
 * Aujourd'hui l'absence de donnees s'affiche « Aucun employe dans la liste. »
 * dans une cellule de tableau. Un ecran vide est le meilleur moment pour dire
 * quoi faire : il est lu attentivement, justement parce qu'il n'y a rien
 * d'autre a lire.
 *
 * D'ou la forme imposee : ce qui manque, pourquoi, et le geste qui remplit.
 */
export function EtatVide({
  icone: Icone,
  titre,
  children,
  action,
  compact,
  className,
}: {
  icone?: React.ComponentType<{ className?: string }>;
  /** Ce qui manque, en une phrase. */
  titre: React.ReactNode;
  /** Pourquoi c'est vide et ce qui le remplira. */
  children?: React.ReactNode;
  /** Le geste qui remplit l'ecran. */
  action?: React.ReactNode;
  /** Version reduite, pour un encart dans une page deja remplie. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center border border-dashed border-filet bg-surface/60 text-center",
        compact ? "gap-2 px-4 py-8" : "gap-3 px-6 py-14",
        className
      )}
    >
      {Icone ? (
        <Icone
          className={cn("text-encre-pale", compact ? "size-6" : "size-8")}
        />
      ) : null}
      <p className={cn("font-semibold", compact ? "text-sm" : "text-lg")}>
        {titre}
      </p>
      {children ? (
        <p className="max-w-[56ch] text-sm text-encre-douce">{children}</p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
