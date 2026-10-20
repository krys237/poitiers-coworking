import { CheckCircle2, Clock, Send, PackageCheck, AlertCircle, Ban } from "lucide-react";
import { cn } from "@/lib/utils";

export type EtapeApprovisionnement = "preparation" | "en_attente" | "en_reception" | "cloturee";

interface CircuitApprovisionnementProps {
  statut: string;
  dateCommande?: string;
  valideLe?: string;
  validateur?: string | null;
  className?: string;
}

const ETAPES: {
  id: EtapeApprovisionnement;
  numero: number;
  label: string;
  description: string;
  icon: typeof CheckCircle2;
}[] = [
  {
    id: "preparation",
    numero: 1,
    label: "Préparation",
    description: "Saisie interne du registre",
    icon: Clock,
  },
  {
    id: "en_attente",
    numero: 2,
    label: "Validation DG",
    description: "Examen Direction Générale",
    icon: Send,
  },
  {
    id: "en_reception",
    numero: 3,
    label: "En réception",
    description: "Transmis au fournisseur",
    icon: Clock,
  },
  {
    id: "cloturee",
    numero: 4,
    label: "Commande clôturée",
    description: "Réception complète soldée",
    icon: PackageCheck,
  },
];

export function CircuitApprovisionnement({
  statut,
  className,
}: CircuitApprovisionnementProps) {
  // Détermination de l'indice de l'étape active dans le parcours normal
  let indexActuel = 0;
  if (statut === "preparation") indexActuel = 0;
  else if (statut === "en_attente") indexActuel = 1;
  else if (statut === "validee" || statut === "en_reception" || statut === "en_litige") indexActuel = 2;
  else if (statut === "livree" || statut === "cloturee") indexActuel = 3;

  const estRejetee = statut === "rejetee";
  const estEnLitige = statut === "en_litige";

  return (
    <div className={cn("p-4 rounded-xl border border-filet bg-gradient-to-b from-white to-slate-50/50 shadow-2xs space-y-3", className)}>
      <div className="flex items-center justify-between text-2xs font-bold uppercase tracking-wider text-slate-600">
        <span className="flex items-center gap-1.5 text-ocean-profond">
          <Clock className="h-3.5 w-3.5" />
          Circuit d'approvisionnement (4 étapes)
        </span>
        {estRejetee ? (
          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold flex items-center gap-1">
            <Ban className="h-3 w-3" /> Commande rejetée par la Direction
          </span>
        ) : estEnLitige ? (
          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold flex items-center gap-1">
            <AlertCircle className="h-3 w-3 text-amber-700" /> Litige de réception signalé
          </span>
        ) : (
          <span className="text-slate-400 font-medium lowercase">
            étape {indexActuel + 1} sur 4
          </span>
        )}
      </div>

      {/* Stepper horizontal visuel */}
      <div className="relative">
        {/* Ligne de liaison d'arrière-plan */}
        <div className="absolute top-4 left-6 right-6 h-0.5 bg-slate-200 -translate-y-1/2 z-0" />
        {/* Ligne de progression active */}
        <div
          className="absolute top-4 left-6 h-0.5 bg-ocean-profond -translate-y-1/2 transition-all duration-300 z-0"
          style={{
            width: estRejetee ? "0%" : `${(indexActuel / (ETAPES.length - 1)) * 100}%`,
          }}
        />

        <div className="grid grid-cols-4 relative z-10">
          {ETAPES.map((etape, idx) => {
            const estPasse = !estRejetee && idx < indexActuel;
            const estActif = !estRejetee && idx === indexActuel;

            return (
              <div key={etape.id} className="flex flex-col items-center text-center px-1">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-200 border-2",
                    estPasse
                      ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                      : estActif
                      ? "bg-ocean-profond border-ocean-profond text-white ring-4 ring-ocean-ceruleen/20 shadow-sm"
                      : "bg-white border-slate-300 text-slate-400"
                  )}
                >
                  {estPasse ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <span>{etape.numero}</span>
                  )}
                </div>

                <div className="mt-2 space-y-0.5">
                  <div
                    className={cn(
                      "text-xs font-bold leading-tight",
                      estActif
                        ? "text-ocean-nuit"
                        : estPasse
                        ? "text-slate-700"
                        : "text-slate-400"
                    )}
                  >
                    {etape.label}
                  </div>
                  <div className="text-3xs text-slate-500 hidden sm:block">
                    {etape.description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
