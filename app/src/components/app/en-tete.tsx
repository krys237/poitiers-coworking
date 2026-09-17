import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * En-tete de page : titre, phrase d'explication, actions.
 *
 * Remplace le trio `<h1>` + `<p className="sub">` + `<div className="bar">`
 * recopie dans les 21 ecrans. Les actions vont a droite du titre et passent
 * sous le titre en dessous de 768 px.
 *
 * Le sous-titre dit ce que l'ecran PERMET DE FAIRE, pas ce qu'il est.
 */
export function PageEnTete({
  titre,
  description,
  statut,
  actions,
  className,
}: {
  titre: React.ReactNode;
  description?: React.ReactNode;
  /** Badges d'etat affiches a cote du titre (mois cloture, lecture seule…). */
  statut?: React.ReactNode;
  /** Boutons d'action de l'ecran. */
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "mb-5 flex flex-col gap-3 border-b border-filet pb-4",
        "md:flex-row md:items-start md:justify-between md:gap-6",
        "print:hidden",
        className
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold leading-tight tracking-tight">
            {titre}
          </h1>
          {statut}
        </div>
        {description ? (
          <p className="mt-1 max-w-[72ch] text-sm text-encre-douce">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

/**
 * Titre de section a l'interieur d'une page.
 * Remplace les `<h3 style={{ margin: "18px 0 8px" }}>` ecrits a la main.
 */
export function Section({
  titre,
  description,
  actions,
  children,
  className,
}: {
  titre?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mb-7 last:mb-0", className)}>
      {titre || actions ? (
        <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div>
            {titre ? (
              <h2 className="text-xl font-semibold leading-tight">{titre}</h2>
            ) : null}
            {description ? (
              <p className="mt-0.5 text-sm text-encre-douce">{description}</p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex items-center gap-2 print:hidden">{actions}</div>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/**
 * Barre d'outils horizontale : filtres a gauche, actions a droite.
 * `<BarreOutils.Espace />` pousse ce qui suit vers la droite.
 */
export function BarreOutils({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-4 flex flex-wrap items-center gap-2 print:hidden",
        className
      )}
    >
      {children}
    </div>
  );
}

BarreOutils.Espace = function Espace() {
  return <span className="grow" aria-hidden="true" />;
};
