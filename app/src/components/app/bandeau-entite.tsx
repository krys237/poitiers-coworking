// Bandeau « vous êtes dans » — Lot 4 du chantier multi-société.
//
// Affiché en tête des écrans de saisie UNIQUEMENT lorsque la société active n'est PAS la
// société principale du membre. Dans le cas courant, ne rend rien (`null`) : zéro bruit.
// Évite les erreurs de saisie dans une société secondaire (ex. RH saisissant dans EDR-TIM
// alors qu'elle travaille habituellement dans POITIERS).

import { Building2 } from "lucide-react";
import { useEntite } from "@/app/EntiteActive";
import { Flag } from "@/components/ui/flag";
import { Button } from "@/components/ui/button";

export function BandeauEntite({ className }: { className?: string }) {
  const { entiteId, nom, entites, basculer } = useEntite();

  // Tant que la liste n'est pas chargée ou si le membre est dans sa société principale : rien.
  if (!entiteId || !nom) return null;
  const active = entites.find((e) => e.entiteId === entiteId);
  if (!active || active.principale) return null;

  const principale = entites.find((e) => e.principale);

  return (
    <div
      role="status"
      aria-live="polite"
      className={
        "flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300/80 bg-amber-50/80 px-3.5 py-2 text-xs text-amber-950 print:hidden " +
        (className ?? "")
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <Flag variant="a-renseigner" size="sm" icon={<Building2 className="h-3 w-3" />}>
          Société active : {nom}
        </Flag>
        <span className="text-amber-900">
          Vous travaillez hors de votre société principale{principale ? ` (${principale.nom})` : ""}.
        </span>
      </div>
      {principale ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 border-amber-300 bg-white/80 text-xs text-amber-950 hover:bg-amber-100"
          onClick={() => basculer(principale.entiteId)}
        >
          Revenir à {principale.nom}
        </Button>
      ) : null}
    </div>
  );
}
