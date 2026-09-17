import * as React from "react";
import {
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  CircleCheckIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { messageErreur } from "@/lib/format";

/**
 * Encart d'information, d'avertissement ou d'erreur.
 *
 * Remplace `<div className="note">` (26 emplois) qui servait indistinctement
 * a informer, alerter et rendre compte d'une action. Ici le `ton` est explicite
 * et l'encart accepte une action a droite — c'est le cas des bandeaux
 * « Initialiser les donnees de demo » du tableau de bord.
 *
 * Un avis d'erreur porte `role="alert"` : il est annonce des son apparition.
 */
const TONS = {
  info: {
    boite: "border-ardoise/35 bg-ardoise-clair/60",
    icone: "text-ardoise",
    Icone: InfoIcon,
  },
  attention: {
    boite: "border-ocre/35 bg-ocre-clair/60",
    icone: "text-ocre",
    Icone: TriangleAlertIcon,
  },
  erreur: {
    boite: "border-carmin/35 bg-carmin-clair/60",
    icone: "text-carmin",
    Icone: OctagonXIcon,
  },
  succes: {
    boite: "border-sceau/35 bg-sceau-clair/60",
    icone: "text-sceau",
    Icone: CircleCheckIcon,
  },
} as const;

export function Avis({
  ton = "info",
  titre,
  children,
  action,
  className,
}: {
  ton?: keyof typeof TONS;
  titre?: React.ReactNode;
  children?: React.ReactNode;
  /** Bouton ou lien place a droite de l'avis. */
  action?: React.ReactNode;
  className?: string;
}) {
  const { boite, icone, Icone } = TONS[ton];
  return (
    <div
      role={ton === "erreur" ? "alert" : undefined}
      className={cn(
        "mb-4 flex flex-col gap-3 border-l-[3px] px-3.5 py-3 text-sm",
        "sm:flex-row sm:items-center sm:justify-between",
        boite,
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <Icone className={cn("mt-0.5 size-4 shrink-0", icone)} aria-hidden="true" />
        <div className="min-w-0">
          {titre ? <p className="font-semibold">{titre}</p> : null}
          {children ? (
            <div className="max-w-[80ch] text-encre-douce [&_p]:m-0">{children}</div>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0 sm:ml-4">{action}</div> : null}
    </div>
  );
}

/**
 * Rend une erreur Convex lisible.
 *
 * Les erreurs remontent enveloppees (« [CONVEX] Server Error Uncaught Error: … at handler »).
 * `messageErreur` en extrait la phrase utile ; ce composant evite d'avoir a y
 * penser sur chaque appel. Ne rend rien si `erreur` est nulle.
 */
export function AvisErreur({
  erreur,
  titre = "L'operation n'a pas abouti",
}: {
  erreur: unknown;
  titre?: React.ReactNode;
}) {
  if (!erreur) return null;
  return (
    <Avis ton="erreur" titre={titre}>
      {messageErreur(erreur)}
    </Avis>
  );
}
