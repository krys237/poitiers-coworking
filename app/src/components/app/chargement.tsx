import { Skeleton } from "@/components/ui/skeleton";
import { GrilleTuiles } from "@/components/app/tuile";
import { cn } from "@/lib/utils";

/**
 * Etats de chargement.
 *
 * Aujourd'hui les ecrans affichent la chaine « … » pendant que Convex repond.
 * Le probleme n'est pas esthetique : l'ecran ne dit pas COMBIEN de contenu
 * arrive, donc il saute quand les donnees tombent. Un squelette de la bonne
 * forme reserve la place et supprime le saut.
 *
 * Regle d'usage : une query Convex vaut `undefined` tant qu'elle charge.
 *
 *     if (bulletins === undefined) return <SqueletteTableau colonnes={18} />;
 */

export function SqueletteTableau({
  lignes = 6,
  colonnes = 5,
  className,
}: {
  lignes?: number;
  colonnes?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("border border-filet bg-surface", className)}
      role="status"
      aria-busy="true"
      aria-label="Chargement du tableau"
    >
      <div className="flex gap-3 bg-sceau px-2.5 py-2.5">
        {Array.from({ length: colonnes }, (_, i) => (
          <Skeleton key={i} className="h-3 flex-1 bg-white/25" />
        ))}
      </div>
      {Array.from({ length: lignes }, (_, l) => (
        <div
          key={l}
          className={cn(
            "flex gap-3 border-b border-filet-clair px-2.5 py-2.5 last:border-0",
            l % 2 === 1 && "bg-bande/60"
          )}
        >
          {Array.from({ length: colonnes }, (_, c) => (
            <Skeleton key={c} className="h-3.5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SqueletteTuiles({ nombre = 4 }: { nombre?: number }) {
  return (
    <GrilleTuiles>
      {Array.from({ length: nombre }, (_, i) => (
        <div key={i} className="border border-l-[3px] border-filet bg-surface px-3.5 py-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-2 h-8 w-28" />
        </div>
      ))}
    </GrilleTuiles>
  );
}

export function SqueletteTexte({
  lignes = 3,
  className,
}: {
  lignes?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)} role="status" aria-busy="true">
      {Array.from({ length: lignes }, (_, i) => (
        <Skeleton
          key={i}
          className="h-3.5"
          style={{ width: i === lignes - 1 ? "60%" : "100%" }}
        />
      ))}
    </div>
  );
}
