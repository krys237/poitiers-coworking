import { toast } from "sonner";
import { AlertTriangle, Percent, RotateCcw } from "lucide-react";
import { type Taux } from "@/lib/payroll";
import {
  ecartAvecOfficiel,
  moisDepuisVerification,
  referenceDe,
  referenceObsolete,
} from "@/lib/taux-officiels";

const LIGNES: { cle: keyof Taux; label: string; step: number; unite: string }[] =
  [
    { cle: "plafondCnps", label: "Plafond CNPS", step: 50000, unite: "FCFA" },
    { cle: "cnpsSalariePct", label: "CNPS salarié (PVID)", step: 0.1, unite: "%" },
    { cle: "cfcSalariePct", label: "CFC salarié", step: 0.1, unite: "%" },
    {
      cle: "abattementIrppAnnuel",
      label: "Abattement IRPP annuel",
      step: 10000,
      unite: "FCFA",
    },
    { cle: "cacPct", label: "CAC (sur IRPP)", step: 1, unite: "%" },
    { cle: "pfPct", label: "Prestations familiales", step: 0.1, unite: "%" },
    { cle: "pvidPatronalPct", label: "PVID patronal", step: 0.1, unite: "%" },
    { cle: "atmpPct", label: "Accidents du travail", step: 0.05, unite: "%" },
    { cle: "fnePct", label: "FNE", step: 0.1, unite: "%" },
    { cle: "cfcPatronalPct", label: "CFC patronal", step: 0.1, unite: "%" },
  ];

/** Taux légaux applicables au mois sélectionné (CNPS, IRPP, CAC, TDL, CFC, RAV). */
export function TauxMois({
  cle,
  periode,
  taux,
  disabled,
  onChange,
  onReset,
}: {
  cle: string;
  periode: string;
  taux: Taux;
  disabled?: boolean;
  onChange: (patch: Partial<Taux>) => void;
  onReset: () => void;
}) {
  const reference = referenceDe(cle);
  const ecarts = ecartAvecOfficiel(cle, taux);
  const modifie = ecarts.length > 0;
  const obsolete = referenceObsolete(reference);

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Percent className="h-4 w-4 text-primary" /> Taux du mois – {periode}
          </h2>
          <p className="text-xs text-muted-foreground">
            Lus automatiquement dans le barème officiel applicable à ce mois
            ({reference.libelle}, en vigueur depuis {reference.effet}) —{" "}
            {reference.source}. Ils alimentent tous les bulletins de la période.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {modifie && (
            <span className="rounded bg-chart-2/30 px-2 py-1 text-[11px] font-medium">
              Taux modifiés manuellement
            </span>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              onReset();
              toast.success(`Barème officiel rétabli pour ${periode}`);
            }}
            className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw className="h-3 w-3" /> Taux officiels du mois
          </button>
        </div>
      </div>

      {(obsolete || modifie) && (
        <div className="mb-3 space-y-2">
          {obsolete && (
            <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-[11px] text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Barème vérifié pour la dernière fois le {reference.verifieLe} (il
                y a {moisDepuisVerification(reference)} mois) : les taux peuvent
                être obsolètes. Vérifiez-les sur {reference.url} avant de payer
                le mois.
              </span>
            </p>
          )}
          {modifie && (
            <p className="rounded-md border border-chart-2/50 bg-chart-2/10 p-2 text-[11px]">
              {ecarts.length} taux diffèrent du barème officiel de ce mois.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {LIGNES.map((l) => (
          <label key={l.cle} className="block text-xs">
            <span className="mb-1 block text-muted-foreground">
              {l.label} ({l.unite})
            </span>
            <input
              type="number"
              step={l.step}
              disabled={disabled}
              value={taux[l.cle] as number}
              onChange={(ev) =>
                onChange({ [l.cle]: Number(ev.target.value) || 0 } as Partial<Taux>)
              }
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-right tabular-nums outline-none focus:border-ring disabled:opacity-60"
            />
          </label>
        ))}
        {(["tdlActif", "ravActif"] as const).map((k) => (
          <label key={k} className="flex items-center gap-2 pt-5 text-xs">
            <input
              type="checkbox"
              disabled={disabled}
              checked={taux[k]}
              onChange={(ev) => onChange({ [k]: ev.target.checked })}
              className="h-4 w-4 accent-[var(--color-primary)]"
            />
            <span>{k === "tdlActif" ? "Appliquer la TDL" : "Appliquer la RAV"}</span>
          </label>
        ))}
      </div>
    </section>
  );
}
