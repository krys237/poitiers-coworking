import * as React from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const TONS = {
  neutre: "border-l-filet",
  succes: "border-l-emerald-600",
  attente: "border-l-ocre",
  alerte: "border-l-carmin",
  info: "border-l-ocean-ceruleen",
} as const;

export function Tuile({
  libelle,
  valeur,
  note,
  ton = "neutre",
  compact,
  className,
  lienVers,
  badge,
  vedette,
}: {
  /** Ce que le chiffre mesure, en clair. */
  libelle: React.ReactNode;
  /** `undefined` affiche un squelette : c'est l'etat de chargement Convex. */
  valeur: React.ReactNode | undefined;
  /** Precision sous le chiffre : periode, comparaison, origine. */
  note?: React.ReactNode;
  ton?: keyof typeof TONS;
  /** Valeur textuelle longue (une date, un libelle) : reduit la taille. */
  compact?: boolean;
  className?: string;
  /** Lien optionnel : affiche un bouton flèche circulaire en haut à droite */
  lienVers?: string;
  /** Badge optionnel affiché à côté du chiffre ou sous le libellé */
  badge?: React.ReactNode;
  /** Style mis en vedette (comme sur la capture d'inspiration) */
  vedette?: boolean;
}) {
  const contenu = (
    <div
      className={cn(
        "group relative flex flex-col justify-between rounded-xl border p-4 transition-all duration-150",
        vedette
          ? "border-ocean-ceruleen/40 bg-white shadow-sm ring-1 ring-ocean-ceruleen/20"
          : "border-filet bg-surface hover:border-ocean-ceruleen/30 hover:shadow-sm",
        TONS[ton],
        lienVers && "cursor-pointer",
        className
      )}
    >
      {/* En-tête de la tuile : Libellé + Bouton flèche circulaire */}
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-semibold text-encre-douce group-hover:text-ocean-profond transition-colors">
          {libelle}
        </div>
        {lienVers && (
          <div
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-transform duration-150 group-hover:scale-105",
              vedette
                ? "bg-ocean-profond text-white shadow-sm"
                : "bg-papier text-encre-douce group-hover:bg-ocean-brume group-hover:text-ocean-profond"
            )}
            aria-label="Voir le détail"
          >
            <ArrowUpRight className="h-4 w-4" />
          </div>
        )}
      </div>

      {/* Valeur & Badge */}
      <div className="mt-2.5 flex items-baseline justify-between gap-2">
        <div
          className={cn(
            "font-bold tabular-nums tracking-tight text-encre",
            compact ? "text-base sm:text-lg" : "text-2xl sm:text-3xl"
          )}
        >
          {valeur === undefined ? (
            <Skeleton className={cn("w-32", compact ? "h-6" : "h-8")} />
          ) : (
            valeur
          )}
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </div>

      {/* Sous-titre ou note explicative */}
      {note ? (
        <div className="mt-2 text-2xs font-medium text-encre-pale">
          {note}
        </div>
      ) : null}
    </div>
  );

  if (lienVers) {
    return (
      <Link to={lienVers} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-ceruleen rounded-xl">
        {contenu}
      </Link>
    );
  }

  return contenu;
}

/**
 * Rangée de tuiles responsive.
 */
export function GrilleTuiles({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]",
        className
      )}
    >
      {children}
    </div>
  );
}
